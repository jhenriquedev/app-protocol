# ==========================================================================
# APP v1.1.6
# apps/agent/mcp_http.py
# --------------------------------------------------------------------------
# MCP streamable-http transport adapter.
#
# Handles JSON-RPC over HTTP POST at /mcp.
# Supports single and batch requests.
# Returns 405 for GET/DELETE, 202 for notification-only batches.
# ==========================================================================

from __future__ import annotations

import json
from typing import Any

from core.shared.app_mcp_contracts import (
    AppMcpHttpExchange,
    AppMcpHttpResponse,
    AppMcpProtocolError,
    AppMcpRequestContext,
    AppMcpServer,
    BaseAppMcpHttpAdapter,
)

_JSONRPC_VERSION = "2.0"
_PARSE_ERROR = -32700
_INVALID_REQUEST = -32600
_METHOD_NOT_FOUND = -32601
_INTERNAL_ERROR = -32603

_JSON_HEADERS = {"Content-Type": "application/json"}


class StreamableHttpAppMcpAdapter(BaseAppMcpHttpAdapter):
    """MCP adapter for streamable HTTP transport (POST /mcp)."""

    @property
    def transport(self) -> str:
        return "streamable-http"

    @property
    def endpoint_path(self) -> str:
        return "/mcp"

    def handle(
        self,
        exchange: AppMcpHttpExchange,
        server: AppMcpServer,
    ) -> AppMcpHttpResponse | None:
        """Handle an incoming HTTP exchange for MCP."""
        # Only POST is supported.
        if exchange.method.upper() != "POST":
            return AppMcpHttpResponse(
                status_code=405,
                headers={**_JSON_HEADERS, "Allow": "POST"},
                body_text=json.dumps({
                    "jsonrpc": _JSONRPC_VERSION,
                    "id": None,
                    "error": {"code": _INVALID_REQUEST, "message": "Method not allowed. Use POST."},
                }),
            )

        # Parse body
        body_text = exchange.body_text or ""
        try:
            parsed = json.loads(body_text)
        except json.JSONDecodeError:
            return _error_response(None, _PARSE_ERROR, "Parse error")

        # Single vs batch
        if isinstance(parsed, list):
            return self._handle_batch(parsed, server)
        elif isinstance(parsed, dict):
            return self._handle_single(parsed, server)
        else:
            return _error_response(None, _INVALID_REQUEST, "Invalid JSON-RPC request")

    def _handle_single(
        self, msg: dict[str, Any], server: AppMcpServer
    ) -> AppMcpHttpResponse:
        """Handle a single JSON-RPC message."""
        request_id = msg.get("id")
        method = msg.get("method", "")
        params = msg.get("params", {})
        is_notification = request_id is None

        if is_notification:
            self._handle_notification(method, params, server)
            return AppMcpHttpResponse(status_code=202, headers=_JSON_HEADERS)

        return self._handle_request(request_id, method, params, server)

    def _handle_batch(
        self, messages: list[Any], server: AppMcpServer
    ) -> AppMcpHttpResponse:
        """Handle a batch of JSON-RPC messages."""
        responses: list[dict[str, Any]] = []
        has_requests = False

        for msg in messages:
            if not isinstance(msg, dict):
                responses.append({
                    "jsonrpc": _JSONRPC_VERSION,
                    "id": None,
                    "error": {"code": _INVALID_REQUEST, "message": "Invalid request in batch"},
                })
                continue

            request_id = msg.get("id")
            method = msg.get("method", "")
            params = msg.get("params", {})
            is_notification = request_id is None

            if is_notification:
                self._handle_notification(method, params, server)
            else:
                has_requests = True
                resp = self._handle_request(request_id, method, params, server)
                if resp.body_text:
                    responses.append(json.loads(resp.body_text))

        if not has_requests:
            return AppMcpHttpResponse(status_code=202, headers=_JSON_HEADERS)

        return AppMcpHttpResponse(
            status_code=200,
            headers=_JSON_HEADERS,
            body_text=json.dumps(responses, ensure_ascii=False),
        )

    def _handle_notification(
        self, method: str, params: Any, server: AppMcpServer
    ) -> None:
        """Handle a notification (no response needed)."""
        # Silently accept known notifications.
        pass

    def _handle_request(
        self,
        request_id: Any,
        method: str,
        params: Any,
        server: AppMcpServer,
    ) -> AppMcpHttpResponse:
        """Dispatch a JSON-RPC request to the server."""
        ctx = AppMcpRequestContext(transport="streamable-http", request_id=request_id)

        try:
            if method == "initialize":
                result = server.initialize(params, ctx)
                return _success_response(request_id, result)

            if method == "ping":
                return _success_response(request_id, {})

            if method == "tools/list":
                tools = server.list_tools(ctx)
                return _success_response(request_id, {"tools": tools})

            if method == "resources/list":
                resources = server.list_resources(ctx)
                return _success_response(request_id, {"resources": resources})

            if method == "resources/read":
                uri = (params or {}).get("uri", "")
                result = server.read_resource(uri, ctx)
                return _success_response(request_id, result)

            if method == "tools/call":
                name = (params or {}).get("name", "")
                args = (params or {}).get("arguments", {})
                result = server.call_tool(name, args, ctx)
                return _success_response(request_id, result)

            return _error_response(request_id, _METHOD_NOT_FOUND, f"Unknown method: {method}")

        except AppMcpProtocolError as e:
            return _error_response(request_id, e.code, str(e), e.data)
        except Exception as e:
            return _error_response(request_id, _INTERNAL_ERROR, str(e))


# ==========================================================================
# Helpers
# ==========================================================================

def _success_response(request_id: Any, result: Any) -> AppMcpHttpResponse:
    """Build a JSON-RPC success HTTP response."""
    return AppMcpHttpResponse(
        status_code=200,
        headers=_JSON_HEADERS,
        body_text=json.dumps({
            "jsonrpc": _JSONRPC_VERSION,
            "id": request_id,
            "result": result,
        }, ensure_ascii=False),
    )


def _error_response(
    request_id: Any,
    code: int,
    message: str,
    data: Any = None,
) -> AppMcpHttpResponse:
    """Build a JSON-RPC error HTTP response."""
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return AppMcpHttpResponse(
        status_code=200,  # JSON-RPC errors use 200 status with error payload.
        headers=_JSON_HEADERS,
        body_text=json.dumps({
            "jsonrpc": _JSONRPC_VERSION,
            "id": request_id,
            "error": error,
        }, ensure_ascii=False),
    )
