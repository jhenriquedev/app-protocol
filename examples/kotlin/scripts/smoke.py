#!/usr/bin/env python3
from __future__ import annotations

import shutil
import tempfile

from _lib import (
    JAVA_MAIN_BACKEND,
    assert_equal,
    assert_true,
    print_ok,
    request_json,
    run_smoke,
    start_java,
    terminate_process,
    wait_for_http,
    free_port,
)


def main() -> None:
    temp_dir = tempfile.mkdtemp(prefix="app-kotlin-smoke-")
    backend_port = free_port()
    backend = None
    try:
        backend = start_java(
            JAVA_MAIN_BACKEND,
            env={
                "API_PORT": str(backend_port),
                "APP_KOTLIN_DATA_DIR": temp_dir,
            },
        )
        base_url = f"http://127.0.0.1:{backend_port}"
        wait_for_http(f"{base_url}/health")

        status, health = request_json("GET", f"{base_url}/health")
        assert_equal(status, 200, "smoke health status")
        assert_equal(health["ok"], True, "smoke health payload")

        status, missing = request_json("GET", f"{base_url}/missing-route")
        assert_equal(status, 404, "smoke missing route status")
        assert_equal(missing["error"]["code"], "NOT_FOUND", "smoke missing route error code")

        status, invalid_json = request_json(
            "POST",
            f"{base_url}/tasks",
            body="{ invalid json",
            headers={"content-type": "application/json"},
        )
        assert_equal(status, 400, "smoke invalid json status")
        assert_equal(invalid_json["error"]["code"], "INVALID_REQUEST", "smoke invalid json code")

        status, created = request_json(
            "POST",
            f"{base_url}/tasks",
            body={
                "title": "Smoke test task",
                "description": "Created by the official Kotlin smoke test",
            },
        )
        assert_equal(status, 201, "smoke create status")
        assert_true(created["success"], "smoke create must succeed")
        task = created["data"]["task"]
        assert_equal(task["status"], "todo", "smoke new tasks start in todo")

        status, listed_before_move = request_json("GET", f"{base_url}/tasks")
        assert_equal(status, 200, "smoke list before move status")
        assert_true(
            any(item["id"] == task["id"] for item in listed_before_move["data"]["tasks"]),
            "smoke created task must appear in list",
        )

        status, moved = request_json(
            "PATCH",
            f"{base_url}/tasks/{task['id']}/status",
            body={"targetStatus": "doing"},
        )
        assert_equal(status, 200, "smoke move status")
        assert_equal(moved["data"]["task"]["status"], "doing", "smoke move must update status")

        status, listed_after_move = request_json("GET", f"{base_url}/tasks")
        moved_task = next(item for item in listed_after_move["data"]["tasks"] if item["id"] == task["id"])
        assert_equal(moved_task["status"], "doing", "smoke list must reflect moved status")

        concurrent_ids = set()
        for index in range(4):
            status, payload = request_json(
                "POST",
                f"{base_url}/tasks",
                body={"title": f"Concurrent smoke task {index + 1}"},
            )
            assert_equal(status, 201, f"smoke concurrent create {index + 1} status")
            concurrent_ids.add(payload["data"]["task"]["id"])
        assert_equal(len(concurrent_ids), 4, "smoke concurrent ids must be distinct")

        status, listed_after_concurrent = request_json("GET", f"{base_url}/tasks")
        assert_equal(
            len(listed_after_concurrent["data"]["tasks"]),
            5,
            "smoke concurrent create persistence",
        )

        terminate_process(backend)
        backend = start_java(
            JAVA_MAIN_BACKEND,
            env={
                "API_PORT": str(backend_port),
                "APP_KOTLIN_DATA_DIR": temp_dir,
            },
        )
        wait_for_http(f"{base_url}/health")

        status, listed_after_restart = request_json("GET", f"{base_url}/tasks")
        persisted = next(item for item in listed_after_restart["data"]["tasks"] if item["id"] == task["id"])
        assert_equal(persisted["status"], "doing", "smoke persistence after restart")

        print_ok("smoke")
    finally:
        terminate_process(backend)
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    run_smoke(main)
