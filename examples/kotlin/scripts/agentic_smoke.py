#!/usr/bin/env python3
from __future__ import annotations

import shutil
import tempfile

from _lib import (
    JAVA_MAIN_AGENT,
    JAVA_MAIN_BACKEND,
    assert_equal,
    assert_true,
    free_port,
    print_ok,
    request_json,
    run_smoke,
    start_java,
    terminate_process,
    wait_for_http,
)


def main() -> None:
    temp_dir = tempfile.mkdtemp(prefix="app-kotlin-agentic-smoke-")
    backend_port = free_port()
    agent_port = free_port()
    backend = None
    agent = None
    try:
        backend = start_java(
            JAVA_MAIN_BACKEND,
            env={"API_PORT": str(backend_port), "APP_KOTLIN_DATA_DIR": temp_dir},
        )
        agent = start_java(
            JAVA_MAIN_AGENT,
            env={"AGENT_PORT": str(agent_port), "APP_KOTLIN_DATA_DIR": temp_dir},
        )

        backend_url = f"http://127.0.0.1:{backend_port}"
        agent_url = f"http://127.0.0.1:{agent_port}"
        wait_for_http(f"{backend_url}/health")
        wait_for_http(f"{agent_url}/health")

        status, catalog = request_json("GET", f"{agent_url}/catalog")
        assert_equal(status, 200, "agentic catalog status")
        assert_true(catalog["success"], "agentic catalog must succeed")
        data = catalog["data"]
        tool_names = sorted(item["publishedName"] for item in data["tools"])
        assert_equal(tool_names, ["task_create", "task_list", "task_move"], "agentic tool catalog")
        assert_true("Tool task_create" in data["systemPrompt"], "agentic system prompt must include tool fragments")
        resource_uris = sorted(item["uri"] for item in data["resources"])
        assert_equal(
            resource_uris,
            [
                "app://agent/system/prompt",
                "app://agent/tools/task_create/semantic",
                "app://agent/tools/task_list/semantic",
                "app://agent/tools/task_move/semantic",
            ],
            "agentic semantic resources",
        )

        status, invalid_create = request_json(
            "POST",
            f"{agent_url}/tools/task_create/execute",
            body={"input": {"title": "   "}},
        )
        assert_equal(status, 400, "agentic invalid create status")
        assert_equal(invalid_create["error"]["code"], "VALIDATION_FAILED", "agentic invalid create code")

        status, created = request_json(
            "POST",
            f"{agent_url}/tools/task_create/execute",
            body={"title": "Agent-created task", "description": "Created through apps/agent"},
        )
        assert_equal(status, 200, "agentic create status")
        task = created["data"]["task"]
        assert_equal(task["status"], "todo", "agentic create todo state")

        status, listed_by_agent = request_json(
            "POST",
            f"{agent_url}/tools/task_list/execute",
            body={},
        )
        assert_equal(status, 200, "agentic list status")
        assert_true(
            any(item["id"] == task["id"] for item in listed_by_agent["data"]["tasks"]),
            "agentic list must see created task",
        )

        status, move_without_confirmation = request_json(
            "POST",
            f"{agent_url}/tools/task_move/execute",
            body={"taskId": task["id"], "targetStatus": "doing"},
        )
        assert_equal(status, 409, "agentic move without confirmation status")
        assert_equal(
            move_without_confirmation["error"]["code"],
            "CONFIRMATION_REQUIRED",
            "agentic move without confirmation code",
        )

        status, missing_move = request_json(
            "POST",
            f"{agent_url}/tools/task_move/execute",
            body={"input": {"taskId": "missing", "targetStatus": "done"}, "confirmed": True},
        )
        assert_equal(status, 404, "agentic missing move status")
        assert_equal(missing_move["error"]["code"], "NOT_FOUND", "agentic missing move code")

        status, moved = request_json(
            "POST",
            f"{agent_url}/tools/task_move/execute",
            body={"input": {"taskId": task["id"], "targetStatus": "doing"}, "confirmed": True},
        )
        assert_equal(status, 200, "agentic confirmed move status")
        assert_equal(moved["data"]["task"]["status"], "doing", "agentic confirmed move status payload")

        status, listed_by_backend = request_json("GET", f"{backend_url}/tasks")
        backend_task = next(item for item in listed_by_backend["data"]["tasks"] if item["id"] == task["id"])
        assert_equal(backend_task["status"], "doing", "agentic shared persistence with backend")

        print_ok("agentic_smoke")
    finally:
        terminate_process(agent)
        terminate_process(backend)
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    run_smoke(main)
