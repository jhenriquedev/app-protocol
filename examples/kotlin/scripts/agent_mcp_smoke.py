#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile

from _lib import (
    JAVA_MAIN_AGENT_MCP,
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


class McpClient:
    def __init__(self, process: subprocess.Popen[str]) -> None:
        self.process = process
        self.next_id = 1

    def request(self, method: str, params=None):
        request_id = self.next_id
        self.next_id += 1
        payload = {"jsonrpc": "2.0", "id": request_id, "method": method}
        if params is not None:
            payload["params"] = params
        assert self.process.stdin is not None
        assert self.process.stdout is not None
        self.process.stdin.write(json.dumps(payload) + "\n")
        self.process.stdin.flush()
        while True:
            line = self.process.stdout.readline()
            if not line:
                raise RuntimeError("MCP stdio server closed unexpectedly")
            message = json.loads(line)
            if message.get("id") != request_id:
                continue
            if message.get("error"):
                error = message["error"]
                raise RuntimeError(f"MCP error {error.get('code')}: {error.get('message')}")
            return message["result"]

    def notify(self, method: str, params=None) -> None:
        payload = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            payload["params"] = params
        assert self.process.stdin is not None
        self.process.stdin.write(json.dumps(payload) + "\n")
        self.process.stdin.flush()


def main() -> None:
    temp_dir = tempfile.mkdtemp(prefix="app-kotlin-agent-mcp-smoke-")
    backend_port = free_port()
    backend = None
    mcp_process = None
    try:
        backend = start_java(
            JAVA_MAIN_BACKEND,
            env={"API_PORT": str(backend_port), "APP_KOTLIN_DATA_DIR": temp_dir},
        )
        wait_for_http(f"http://127.0.0.1:{backend_port}/health")

        mcp_process = start_java(
            JAVA_MAIN_AGENT_MCP,
            env={"APP_KOTLIN_DATA_DIR": temp_dir},
            stdin_pipe=True,
            capture_output=True,
        )
        client = McpClient(mcp_process)

        try:
            client.request(
                "initialize",
                {
                    "protocolVersion": "1999-01-01",
                    "capabilities": {"tools": {}},
                    "clientInfo": {"name": "agent-mcp-smoke", "version": "1.0.0"},
                },
            )
            raise AssertionError("agent_mcp_smoke initialize should fail for unsupported versions")
        except RuntimeError as error:
            assert_true("Unsupported MCP protocol version" in str(error), "agent_mcp_smoke invalid initialize error")

        initialize = client.request(
            "initialize",
            {
                "protocolVersion": MCP_LEGACY_PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "agent-mcp-smoke", "version": "1.0.0"},
            },
        )
        assert_equal(initialize["protocolVersion"], MCP_PROTOCOL_VERSION, "agent_mcp_smoke negotiated protocol")
        assert_equal(initialize["serverInfo"]["name"], "kotlin-task-board-agent", "agent_mcp_smoke server name")
        assert_true("Tool task_create" in (initialize.get("instructions") or ""), "agent_mcp_smoke instructions")

        client.notify("notifications/initialized")

        listed_tools = client.request("tools/list")
        tool_names = sorted(item["name"] for item in listed_tools["tools"])
        assert_equal(tool_names, ["task_create", "task_list", "task_move"], "agent_mcp_smoke tool list")

        resources = client.request("resources/list")
        resource_uris = sorted(item["uri"] for item in resources["resources"])
        assert_equal(
            resource_uris,
            [
                "app://agent/system/prompt",
                "app://agent/tools/task_create/semantic",
                "app://agent/tools/task_list/semantic",
                "app://agent/tools/task_move/semantic",
            ],
            "agent_mcp_smoke resource list",
        )

        move_semantic = client.request("resources/read", {"uri": "app://agent/tools/task_move/semantic"})
        semantic_payload = json.loads(move_semantic["contents"][0]["text"])
        assert_true("Tool task_move" in semantic_payload["promptFragment"], "agent_mcp_smoke prompt fragment")

        invalid_create = client.request("tools/call", {"name": "task_create", "arguments": {"title": "   "}})
        assert_equal(invalid_create["isError"], True, "agent_mcp_smoke invalid create must return error")
        assert_equal(invalid_create["structuredContent"]["code"], "VALIDATION_FAILED", "agent_mcp_smoke invalid create code")

        created = client.request(
            "tools/call",
            {
                "name": "task_create",
                "arguments": {"title": "MCP-created task", "description": "Created through stdio MCP"},
            },
        )
        created_task = created["structuredContent"]["task"]
        assert_equal(created_task["status"], "todo", "agent_mcp_smoke create status")

        move_without_confirmation = client.request(
            "tools/call",
            {
                "name": "task_move",
                "arguments": {"taskId": created_task["id"], "targetStatus": "doing"},
            },
        )
        assert_equal(move_without_confirmation["isError"], True, "agent_mcp_smoke move without confirmation error")
        assert_equal(
            move_without_confirmation["structuredContent"]["code"],
            "CONFIRMATION_REQUIRED",
            "agent_mcp_smoke move without confirmation code",
        )

        moved = client.request(
            "tools/call",
            {
                "name": "task_move",
                "arguments": {
                    "input": {"taskId": created_task["id"], "targetStatus": "doing"},
                    "confirmed": True,
                },
            },
        )
        assert_equal(moved["structuredContent"]["task"]["status"], "doing", "agent_mcp_smoke moved status")

        _, backend_tasks = request_json("GET", f"http://127.0.0.1:{backend_port}/tasks")
        persisted = next(item for item in backend_tasks["data"]["tasks"] if item["id"] == created_task["id"])
        assert_equal(persisted["status"], "doing", "agent_mcp_smoke backend parity")

        print_ok("agent_mcp_smoke")
    finally:
        terminate_process(mcp_process)
        terminate_process(backend)
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    run_smoke(main)
