# ==========================================================================
# APP v1.1.0
# apps/agent/registry.py
# --------------------------------------------------------------------------
# Agent host registry with full AgenticRegistry implementation.
#
# Provides:
# - _cases with api + agentic surfaces for all Cases
# - _providers with task_store and MCP adapters (stdio + http)
# - _packages with data
# - AgenticRegistry methods for catalog, resolution, and MCP
# ==========================================================================

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from core.agentic_case import AgenticContext, BaseAgenticCase
from core.shared.app_host_contracts import AgenticCaseRef, AgenticCatalogEntry
from packages.data import create_data_package, create_json_file_store

# Case imports — available once cases/ is implemented.
from cases.tasks.task_create.task_create_api_case import TaskCreateApi
from cases.tasks.task_create.task_create_agentic_case import TaskCreateAgentic
from cases.tasks.task_list.task_list_api_case import TaskListApi
from cases.tasks.task_list.task_list_agentic_case import TaskListAgentic
from cases.tasks.task_move.task_move_api_case import TaskMoveApi
from cases.tasks.task_move.task_move_agentic_case import TaskMoveAgentic


def to_published_tool_name(domain: str, case_name: str) -> str:
    """Convert domain + case_name to a published tool name."""
    return case_name


@dataclass
class AgentConfig:
    """Configuration for the agent host."""
    port: int = 3001
    data_directory: str | None = None


def create_registry(config: AgentConfig) -> dict[str, Any]:
    """
    Create the agent registry with _cases, _providers, _packages,
    and AgenticRegistry methods.
    """
    data_pkg = create_data_package(config.data_directory)
    task_store = create_json_file_store(
        data_pkg.default_files["tasks"], fallback_data=[]
    )

    cases_def = {
        "tasks": {
            "task_create": {"api": TaskCreateApi, "agentic": TaskCreateAgentic},
            "task_list": {"api": TaskListApi, "agentic": TaskListAgentic},
            "task_move": {"api": TaskMoveApi, "agentic": TaskMoveAgentic},
        },
    }

    # Lazy import for MCP adapters (avoid circular imports).
    from apps.agent.mcp_stdio import StdioAppMcpAdapter
    from apps.agent.mcp_http import StreamableHttpAppMcpAdapter

    registry: dict[str, Any] = {
        "_cases": cases_def,
        "_providers": {
            "port": config.port,
            "task_store": task_store,
            "mcp_adapters": {
                "stdio": StdioAppMcpAdapter(),
                "http": StreamableHttpAppMcpAdapter(),
            },
        },
        "_packages": {
            "data": data_pkg,
        },
    }

    # ==================================================================
    # AgenticRegistry implementation
    # ==================================================================

    def list_agentic_cases() -> list[AgenticCaseRef]:
        """Return all Cases that have an agentic surface."""
        refs: list[AgenticCaseRef] = []
        for domain_name, domain_cases in cases_def.items():
            for case_name, surfaces in domain_cases.items():
                if "agentic" in surfaces:
                    refs.append(AgenticCaseRef(domain=domain_name, case_name=case_name))
        return refs

    def get_agentic_surface(ref: AgenticCaseRef) -> type[Any]:
        """Return the agentic surface class for a Case reference."""
        return cases_def[ref["domain"]][ref["case_name"]]["agentic"]

    def instantiate_agentic(ref: AgenticCaseRef, ctx: AgenticContext) -> BaseAgenticCase[Any, Any]:
        """Instantiate the agentic surface with context."""
        cls = get_agentic_surface(ref)
        return cls(ctx)

    def build_catalog(ctx: AgenticContext) -> list[AgenticCatalogEntry]:
        """Build the complete agent catalog from registered agentic surfaces."""
        catalog: list[AgenticCatalogEntry] = []
        for ref in list_agentic_cases():
            instance = instantiate_agentic(ref, ctx)
            defn = instance.definition()
            tool = defn.tool
            entry = AgenticCatalogEntry(
                ref=ref,
                discovery={
                    "name": defn.discovery.name,
                    "description": defn.discovery.description,
                    "category": defn.discovery.category,
                    "tags": defn.discovery.tags,
                },
                context={
                    "requires_auth": defn.context.requires_auth,
                    "dependencies": defn.context.dependencies,
                    "constraints": defn.context.constraints,
                },
                prompt={
                    "purpose": defn.prompt.purpose,
                    "when_to_use": defn.prompt.when_to_use,
                    "constraints": defn.prompt.constraints,
                },
                tool={
                    "name": to_published_tool_name(ref["domain"], ref["case_name"]),
                    "description": tool.description,
                    "input_schema": tool.input_schema,
                    "output_schema": tool.output_schema,
                    "is_mutating": tool.is_mutating,
                    "requires_confirmation": tool.requires_confirmation,
                },
            )

            if defn.mcp is not None:
                entry["mcp"] = {
                    "enabled": defn.mcp.enabled,
                    "name": defn.mcp.name,
                    "title": defn.mcp.title,
                    "description": defn.mcp.description,
                }
            if defn.rag is not None:
                entry["rag"] = {
                    "topics": defn.rag.topics,
                    "resources": [
                        {"kind": r.kind, "ref": r.ref, "description": r.description}
                        for r in defn.rag.resources
                    ],
                    "hints": defn.rag.hints,
                    "scope": defn.rag.scope,
                    "mode": defn.rag.mode,
                }
            if defn.policy is not None:
                entry["policy"] = {
                    "require_confirmation": defn.policy.require_confirmation,
                    "risk_level": defn.policy.risk_level,
                    "execution_mode": defn.policy.execution_mode,
                }
            if defn.examples:
                entry["examples"] = [
                    {"name": e.name, "input": e.input, "output": e.output}
                    for e in defn.examples
                ]

            catalog.append(entry)
        return catalog

    def resolve_tool(
        tool_name: str, ctx: AgenticContext
    ) -> BaseAgenticCase[Any, Any] | None:
        """Resolve a tool by published name."""
        for ref in list_agentic_cases():
            published = to_published_tool_name(ref["domain"], ref["case_name"])
            if published == tool_name:
                return instantiate_agentic(ref, ctx)
        return None

    def list_mcp_enabled_tools(ctx: AgenticContext) -> list[BaseAgenticCase[Any, Any]]:
        """Return agentic instances that have MCP enabled."""
        result: list[BaseAgenticCase[Any, Any]] = []
        for ref in list_agentic_cases():
            instance = instantiate_agentic(ref, ctx)
            if instance.is_mcp_enabled():
                result.append(instance)
        return result

    # Attach registry methods.
    registry["list_agentic_cases"] = list_agentic_cases
    registry["get_agentic_surface"] = get_agentic_surface
    registry["instantiate_agentic"] = instantiate_agentic
    registry["build_catalog"] = build_catalog
    registry["resolve_tool"] = resolve_tool
    registry["list_mcp_enabled_tools"] = list_mcp_enabled_tools

    return registry
