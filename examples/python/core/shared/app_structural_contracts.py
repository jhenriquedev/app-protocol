# ==========================================================================
# APP v1.1.4
# core/shared/app_structural_contracts.py
# --------------------------------------------------------------------------
# Structural contracts that cross all surfaces.
#
# Unlike infrastructure contracts (which model external capabilities),
# structural contracts define canonical data shapes used across the protocol:
# - errors
# - results (success/failure wrappers)
# - pagination
# - stream failure envelopes
#
# These shapes are intentionally minimal. Host projects may extend them
# with additional fields, but the base contracts provide enough structure
# for tooling, adapters, and agents to operate without casting.
# ==========================================================================

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Generic, TypeVar

T = TypeVar("T")
TEvent = TypeVar("TEvent")


# ==========================================================================
# AppError
# --------------------------------------------------------------------------
# Protocol-level structured error.
#
# Every surface that produces errors (API handler, stream handler,
# agentic tool) can use this shape for consistent error representation.
#
# - code:    programmatic identifier (e.g. "VALIDATION_FAILED", "NOT_FOUND")
# - message: human-readable description
# - details: optional payload for debugging or downstream consumption
# ==========================================================================

@dataclass(frozen=True)
class AppError:
    """Protocol-level structured error."""

    # Stable, uppercase programmatic identifier.
    code: str

    # Human-readable error description.
    message: str

    # Optional structured payload for debugging.
    details: Any = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a plain dict for JSON responses."""
        result: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details is not None:
            result["details"] = self.details
        return result


# ==========================================================================
# AppCaseError
# --------------------------------------------------------------------------
# Throwable error class that implements the AppError contract.
#
# Every surface should raise AppCaseError instead of plain Exception when
# the error represents a business or protocol failure (validation,
# authorization, not found, conflict, etc.).
#
# Common codes:
# - VALIDATION_FAILED — input does not satisfy domain rules
# - UNAUTHORIZED     — caller lacks required permissions
# - NOT_FOUND        — requested resource does not exist
# - CONFLICT         — operation conflicts with current state
# - COMPOSITION_FAILED — cross-case composition error
# - INTERNAL         — unexpected internal error
# ==========================================================================

class AppCaseError(Exception):
    """Throwable business/protocol error with structured code + message."""

    def __init__(self, code: str, message: str, details: Any = None) -> None:
        super().__init__(message)
        self.code = code
        self.details = details

    def to_app_error(self) -> AppError:
        """Convert to the immutable AppError shape."""
        return AppError(code=self.code, message=str(self), details=self.details)


def to_app_case_error(error: AppError | None, fallback_message: str) -> AppCaseError:
    """Convert an AppError (or None) into a throwable AppCaseError."""
    if error is not None:
        return AppCaseError(error.code, error.message, error.details)
    return AppCaseError("INTERNAL", fallback_message)


# ==========================================================================
# AppResult
# --------------------------------------------------------------------------
# Canonical result wrapper for success/failure representation.
#
# The success flag enables quick branching without inspecting data/error:
# - success: True  -> data is present
# - success: False -> error is present
# ==========================================================================

@dataclass
class AppResult(Generic[T]):
    """Canonical success/failure result wrapper."""

    success: bool
    data: T | None = None
    error: AppError | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a plain dict for JSON responses."""
        result: dict[str, Any] = {"success": self.success}
        if self.data is not None:
            result["data"] = self.data
        if self.error is not None:
            result["error"] = self.error.to_dict()
        return result


# ==========================================================================
# StreamFailureEnvelope
# --------------------------------------------------------------------------
# Canonical dead-letter payload shape for stream failures.
#
# Structural, not transport-specific. Apps may enrich it, but the minimum
# shape remains stable so tooling and hosts can reason about dead-letter events.
# ==========================================================================

@dataclass
class StreamFailureEnvelope(Generic[TEvent]):
    """Dead-letter envelope for stream processing failures."""

    case_name: str
    surface: str  # Fixed to "stream"
    original_event: TEvent

    last_error_message: str
    last_error_code: str | None = None
    last_error_stack: str | None = None

    attempts: int = 0
    first_attempt_at: str = ""
    last_attempt_at: str = ""
    correlation_id: str = ""


# ==========================================================================
# AppPaginationParams / AppPaginatedResult
# --------------------------------------------------------------------------
# Supports both offset-based (page/limit) and cursor-based pagination.
# ==========================================================================

@dataclass
class AppPaginationParams:
    """Pagination input parameters."""

    page: int | None = None
    limit: int | None = None
    cursor: str | None = None


@dataclass
class AppPaginatedResult(Generic[T]):
    """Paginated result wrapper."""

    items: list[T] = field(default_factory=list)
    total: int | None = None
    page: int | None = None
    limit: int | None = None
    cursor: str | None = None
    has_more: bool | None = None
