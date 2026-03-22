# ==========================================================================
# APP v1.1.3
# core/shared/app_base_context.py
# --------------------------------------------------------------------------
# Base context shared across all APP surfaces.
#
# This contract defines the minimum that any surface may need:
# execution identity, user identity, and observability.
#
# Each surface extends this context with its specific needs:
# - ApiContext   -> http, db, auth
# - UiContext    -> framework renderer, client router, store
# - StreamContext -> eventBus, queue adapters, recovery metadata
# - AgenticContext -> cases registry, MCP runtime
#
# domain_case.py does not receive context — it is pure by definition.
#
# Design decisions:
#
# 1. correlation_id is the identity of the complete operation.
#    A request that enters via the API, fires an event in the stream,
#    triggers an agent that calls another Case — all carry the same
#    correlation_id. Equivalent to traceId in OpenTelemetry.
#
# 2. execution_id is the identity of each step within the operation.
#    Optional — not every execution needs step-level granularity.
#
# 3. Only cross-cutting information lives here.
#    Infrastructure specific to each surface belongs in its own context.
# ==========================================================================

from __future__ import annotations

from typing import Any, Protocol, TypedDict


# ==========================================================================
# Logger contract
# --------------------------------------------------------------------------
# Minimal observability contract.
#
# Every logger in APP must implement this protocol.
# Concrete implementations may extend with additional levels,
# structured logging, or observability platform integration.
# ==========================================================================

class AppLogger(Protocol):
    """Minimal APP logger contract."""

    def debug(self, message: str, meta: dict[str, Any] | None = None) -> None: ...
    def info(self, message: str, meta: dict[str, Any] | None = None) -> None: ...
    def warn(self, message: str, meta: dict[str, Any] | None = None) -> None: ...
    def error(self, message: str, meta: dict[str, Any] | None = None) -> None: ...


# ==========================================================================
# AppBaseContext
# --------------------------------------------------------------------------
# Base context shared by all surfaces that receive context.
#
# Intentionally lean — carries only what is genuinely cross-cutting:
# - traceability (correlation_id, execution_id)
# - identity (tenant_id, user_id)
# - observability (logger)
# - configuration (config)
# ==========================================================================

class AppBaseContext(TypedDict, total=False):
    """Base context for all APP surfaces."""

    # Identity of the complete operation (required).
    correlation_id: str  # type: ignore[reportGeneralTypeIssues]

    # Identity of the current step within the operation.
    execution_id: str

    # Tenant identifier (optional — not every system is multi-tenant).
    tenant_id: str

    # Authenticated user identifier.
    user_id: str

    # Canonical APP logger (required).
    logger: AppLogger  # type: ignore[reportGeneralTypeIssues]

    # Host configuration — free space for runtime config, feature flags, etc.
    config: dict[str, Any]
