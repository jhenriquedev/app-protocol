# ==========================================================================
# APP v1.1.4
# apps/agent/app.py
# --------------------------------------------------------------------------
# Agent host bootstrap.
#
# Responsibilities:
# - create the registry (with AgenticRegistry methods)
# - materialize ctx.cases from the registry
# - create ApiContext and AgenticContext per execution
# - build the agent catalog from registered agentic surfaces
# - resolve and execute tools with confirmation enforcement
# - build the system prompt from tool fragments
# - implement AppMcpServer for MCP publication
# - serve HTTP with /catalog, /tools/:name/execute, /mcp, /health, /manifest
# ==========================================================================

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

from core.agentic_case import AgenticContext, BaseAgenticCase
from core.api_case import ApiContext, ApiResponse
from core.shared.app_mcp_contracts import (
    AppMcpCallResult,
    AppMcpHttpExchange,
    AppMcpInitializeParams,
    AppMcpInitializeResult,
    AppMcpProtocolError,
    AppMcpReadResourceResult,
    AppMcpRequestContext,
    AppMcpResourceDescriptor,
    AppMcpServer,
    AppMcpServerInfo,
    AppMcpTextContent,
    AppMcpTextResourceContent,
    AppMcpToolDescriptor,
)
from core.shared.app_structural_contracts import AppCaseError

from apps.agent.registry import AgentConfig, create_registry


# ==========================================================================
# MCP constants
# ==========================================================================

_MCP_PROTOCOL_VERSION = "2025-03-26"
_MCP_SUPPORTED_VERSIONS = ["2024-11-05", "2025-03-26"]
_MCP_SERVER_NAME = "app-python-agent"
_MCP_SERVER_VERSION = "1.1.1"


# ==========================================================================
# Console logger
# ==========================================================================

class _ConsoleLogger:
    """Simple console logger for the agent host."""

    def __init__(self, prefix: str = "[agent]") -> None:
        self._prefix = prefix

    def debug(self, message: str, meta: dict[str, Any] | None = None) -> None:
        pass

    def info(self, message: str, meta: dict[str, Any] | None = None) -> None:
        if meta:
            print(f"{self._prefix} {message}", meta)
        else:
            print(f"{self._prefix} {message}")

    def warn(self, message: str, meta: dict[str, Any] | None = None) -> None:
        print(f"{self._prefix} WARN: {message}")

    def error(self, message: str, meta: dict[str, Any] | None = None) -> None:
        print(f"{self._prefix} ERROR: {message}")


# ==========================================================================
# Helpers
# ==========================================================================

def _build_semantic_summary(entry: dict[str, Any]) -> str:
    """Build a semantic summary string from a catalog entry."""
    parts: list[str] = []
    tool = entry.get("tool", {})
    prompt = entry.get("prompt", {})
    discovery = entry.get("discovery", {})

    parts.append(tool.get("description", discovery.get("description", "")))

    purpose = prompt.get("purpose")
    if purpose:
        parts.append(f"Purpose: {purpose}")

    constraints = prompt.get("constraints", [])
    if constraints:
        parts.append("Constraints: " + "; ".join(constraints))

    policy = entry.get("policy", {})
    if policy.get("require_confirmation"):
        parts.append("Requires confirmation before execution.")

    return " | ".join(p for p in parts if p)


def _build_prompt_fragment(entry: dict[str, Any]) -> str:
    """Build a prompt fragment for the system prompt from a catalog entry."""
    tool = entry.get("tool", {})
    prompt = entry.get("prompt", {})
    lines: list[str] = []

    lines.append(f"Tool {tool.get('name', '?')}: {tool.get('description', '')}")

    purpose = prompt.get("purpose")
    if purpose:
        lines.append(f"  Purpose: {purpose}")

    when_to_use = prompt.get("when_to_use", [])
    for w in when_to_use:
        lines.append(f"  - Use when: {w}")

    constraints = prompt.get("constraints", [])
    for c in constraints:
        lines.append(f"  - Constraint: {c}")

    policy = entry.get("policy", {})
    if policy.get("require_confirmation"):
        lines.append("  - REQUIRES CONFIRMATION before execution")

    return "\n".join(lines)


def _build_resource_uri(domain: str, case_name: str, kind: str) -> str:
    """Build an MCP resource URI for a Case."""
    return f"app://{domain}/{case_name}/{kind}"


# ==========================================================================
# Bootstrap
# ==========================================================================

def bootstrap(config: AgentConfig | None = None) -> dict[str, Any]:
    """
    Bootstrap the agent host.

    Returns a dict with all host functions.
    """
    cfg = config or AgentConfig()
    registry = create_registry(cfg)
    logger = _ConsoleLogger()

    # ------------------------------------------------------------------
    # Context materialization
    # ------------------------------------------------------------------

    def create_api_context(parent: dict[str, Any] | None = None) -> ApiContext:
        """Create a fresh ApiContext."""
        cid = (parent or {}).get("correlation_id", str(uuid.uuid4()))
        return ApiContext(
            correlation_id=cid,
            execution_id=str(uuid.uuid4()),
            logger=logger,
            cases=create_cases_map(),
            packages=registry.get("_packages", {}),
            extra={"task_store": registry["_providers"]["task_store"]},
        )

    def create_agentic_context(parent: dict[str, Any] | None = None) -> AgenticContext:
        """Create a fresh AgenticContext."""
        cid = (parent or {}).get("correlation_id", str(uuid.uuid4()))
        return AgenticContext(
            correlation_id=cid,
            execution_id=str(uuid.uuid4()),
            logger=logger,
            cases=create_cases_map(),
            packages=registry.get("_packages", {}),
        )

    def create_cases_map() -> dict[str, Any]:
        """Instantiate api surfaces from the registry."""
        cases_map: dict[str, Any] = {}
        for domain_name, domain_cases in registry["_cases"].items():
            domain_map: dict[str, Any] = {}
            for case_name, surfaces in domain_cases.items():
                case_map: dict[str, Any] = {}
                api_cls = surfaces.get("api")
                if api_cls is not None:
                    ctx = create_api_context()
                    case_map["api"] = api_cls(ctx)
                domain_map[case_name] = case_map
            cases_map[domain_name] = domain_map
        return cases_map

    # ------------------------------------------------------------------
    # Catalog and tool resolution
    # ------------------------------------------------------------------

    def build_agent_catalog(parent: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """Build the full agent catalog."""
        ctx = create_agentic_context(parent)
        return registry["build_catalog"](ctx)

    def build_system_prompt(parent: dict[str, Any] | None = None) -> str:
        """Assemble the system prompt from all tool fragments."""
        catalog = build_agent_catalog(parent)
        fragments = [_build_prompt_fragment(entry) for entry in catalog]
        header = "You are an agent with access to the following tools:\n\n"
        return header + "\n\n".join(fragments)

    def resolve_tool(
        tool_name: str, parent: dict[str, Any] | None = None
    ) -> BaseAgenticCase[Any, Any] | None:
        """Resolve a tool by name."""
        ctx = create_agentic_context(parent)
        return registry["resolve_tool"](tool_name, ctx)

    def execute_tool(
        tool_name: str,
        input_data: Any,
        parent: dict[str, Any] | None = None,
        confirmed: bool = False,
    ) -> ApiResponse[Any]:
        """Execute a tool with confirmation enforcement."""
        instance = resolve_tool(tool_name, parent)
        if instance is None:
            return ApiResponse(
                success=False,
                error=AppCaseError("NOT_FOUND", f"Unknown tool: {tool_name}").to_app_error(),
                status_code=404,
            )

        # Enforce suggest-only mode
        policy = instance.policy()
        if policy and policy.execution_mode == "suggest-only":
            return ApiResponse(
                success=False,
                error=AppCaseError(
                    "FORBIDDEN", f"Tool {tool_name} is suggest-only and cannot be executed"
                ).to_app_error(),
                status_code=403,
            )

        # Enforce confirmation
        if instance.requires_confirmation() and not confirmed:
            tool_def = instance.tool()
            return ApiResponse(
                success=False,
                error=AppCaseError(
                    "CONFIRMATION_REQUIRED",
                    f"Tool {tool_name} requires confirmation before execution",
                    details={
                        "tool": tool_name,
                        "input": input_data,
                        "description": tool_def.description,
                    },
                ).to_app_error(),
                status_code=409,
            )

        # Execute
        try:
            result = instance.execute(input_data)
            if isinstance(result, ApiResponse):
                return result
            if isinstance(result, dict) and "success" in result:
                if result.get("success"):
                    return ApiResponse(success=True, data=result.get("data"))
                err = result.get("error")
                if err and isinstance(err, dict):
                    from core.shared.app_structural_contracts import AppError
                    return ApiResponse(
                        success=False,
                        error=AppError(
                            code=err.get("code", "INTERNAL"),
                            message=err.get("message", "Unknown error"),
                            details=err.get("details"),
                        ),
                    )
            return ApiResponse(success=True, data=result)
        except AppCaseError as err:
            return ApiResponse(success=False, error=err.to_app_error())
        except Exception as err:
            logger.error(f"Tool execution error: {err}")
            return ApiResponse(
                success=False,
                error=AppCaseError("INTERNAL", str(err)).to_app_error(),
            )

    # ------------------------------------------------------------------
    # MCP server implementation
    # ------------------------------------------------------------------

    def mcp_server_info() -> AppMcpServerInfo:
        return AppMcpServerInfo(
            name=_MCP_SERVER_NAME,
            version=_MCP_SERVER_VERSION,
            protocol_version=_MCP_PROTOCOL_VERSION,
        )

    def initialize_mcp(
        params: AppMcpInitializeParams | None = None,
        parent: AppMcpRequestContext | None = None,
    ) -> AppMcpInitializeResult:
        """Handle MCP initialize."""
        client_version = (params or {}).get("protocol_version", "")
        if client_version and client_version not in _MCP_SUPPORTED_VERSIONS:
            raise AppMcpProtocolError(
                -32600,
                f"Unsupported protocol version: {client_version}. "
                f"Supported: {', '.join(_MCP_SUPPORTED_VERSIONS)}",
            )

        # Negotiate to host version
        negotiated = _MCP_PROTOCOL_VERSION

        # Build instructions with tool fragments
        catalog = build_agent_catalog()
        fragments = [_build_prompt_fragment(entry) for entry in catalog]
        instructions = build_system_prompt()

        return AppMcpInitializeResult(
            protocol_version=negotiated,
            capabilities={
                "tools": {"listChanged": False},
                "resources": {"listChanged": False},
            },
            server_info={"name": _MCP_SERVER_NAME, "version": _MCP_SERVER_VERSION},
            instructions=instructions,
        )

    def list_mcp_tools(
        parent: AppMcpRequestContext | None = None,
    ) -> list[AppMcpToolDescriptor]:
        """List MCP tools."""
        catalog = build_agent_catalog()
        tools: list[AppMcpToolDescriptor] = []
        for entry in catalog:
            tool = entry.get("tool", {})
            mcp = entry.get("mcp")
            if mcp is None or not mcp.get("enabled", True):
                continue

            name = mcp.get("name") or tool.get("name", "")
            title = mcp.get("title")
            description = mcp.get("description") or _build_semantic_summary(entry)

            descriptor = AppMcpToolDescriptor(
                name=name,
                description=description,
                input_schema=tool.get("input_schema", {}),
            )
            if title:
                descriptor["title"] = title

            tools.append(descriptor)
        return tools

    def list_mcp_resources(
        parent: AppMcpRequestContext | None = None,
    ) -> list[AppMcpResourceDescriptor]:
        """List MCP resources."""
        resources: list[AppMcpResourceDescriptor] = []

        # System prompt resource
        resources.append(AppMcpResourceDescriptor(
            uri="app://system/prompt",
            name="system_prompt",
            title="System Prompt",
            description="The assembled system prompt for this agent",
            mime_type="text/plain",
        ))

        # Semantic resources per tool
        catalog = build_agent_catalog()
        for entry in catalog:
            ref = entry.get("ref", {})
            domain = ref.get("domain", "")
            case_name = ref.get("case_name", "")
            discovery = entry.get("discovery", {})

            uri = _build_resource_uri(domain, case_name, "semantic")
            resources.append(AppMcpResourceDescriptor(
                uri=uri,
                name=f"{case_name}_semantic",
                title=f"{discovery.get('description', case_name)} — Semantic",
                description=f"Semantic metadata for {case_name}",
                mime_type="application/json",
            ))

        return resources

    def read_mcp_resource(
        uri: str,
        parent: AppMcpRequestContext | None = None,
    ) -> AppMcpReadResourceResult:
        """Read an MCP resource by URI."""
        if uri == "app://system/prompt":
            prompt_text = build_system_prompt()
            return AppMcpReadResourceResult(
                contents=[AppMcpTextResourceContent(uri=uri, text=prompt_text, mime_type="text/plain")]
            )

        # Try semantic resource
        catalog = build_agent_catalog()
        for entry in catalog:
            ref = entry.get("ref", {})
            expected_uri = _build_resource_uri(ref.get("domain", ""), ref.get("case_name", ""), "semantic")
            if uri == expected_uri:
                semantic_data: dict[str, Any] = {
                    "discovery": entry.get("discovery"),
                    "prompt": entry.get("prompt"),
                    "promptFragment": _build_prompt_fragment(entry),
                    "context": entry.get("context"),
                    "policy": entry.get("policy"),
                }
                rag = entry.get("rag")
                if rag:
                    semantic_data["rag"] = rag
                return AppMcpReadResourceResult(
                    contents=[AppMcpTextResourceContent(
                        uri=uri,
                        text=json.dumps(semantic_data, ensure_ascii=False, indent=2),
                        mime_type="application/json",
                    )]
                )

        raise AppMcpProtocolError(-32600, f"Resource not found: {uri}")

    def call_mcp_tool(
        name: str,
        args: Any,
        parent: AppMcpRequestContext | None = None,
    ) -> AppMcpCallResult:
        """Call an MCP tool."""
        # Resolve tool name from MCP name to internal name
        catalog = build_agent_catalog()
        internal_name: str | None = None
        for entry in catalog:
            mcp = entry.get("mcp")
            tool = entry.get("tool", {})
            mcp_name = (mcp or {}).get("name") or tool.get("name", "")
            if mcp_name == name:
                internal_name = tool.get("name")
                break

        if internal_name is None:
            internal_name = name

        # Check confirmation header from parent context
        confirmed = False
        if isinstance(args, dict):
            confirmed = bool(args.pop("_confirmed", False))

        result = execute_tool(internal_name, args, confirmed=confirmed)

        if result.success:
            return AppMcpCallResult(
                content=[AppMcpTextContent(type="text", text=json.dumps(result.data, ensure_ascii=False))],
                structured_content=result.data,
            )
        else:
            error = result.error
            return AppMcpCallResult(
                content=[AppMcpTextContent(
                    type="text",
                    text=f"Error: {error.code if error else 'UNKNOWN'} — {error.message if error else ''}",
                )],
                structured_content=error.to_dict() if error else None,
                is_error=True,
            )

    # Concrete MCP server
    class _AgentMcpServer(AppMcpServer):
        def server_info(self) -> AppMcpServerInfo:
            return mcp_server_info()

        def initialize(self, params: AppMcpInitializeParams | None = None, parent: AppMcpRequestContext | None = None) -> AppMcpInitializeResult:
            return initialize_mcp(params, parent)

        def list_tools(self, parent: AppMcpRequestContext | None = None) -> list[AppMcpToolDescriptor]:
            return list_mcp_tools(parent)

        def list_resources(self, parent: AppMcpRequestContext | None = None) -> list[AppMcpResourceDescriptor]:
            return list_mcp_resources(parent)

        def read_resource(self, uri: str, parent: AppMcpRequestContext | None = None) -> AppMcpReadResourceResult:
            return read_mcp_resource(uri, parent)

        def call_tool(self, name: str, args: Any, parent: AppMcpRequestContext | None = None) -> AppMcpCallResult:
            return call_mcp_tool(name, args, parent)

    mcp_server_instance = _AgentMcpServer()

    # ------------------------------------------------------------------
    # Publish MCP (stdio)
    # ------------------------------------------------------------------

    def publish_mcp() -> None:
        """Start MCP stdio server."""
        adapter = registry["_providers"]["mcp_adapters"]["stdio"]
        adapter.serve(mcp_server_instance)

    # ------------------------------------------------------------------
    # Validate agentic runtime
    # ------------------------------------------------------------------

    def validate_agentic_runtime() -> None:
        """Validate the agent host runtime configuration."""
        ctx = create_agentic_context()

        # Verify catalog builds successfully
        catalog = registry["build_catalog"](ctx)
        assert len(catalog) > 0, "Agent catalog is empty"

        # Verify tool resolution
        for entry in catalog:
            tool_name = entry["tool"]["name"]
            instance = registry["resolve_tool"](tool_name, ctx)
            assert instance is not None, f"Could not resolve tool: {tool_name}"

        # Verify MCP tools list
        mcp_tools = list_mcp_tools()
        assert len(mcp_tools) > 0, "MCP tools list is empty"

        # Verify MCP resources list
        mcp_resources = list_mcp_resources()
        assert len(mcp_resources) > 0, "MCP resources list is empty"

        logger.info("Agentic runtime validation passed", {
            "tools": len(catalog),
            "mcp_tools": len(mcp_tools),
            "mcp_resources": len(mcp_resources),
        })

    # ------------------------------------------------------------------
    # HTTP server
    # ------------------------------------------------------------------

    def handle_request(
        method: str,
        path: str,
        body: str | None,
        headers: dict[str, str],
    ) -> tuple[int, dict[str, Any]]:
        """Handle an incoming HTTP request for the agent host."""
        if method.upper() == "OPTIONS":
            return 204, {}

        if path == "/health":
            return 200, {"status": "ok"}

        if path == "/manifest":
            agentic_refs = registry["list_agentic_cases"]()
            return 200, {
                "app": "agent",
                "tools": [r["case_name"] for r in agentic_refs],
                "packages": list(registry.get("_packages", {}).keys()),
            }

        # Catalog
        if path == "/catalog":
            catalog = build_agent_catalog()
            system_prompt = build_system_prompt()
            return 200, {
                "tools": catalog,
                "systemPrompt": system_prompt,
            }

        # MCP endpoint
        mcp_adapter = registry["_providers"]["mcp_adapters"]["http"]
        if path == mcp_adapter.endpoint_path:
            from core.shared.app_mcp_contracts import AppMcpHttpExchange
            exchange = AppMcpHttpExchange(
                method=method, path=path,
                headers=headers, body_text=body,
            )
            mcp_response = mcp_adapter.handle(exchange, mcp_server_instance)
            if mcp_response is not None:
                body_dict = {}
                if mcp_response.body_text:
                    try:
                        body_dict = json.loads(mcp_response.body_text)
                    except json.JSONDecodeError:
                        body_dict = {"raw": mcp_response.body_text}
                return mcp_response.status_code, body_dict
            return 500, {"error": "MCP adapter returned no response"}

        # Tool execution: /tools/:name/execute
        tool_match = re.match(r"^/tools/([^/]+)/execute$", path)
        if tool_match and method.upper() == "POST":
            tool_name = tool_match.group(1)
            input_data: Any = {}
            if body and body.strip():
                try:
                    input_data = json.loads(body)
                except json.JSONDecodeError:
                    return 400, {
                        "success": False,
                        "error": {"code": "INVALID_JSON", "message": "Invalid JSON"},
                    }

            confirmed = headers.get("x-confirmation", "").lower() == "true"
            result = execute_tool(tool_name, input_data, confirmed=confirmed)
            status = result.status_code or (200 if result.success else 400)
            return status, result.to_dict()

        return 404, {
            "success": False,
            "error": {"code": "NOT_FOUND", "message": f"No route for {method} {path}"},
        }

    def start_agent(port_override: int | None = None) -> HTTPServer:
        """Start the agent HTTP server."""
        port = port_override or cfg.port
        host_ref = {"handle_request": handle_request}

        class Handler(BaseHTTPRequestHandler):
            def do_OPTIONS(self) -> None:
                self._handle("OPTIONS")

            def do_GET(self) -> None:
                self._handle("GET")

            def do_POST(self) -> None:
                self._handle("POST")

            def do_PATCH(self) -> None:
                self._handle("PATCH")

            def do_DELETE(self) -> None:
                self._handle("DELETE")

            def _handle(self, method: str) -> None:
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else None
                hdrs = {k.lower(): v for k, v in self.headers.items()}

                status, response = host_ref["handle_request"](method, self.path, body, hdrs)

                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Confirmation")
                if status == 204:
                    self.end_headers()
                    return
                self.end_headers()
                response_body = json.dumps(response, ensure_ascii=False)
                self.wfile.write(response_body.encode("utf-8"))

            def log_message(self, format: str, *args: Any) -> None:
                pass

        ctx = create_agentic_context()
        catalog = registry["build_catalog"](ctx)
        mcp_enabled = registry["list_mcp_enabled_tools"](ctx)
        confirmation_count = sum(
            1 for e in catalog
            if e.get("policy", {}).get("require_confirmation")
        )

        server = HTTPServer(("", port), Handler)
        actual_port = server.server_address[1]
        logger.info("Agent scaffold started", {
            "port": actual_port,
            "tools": len(catalog),
            "mcpEnabled": len(mcp_enabled),
            "requireConfirmation": confirmation_count,
        })
        server.serve_forever()
        return server

    # ------------------------------------------------------------------
    # Exported host interface
    # ------------------------------------------------------------------

    return {
        "registry": registry,
        "create_api_context": create_api_context,
        "create_agentic_context": create_agentic_context,
        "create_cases_map": create_cases_map,
        "build_agent_catalog": build_agent_catalog,
        "build_system_prompt": build_system_prompt,
        "resolve_tool": resolve_tool,
        "execute_tool": execute_tool,
        "mcp_server_info": mcp_server_info,
        "initialize_mcp": initialize_mcp,
        "list_mcp_tools": list_mcp_tools,
        "list_mcp_resources": list_mcp_resources,
        "read_mcp_resource": read_mcp_resource,
        "call_mcp_tool": call_mcp_tool,
        "validate_agentic_runtime": validate_agentic_runtime,
        "publish_mcp": publish_mcp,
        "handle_request": handle_request,
        "start_agent": start_agent,
    }
