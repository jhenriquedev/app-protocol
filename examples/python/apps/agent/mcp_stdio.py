# ==========================================================================
# APP v1.1.1
# apps/agent/mcp_stdio.py
# --------------------------------------------------------------------------
# MCP stdio transport adapter.
#
# Reads JSON-RPC messages from stdin, dispatches to AppMcpServer,
# and writes responses to stdout.
#
# Session phases: awaiting_initialize -> awaiting_initialized -> ready
# ==========================================================================

from __future__ import annotations

import json
import sys
from typing import Any

from core.shared.app_mcp_contracts import (
    AppMcpProtocolError,
    AppMcpRequestContext,
    AppMcpServer,
    BaseAppMcpProcessAdapter,
)

_JSONRPC_VERSION = "2.0"
_PARSE_ERROR = -32700
_INVALID_REQUEST = -32600
_METHOD_NOT_FOUND = -32601
_INTERNAL_ERROR = -32603


class StdioAppMcpAdapter(BaseAppMcpProcessAdapter):
    """MCP adapter for stdio (stdin/stdout) transport."""

    @property
    def transport(self) -> str:
        return "stdio"

    def serve(self, server: AppMcpServer) -> None:
        """
        Start serving MCP requests from stdin.

        Reads one JSON-RPC message per line, dispatches to the server,
        and writes responses to stdout. Exits when stdin closes.
        """
        phase = "awaiting_initialize"

        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            # Parse JSON
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                _write_error(None, _PARSE_ERROR, "Parse error")
                continue

            if not isinstance(msg, dict):
                _write_error(None, _INVALID_REQUEST, "Request must be a JSON object")
                continue

            # Reject batches
            if isinstance(msg, list):
                _write_error(None, _INVALID_REQUEST, "Batch requests not supported")
                continue

            method = msg.get("method")
            request_id = msg.get("id")
            params = msg.get("params", {})
            is_notification = request_id is None

            ctx = AppMcpRequestContext(
                transport="stdio",
                request_id=request_id,
            )

            # -- Phase: awaiting_initialize --
            if phase == "awaiting_initialize":
                if method == "initialize":
                    try:
                        result = server.initialize(params, ctx)
                        _write_result(request_id, result)
                        phase = "awaiting_initialized"
                    except AppMcpProtocolError as e:
                        _write_error(request_id, e.code, str(e), e.data)
                    continue

                if is_notification:
                    continue  # Silently drop notifications before init.

                _write_error(
                    request_id, _INVALID_REQUEST,
                    "Server not initialized. Send initialize first.",
                )
                continue

            # -- Phase: awaiting_initialized --
            if phase == "awaiting_initialized":
                if method == "notifications/initialized":
                    phase = "ready"
                    continue
                # Allow immediate requests (lenient, like the TS example).
                phase = "ready"

            # -- Phase: ready --
            if is_notification:
                # Handle known notifications silently.
                if method in ("notifications/initialized", "notifications/cancelled"):
                    continue
                continue

            # Dispatch request
            try:
                if method == "ping":
                    _write_result(request_id, {})

                elif method == "tools/list":
                    tools = server.list_tools(ctx)
                    _write_result(request_id, {"tools": tools})

                elif method == "resources/list":
                    resources = server.list_resources(ctx)
                    _write_result(request_id, {"resources": resources})

                elif method == "resources/read":
                    uri = (params or {}).get("uri", "")
                    result = server.read_resource(uri, ctx)
                    _write_result(request_id, result)

                elif method == "tools/call":
                    name = (params or {}).get("name", "")
                    args = (params or {}).get("arguments", {})
                    result = server.call_tool(name, args, ctx)
                    _write_result(request_id, result)

                elif method == "initialize":
                    _write_error(
                        request_id, _INVALID_REQUEST,
                        "Already initialized",
                    )

                else:
                    _write_error(
                        request_id, _METHOD_NOT_FOUND,
                        f"Unknown method: {method}",
                    )

            except AppMcpProtocolError as e:
                _write_error(request_id, e.code, str(e), e.data)
            except Exception as e:
                _write_error(request_id, _INTERNAL_ERROR, str(e))


def _write_result(request_id: Any, result: Any) -> None:
    """Write a JSON-RPC success response to stdout."""
    msg = {
        "jsonrpc": _JSONRPC_VERSION,
        "id": request_id,
        "result": result,
    }
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _write_error(
    request_id: Any,
    code: int,
    message: str,
    data: Any = None,
) -> None:
    """Write a JSON-RPC error response to stdout."""
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    msg: dict[str, Any] = {
        "jsonrpc": _JSONRPC_VERSION,
        "id": request_id,
        "error": error,
    }
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()
