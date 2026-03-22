# ==========================================================================
# APP v1.1.4
# core/api_case.py
# --------------------------------------------------------------------------
# Base contract for the API surface in APP.
#
# Responsibility:
# - expose a capability via a backend interface (HTTP, RPC, CLI, etc.)
# - orchestrate validation, authorization, and execution
# - return a structured response
#
# Fundamental rule:
# - domain logic belongs in domain_case.py
# - persistence or integration must be encapsulated in private methods
#
# Context:
# - ApiContext extends AppBaseContext with backend infrastructure
# - each project defines the concrete types for http, db, auth, etc.
# ==========================================================================

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

from core.shared.app_base_context import AppBaseContext
from core.shared.app_infra_contracts import (
    AppCache,
    AppHttpClient,
    AppStorageClient,
)
from core.shared.app_structural_contracts import (
    AppCaseError,
    AppError,
    AppResult,
)

TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput")


# ==========================================================================
# ApiContext
# --------------------------------------------------------------------------
# Context specific to the API surface.
#
# Extends AppBaseContext with backend infrastructure:
# - http_client: outbound HTTP client
# - db: database access (Any — no stable contract)
# - auth: authentication and authorization (Any — domain semantics)
# - storage: persistent storage client
# - cache: cache with TTL
# - cases: Cases loaded by the runtime (for cross-case composition)
# - packages: library packages registered by the host
# ==========================================================================

class ApiContext(AppBaseContext, total=False):
    """Context for the API surface."""

    http_client: AppHttpClient
    db: Any
    auth: Any
    storage: AppStorageClient
    cache: AppCache
    cases: dict[str, Any]
    packages: dict[str, Any]
    extra: dict[str, Any]


# ==========================================================================
# ApiResponse
# --------------------------------------------------------------------------
# Extends AppResult with API-specific metadata.
# ==========================================================================

@dataclass
class ApiResponse(AppResult[TOutput], Generic[TOutput]):
    """API response with optional HTTP status code hint."""

    # HTTP status code hint. The runtime/adapter may use this.
    status_code: int | None = None


# ==========================================================================
# BaseApiCase
# ==========================================================================

class BaseApiCase(ABC, Generic[TInput, TOutput]):
    """Base class for API surfaces in APP."""

    def __init__(self, ctx: ApiContext) -> None:
        self.ctx = ctx

    # ==================================================================
    # Required methods
    # ==================================================================

    @abstractmethod
    def handler(self, input: TInput) -> ApiResponse[TOutput]:
        """
        Main capability handler.

        Receives business input and returns a business result.
        NOT an HTTP endpoint — transport bindings live in router().

        Should: validate, authorize, execute, return structured response.
        """
        ...

    def router(self) -> Any:
        """
        Optional transport bindings.

        Where the Case declares its transport surface (HTTP, gRPC, CLI).
        The router delegates to handler(), never contains business logic.
        The host/adapter collects router() from each Case to mount routes.

        Return type is framework-specific.
        """
        return None

    def test(self) -> None:
        """
        Self-contained API surface test.

        Canonical signature: test() -> None
        Invokes handler() internally and makes assertions.
        """

    # ==================================================================
    # Protected hooks (optional)
    # ==================================================================

    def _validate(self, input: TInput) -> None:
        """Validate input before execution."""

    def _authorize(self, input: TInput) -> None:
        """Check authorization."""

    def _repository(self) -> Any:
        """
        Persistence and local integrations.

        Canonical slot for queries, mutations, cache reads, and calls
        to external infrastructure services.

        Rule: _repository does not perform cross-case composition.
        """
        return None

    def _service(self, input: TInput) -> TOutput | None:
        """
        Main execution logic (atomic Case).

        Canonical slot for business logic that does not involve
        cross-case orchestration. Mutually exclusive with _composition
        as the main execution center.
        """
        return None

    def _composition(self, input: TInput) -> TOutput | None:
        """
        Cross-case orchestration via registry (composed Case).

        Canonical slot for Cases that need to invoke other Cases.
        Resolves capabilities via ctx.cases, never by direct import.

        Mutually exclusive with _service as the main execution center.
        """
        return None

    # ==================================================================
    # Execution pipeline utility
    # ==================================================================

    def execute(self, input: TInput) -> ApiResponse[TOutput]:
        """
        Standard execution pipeline.

        Orchestrates: validate -> authorize -> (composition | service).

        If _composition returns non-None, it is the execution center (composed).
        Otherwise, _service is used (atomic).
        """
        try:
            self._validate(input)
            self._authorize(input)

            composition_result = self._composition(input)
            if composition_result is not None:
                return ApiResponse(success=True, data=composition_result)

            service_result = self._service(input)
            if service_result is not None:
                return ApiResponse(success=True, data=service_result)

            raise AppCaseError(
                "INTERNAL",
                "BaseApiCase: at least one of _service or _composition must be implemented",
            )
        except AppCaseError as err:
            return ApiResponse(success=False, error=err.to_app_error())
