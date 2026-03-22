# ==========================================================================
# APP v1.1.4
# core/stream_case.py
# --------------------------------------------------------------------------
# Base contract for the stream surface in APP.
#
# Represents event-driven execution.
#
# Responsibility:
# - consume events
# - process business logic (service) or orchestrate (composition)
# - produce new events or side effects
#
# Used for: queues, webhooks, event bus, async pipelines.
#
# Context:
# - StreamContext extends AppBaseContext with event infrastructure
# - each project defines the concrete types for eventBus, queue, etc.
# ==========================================================================

from __future__ import annotations

import math
import random
import traceback
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Generic, TypeVar

from core.shared.app_base_context import AppBaseContext
from core.shared.app_infra_contracts import AppCache, AppEventPublisher
from core.shared.app_structural_contracts import StreamFailureEnvelope

TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput")


# ==========================================================================
# StreamContext
# ==========================================================================

class StreamContext(AppBaseContext, total=False):
    """Context for the stream surface."""

    # Event publisher (publish side only — consume is in stream surface).
    event_bus: AppEventPublisher

    # Queue access (kept as Any — needs normative note distinguishing from event_bus).
    queue: Any

    # Database access (kept as Any — no stable contract).
    db: Any

    # Cache with optional TTL.
    cache: AppCache

    # Cases loaded by the runtime (for cross-case composition).
    cases: dict[str, Any]

    # Library packages registered by the host.
    packages: dict[str, Any]

    # Free extension space for the host.
    extra: dict[str, Any]


# ==========================================================================
# StreamEvent
# ==========================================================================

@dataclass
class StreamEvent(Generic[TInput]):
    """Generic event structure."""

    type: str
    payload: TInput

    # Idempotency key for at-least-once delivery deduplication.
    idempotency_key: str | None = None

    metadata: dict[str, Any] = field(default_factory=dict)


# ==========================================================================
# AppStreamRecoveryPolicy
# --------------------------------------------------------------------------
# Declarative recovery contract for stream capabilities.
#
# This policy describes intended semantics only.
# The app host is responsible for validating compatibility with the
# chosen runtime and for translating the contract to platform-specific
# configuration.
# ==========================================================================

@dataclass
class AppStreamRetryPolicy:
    """Retry configuration within a recovery policy."""

    # Total number of attempts including the first execution.
    # max_attempts = 1 means fail-fast, no retry.
    max_attempts: int = 1

    backoff_ms: int | None = None
    multiplier: float | None = None
    max_backoff_ms: int | None = None
    jitter: bool = False
    retryable_errors: list[str] | None = None


@dataclass
class AppStreamDeadLetterConfig:
    """Dead-letter configuration within a recovery policy."""

    # Logical dead-letter destination identifier.
    # Must be bound by the app host to a physical transport destination.
    destination: str = ""

    include_failure_metadata: bool = False


@dataclass
class AppStreamRecoveryPolicy:
    """Declarative recovery contract for stream capabilities."""
    retry: AppStreamRetryPolicy | None = None
    dead_letter: AppStreamDeadLetterConfig | None = None


# ==========================================================================
# Recovery policy validation
# --------------------------------------------------------------------------
# Protocol-level shape validation for recovery metadata.
# Host-specific compatibility checks remain the app's responsibility.
# ==========================================================================

def validate_stream_recovery_policy(
    source: str,
    policy: AppStreamRecoveryPolicy | None,
) -> None:
    """Validate canonical APP invariants for a recovery policy."""
    if policy is None:
        return

    label = source or "stream"
    retry = policy.retry
    dead_letter = policy.dead_letter

    if retry is not None:
        if not isinstance(retry.max_attempts, int) or retry.max_attempts < 1:
            raise ValueError(
                f"{label}: recoveryPolicy.retry.max_attempts must be an integer >= 1"
            )
        if retry.backoff_ms is not None and retry.backoff_ms < 0:
            raise ValueError(f"{label}: recoveryPolicy.retry.backoff_ms must be >= 0")
        if retry.multiplier is not None and retry.multiplier < 1:
            raise ValueError(f"{label}: recoveryPolicy.retry.multiplier must be >= 1")
        if retry.max_backoff_ms is not None and retry.max_backoff_ms < 0:
            raise ValueError(f"{label}: recoveryPolicy.retry.max_backoff_ms must be >= 0")
        if (
            retry.backoff_ms is not None
            and retry.max_backoff_ms is not None
            and retry.max_backoff_ms < retry.backoff_ms
        ):
            raise ValueError(
                f"{label}: recoveryPolicy.retry.max_backoff_ms must be >= backoff_ms"
            )
        if retry.retryable_errors is not None and any(
            code.strip() == "" for code in retry.retryable_errors
        ):
            raise ValueError(
                f"{label}: recoveryPolicy.retry.retryable_errors must contain stable non-empty codes"
            )

    if dead_letter is not None and dead_letter.destination.strip() == "":
        raise ValueError(
            f"{label}: recoveryPolicy.dead_letter.destination must be a non-empty logical identifier"
        )


def is_stream_error_retryable(
    error: BaseException,
    retryable_errors: list[str] | None,
) -> bool:
    """Check if an error is retryable given the retryable_errors list."""
    if retryable_errors is None or len(retryable_errors) == 0:
        return True

    code = _extract_stream_error_code(error)
    return code in retryable_errors if code is not None else False


def compute_stream_retry_delay_ms(
    retry: AppStreamRetryPolicy,
    attempt: int,
) -> int:
    """Compute the delay in milliseconds for a retry attempt."""
    base = retry.backoff_ms if retry.backoff_ms is not None else 0
    if base <= 0:
        return 0

    multiplier = retry.multiplier if retry.multiplier is not None else 1.0
    exponent = max(0, attempt - 1)
    delay = base * math.pow(multiplier, exponent)

    if retry.max_backoff_ms is not None:
        delay = min(delay, retry.max_backoff_ms)

    if retry.jitter and delay > 0:
        delay = random.random() * delay

    return int(delay)


def create_stream_failure_envelope(
    case_name: str,
    event: StreamEvent[Any],
    error: BaseException,
    attempts: int,
    correlation_id: str,
    first_attempt_at: str,
    last_attempt_at: str,
) -> StreamFailureEnvelope[StreamEvent[Any]]:
    """Create a dead-letter failure envelope."""
    code = _extract_stream_error_code(error)
    message = str(error) if isinstance(error, Exception) else "Unknown stream failure"
    stack = traceback.format_exception(error) if isinstance(error, Exception) else None

    return StreamFailureEnvelope(
        case_name=case_name,
        surface="stream",
        original_event=event,
        last_error_message=message,
        last_error_code=code,
        last_error_stack="".join(stack) if stack else None,
        attempts=attempts,
        first_attempt_at=first_attempt_at,
        last_attempt_at=last_attempt_at,
        correlation_id=correlation_id,
    )


def _extract_stream_error_code(error: BaseException) -> str | None:
    """Extract a code attribute from an error, if present."""
    code = getattr(error, "code", None)
    return code if isinstance(code, str) else None


# ==========================================================================
# BaseStreamCase
# ==========================================================================

class BaseStreamCase(ABC, Generic[TInput, TOutput]):
    """Base class for event-driven stream surfaces in APP."""

    def __init__(self, ctx: StreamContext) -> None:
        self.ctx = ctx

    # ==================================================================
    # Required methods
    # ==================================================================

    @abstractmethod
    def handler(self, event: StreamEvent[TInput]) -> None:
        """
        Main event handler.

        Receives a business event and processes it.
        Transport bindings (topic subscriptions, queue listeners)
        live in subscribe() or in the adapter/host.
        """
        ...

    def subscribe(self) -> Any:
        """Subscription registration. Declarative binding."""
        return None

    def recovery_policy(self) -> AppStreamRecoveryPolicy | None:
        """
        Declarative recovery contract.

        Must be deterministic, serializable, free of callbacks,
        and independent of the event payload.
        The app host validates and translates this policy to the real runtime.
        """
        return None

    def test(self) -> None:
        """Self-contained stream surface test."""

    # ==================================================================
    # Canonical internal slots
    # ==================================================================

    def _repository(self) -> Any:
        """Persistence and local integrations (idempotency, checkpoints)."""
        return None

    def _composition(self, event: StreamEvent[TInput]) -> None:
        """
        Cross-case orchestration via registry (composed Case).

        When present, pipeline() uses _composition as the main center.
        """

    def _consume(self, event: StreamEvent[TInput]) -> TInput:
        """Initial event consumption."""
        return event.payload

    def _service(self, input: TInput) -> TOutput | None:
        """Atomic business logic for the stream."""
        return None

    def _publish(self, output: TOutput) -> None:
        """Publish a resulting event."""

    # ==================================================================
    # Pipeline
    # ==================================================================

    def pipeline(self, event: StreamEvent[TInput]) -> None:
        """
        Default execution pipeline.

        If _composition is overridden, delegates to it (composed Case).
        Otherwise, orchestrates the atomic flow: consume -> service -> publish.

        The default pipeline does not implement retry, backoff, or dead-letter.
        Recovery is the app host/runtime's responsibility when recovery_policy()
        is declared.
        """
        # Check if _composition was overridden from the base no-op
        if type(self)._composition is not BaseStreamCase._composition:
            self._composition(event)
            return

        consumed = self._consume(event)

        transformed = self._service(consumed)

        if transformed is not None:
            self._publish(transformed)
