# ==========================================================================
# APP v1.1.3
# core/shared/app_host_contracts.py
# --------------------------------------------------------------------------
# APP registry contracts.
#
# Define the minimal interface for:
# - AppCaseSurfaces: the surfaces available for a Case within a registry
# - AppRegistry: the catalog of Cases and surfaces that an app loads
# - AgenticRegistry: extended registry for agent hosts with agentic surfaces
#
# Each app in apps/ uses these contracts:
# - registry.py exports a registry
# - app.py consumes the registry to assemble the runtime
#
# The protocol defines the shape, not the content:
# - which Cases and surfaces to load is each app's decision
# - how to assemble the runtime is the project's decision
# - the framework is the project's decision
# ==========================================================================

from __future__ import annotations

from typing import Any, Protocol, TypedDict


# ==========================================================================
# AppCaseSurfaces
# --------------------------------------------------------------------------
# Describes the surfaces available for a Case within a registry.
#
# Each key is a canonical surface and the value is the class (constructor).
# Only the surfaces that the app needs are registered.
#
# Example:
#   {"api": UserValidateApi}                — backend only
#   {"ui": UserValidateUi}                  — frontend only
#   {"api": UserRegisterApi, "stream": UserRegisterStream}  — backend + stream
# ==========================================================================

class AppCaseSurfaces(TypedDict, total=False):
    """Surfaces available for a Case within a registry."""
    domain: type[Any]
    api: type[Any]
    ui: type[Any]
    stream: type[Any]
    agentic: type[Any]


# ==========================================================================
# AppRegistry
# --------------------------------------------------------------------------
# Unified registration interface for an app.
#
# Three canonical slots:
#
# - _cases:     Active Cases in this app (domain -> case -> surfaces).
# - _providers: Infrastructure adapters (packages/ -> core/ contracts).
# - _packages:  Pure shared libraries from packages/.
#               Exposed to Cases via ctx.packages.
# ==========================================================================

class AppRegistry(TypedDict, total=False):
    """Unified app registry with Cases, providers, and packages."""

    # Active Cases: domain -> case_name -> surfaces (constructors).
    _cases: dict[str, dict[str, AppCaseSurfaces]]  # type: ignore[reportGeneralTypeIssues]

    # Infrastructure providers (adapters satisfying core/ contracts).
    _providers: dict[str, Any]

    # Shared library packages from packages/.
    _packages: dict[str, Any]


# ==========================================================================
# AgenticRegistry
# --------------------------------------------------------------------------
# Extended registry protocol for agent hosts.
#
# Provides structured access to agentic surfaces for catalog building,
# tool resolution, and MCP publication.
# ==========================================================================

class AgenticCaseRef(TypedDict):
    """Reference to an agentic Case within the registry."""
    domain: str
    case_name: str


class AgenticCatalogEntry(TypedDict, total=False):
    """Entry in the agent catalog built from the registry."""
    ref: AgenticCaseRef
    discovery: dict[str, Any]
    context: dict[str, Any]
    prompt: dict[str, Any]
    tool: dict[str, Any]
    mcp: dict[str, Any] | None
    rag: dict[str, Any] | None
    policy: dict[str, Any] | None
    examples: list[dict[str, Any]]


class AgenticRegistry(Protocol):
    """Protocol for agent host registries with agentic surface access."""

    def list_agentic_cases(self) -> list[AgenticCaseRef]:
        """Return all Cases that have an agentic surface registered."""
        ...

    def get_agentic_surface(self, ref: AgenticCaseRef) -> type[Any]:
        """Return the agentic surface class for the given Case reference."""
        ...

    def instantiate_agentic(self, ref: AgenticCaseRef, ctx: Any) -> Any:
        """Instantiate the agentic surface for the given Case with context."""
        ...

    def build_catalog(self, ctx: Any) -> list[AgenticCatalogEntry]:
        """Build the complete agent catalog from all registered agentic surfaces."""
        ...

    def resolve_tool(self, tool_name: str, ctx: Any) -> Any | None:
        """Resolve a tool by published name. Returns the agentic instance or None."""
        ...

    def list_mcp_enabled_tools(self, ctx: Any) -> list[Any]:
        """Return agentic instances that have MCP enabled."""
        ...
