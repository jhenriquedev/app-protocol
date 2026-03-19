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

MCP_PROTOCOL_VERSION = "2025-11-25"
MCP_LEGACY_PROTOCOL_VERSION = "2025-06-18"


def mcp_post(url: str, payload):
    return request_json(
        "POST",
        url,
        body=payload,
        headers={
            "accept": "application/json, text/event-stream",
            "content-type": "application/json",
        },
    )


def main() -> None:
    temp_dir = tempfile.mkdtemp(prefix="app-kotlin-agent-mcp-http-smoke-")
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
        mcp_url = f"{agent_url}/mcp"
        wait_for_http(f"{backend_url}/health")
        wait_for_http(f"{agent_url}/health")

        get_status, _ = request_json("GET", mcp_url)
        assert_equal(get_status, 405, "agent_mcp_http_smoke GET /mcp status")

        status, invalid_initialize = mcp_post(
            mcp_url,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "1999-01-01",
                    "capabilities": {"tools": {}},
                    "clientInfo": {"name": "agent-mcp-http-smoke", "version": "1.0.0"},
                },
            },
        )
        assert_equal(status, 200, "agent_mcp_http_smoke invalid initialize http status")
        assert_true("Unsupported MCP protocol version" in invalid_initialize["error"]["message"], "agent_mcp_http_smoke invalid initialize message")

        status, initialize = mcp_post(
            mcp_url,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "initialize",
                "params": {
                    "protocolVersion": MCP_LEGACY_PROTOCOL_VERSION,
                    "capabilities": {"tools": {}},
                    "clientInfo": {"name": "agent-mcp-http-smoke", "version": "1.0.0"},
                },
            },
        )
        assert_equal(status, 200, "agent_mcp_http_smoke initialize status")
        assert_equal(initialize["result"]["protocolVersion"], MCP_PROTOCOL_VERSION, "agent_mcp_http_smoke negotiated protocol")
        assert_equal(initialize["result"]["serverInfo"]["name"], "kotlin-task-board-agent", "agent_mcp_http_smoke server name")

        notify_status, _ = request_json(
            "POST",
            mcp_url,
            body={"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}},
            headers={
                "accept": "application/json, text/event-stream",
                "content-type": "application/json",
            },
        )
        assert_equal(notify_status, 202, "agent_mcp_http_smoke notifications/initialized status")

        _, tools_list = mcp_post(mcp_url, {"jsonrpc": "2.0", "id": 3, "method": "tools/list", "params": {}})
        tool_names = sorted(item["name"] for item in tools_list["result"]["tools"])
        assert_equal(tool_names, ["task_create", "task_list", "task_move"], "agent_mcp_http_smoke tool list")

        _, resources_list = mcp_post(mcp_url, {"jsonrpc": "2.0", "id": 4, "method": "resources/list", "params": {}})
        resource_uris = sorted(item["uri"] for item in resources_list["result"]["resources"])
        assert_equal(
            resource_uris,
            [
                "app://agent/system/prompt",
                "app://agent/tools/task_create/semantic",
                "app://agent/tools/task_list/semantic",
                "app://agent/tools/task_move/semantic",
            ],
            "agent_mcp_http_smoke resource list",
        )

        _, prompt_resource = mcp_post(
            mcp_url,
            {"jsonrpc": "2.0", "id": 5, "method": "resources/read", "params": {"uri": "app://agent/system/prompt"}},
        )
        assert_true(
            "Tool task_list" in prompt_resource["result"]["contents"][0]["text"],
            "agent_mcp_http_smoke prompt resource",
        )

        _, created = mcp_post(
            mcp_url,
            {
                "jsonrpc": "2.0",
                "id": 6,
                "method": "tools/call",
                "params": {
                    "name": "task_create",
                    "arguments": {"title": "Remote MCP task"},
                },
            },
        )
        created_task = created["result"]["structuredContent"]["task"]
        assert_equal(created_task["status"], "todo", "agent_mcp_http_smoke create status")

        _, move_without_confirmation = mcp_post(
            mcp_url,
            {
                "jsonrpc": "2.0",
                "id": 7,
                "method": "tools/call",
                "params": {
                    "name": "task_move",
                    "arguments": {"taskId": created_task["id"], "targetStatus": "doing"},
                },
            },
        )
        assert_equal(move_without_confirmation["result"]["isError"], True, "agent_mcp_http_smoke move without confirmation error")
        assert_equal(
            move_without_confirmation["result"]["structuredContent"]["code"],
            "CONFIRMATION_REQUIRED",
            "agent_mcp_http_smoke move without confirmation code",
        )

        _, moved = mcp_post(
            mcp_url,
            {
                "jsonrpc": "2.0",
                "id": 8,
                "method": "tools/call",
                "params": {
                    "name": "task_move",
                    "arguments": {
                        "input": {"taskId": created_task["id"], "targetStatus": "doing"},
                        "confirmed": True,
                    },
                },
            },
        )
        assert_equal(moved["result"]["structuredContent"]["task"]["status"], "doing", "agent_mcp_http_smoke moved status")

        _, backend_tasks = request_json("GET", f"{backend_url}/tasks")
        persisted = next(item for item in backend_tasks["data"]["tasks"] if item["id"] == created_task["id"])
        assert_equal(persisted["status"], "doing", "agent_mcp_http_smoke backend parity")

        print_ok("agent_mcp_http_smoke")
    finally:
        terminate_process(agent)
        terminate_process(backend)
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    run_smoke(main)
