/* ========================================================================== *
 * APP v1.1.6
 * core/stream.case.ts
 * ----------------------------------------------------------------------------
 * Base contract for the APP stream surface.
 *
 * Represents event-driven execution.
 *
 * Responsibility:
 * - consume events
 * - process business logic (service) or orchestrate (composition)
 * - produce new events or side effects
 *
 * Used for:
 * - queues
 * - webhooks
 * - event bus
 * - asynchronous pipelines
 *
 * Context:
 * - StreamContext extends AppBaseContext with event infrastructure
 * - each project defines the concrete types for eventBus, queue, etc.
 * ========================================================================== */

import { Dict } from "./domain.case";
import { AppBaseContext } from "./shared/app_base_context";
import { StreamFailureEnvelope } from "./shared/app_structural_contracts";
import { AppCache, AppEventPublisher } from "./shared/app_infra_contracts";

/* ==========================================================================
 * StreamContext
 * --------------------------------------------------------------------------
 * Stream surface-specific context.
 *
 * Extends AppBaseContext with event infrastructure:
 * - eventBus: event publisher (publish side only — consume lives in the stream surface)
 * - queue: queue access (unknown — needs a normative note distinguishing it from eventBus)
 * - db: database access (unknown — no stable contract)
 * - cache: cache with TTL
 *
 * Fields with a minimum contract use interfaces from app_infra_contracts.ts.
 * Fields without stable semantics remain unknown.
 * ========================================================================== */

export interface StreamContext extends AppBaseContext {
  /**
   * Event publisher.
   *
   * Covers the publish side of event-driven communication.
   * The consume/subscribe side is modeled by BaseStreamCase.subscribe().
   *
   * Examples: Kafka producer, RabbitMQ channel, Redis Pub/Sub publisher.
   */
  eventBus?: AppEventPublisher;

  /**
   * Queue access.
   *
   * Kept as unknown — it is too close to eventBus and needs
   * a normative note distinguishing it before receiving a minimum contract.
   *
   * Examples: SQS client, BullMQ queue, Cloud Tasks.
   */
  queue?: unknown;

  /**
   * Database access.
   *
   * Kept as unknown — no stable contract.
   * Useful for: idempotency, checkpoints, pipeline state.
   */
  db?: unknown;

  /**
   * Cache with optional TTL.
   *
   * Useful for: deduplication, retry control, processing windows.
   */
  cache?: AppCache;

  /**
   * Registry of Cases loaded by the runtime.
   *
   * Allows cross-case composition through the registry boundary.
   * Used by `_composition` to resolve capabilities from other Cases.
   *
   * Example: ctx.cases?.users?.user_validate?.api?.handler(input)
   */
  cases?: Dict;

  /**
   * Library packages registered by the host.
   *
   * Exposed through registry._packages.
   * Pure libraries from packages/ that the app makes available.
   */
  packages?: Dict;

  /**
   * Free extension space for the project host.
   */
  extra?: Dict;
}

/* ==========================================================================
 * StreamEvent
 * ========================================================================== */

/**
 * Generic event structure.
 */
export interface StreamEvent<T = unknown> {
  type: string;
  payload: T;

  /**
   * Event idempotency key.
   *
   * Allows consumers to detect and discard duplicate events.
   * Essential for production with brokers that guarantee at-least-once
   * delivery (SQS, Kafka, RabbitMQ, EventBridge).
   *
   * The protocol does not dictate the format — it may be a UUID, payload hash,
   * or composed business key. Responsibility for generating and
   * verifying the key belongs to the producer and consumer respectively.
   */
  idempotencyKey?: string;

  metadata?: Record<string, unknown>;
}

/* ==========================================================================
 * AppStreamRecoveryPolicy
 * --------------------------------------------------------------------------
 * Declarative recovery contract for stream capabilities.
 *
 * This policy describes intended semantics only.
 * The app host is responsible for validating compatibility with the
 * chosen runtime and for translating the contract to platform-specific
 * configuration.
 * ========================================================================== */

export interface AppStreamRecoveryPolicy {
  retry?: {
    /**
     * Total number of attempts, including the first execution.
     *
     * maxAttempts: 1 = fail-fast, no retry.
     */
    maxAttempts: number;
    backoffMs?: number;
    multiplier?: number;
    maxBackoffMs?: number;
    jitter?: boolean;
    retryableErrors?: string[];
  };

  deadLetter?: {
    /**
     * Logical dead-letter destination identifier.
     *
     * Must be bound by the app host to a physical transport destination.
     */
    destination: string;
    includeFailureMetadata?: boolean;
  };
}

export interface AppStreamDeadLetterBinding<TEvent = unknown> {
  publish(envelope: StreamFailureEnvelope<StreamEvent<TEvent>>): Promise<void>;
}

export interface AppStreamRuntimeCapabilities {
  maxAttemptsLimit?: number;
  supportsJitter?: boolean;
  deadLetters?: Dict<AppStreamDeadLetterBinding>;
}

/* ==========================================================================
 * Policy validation
 * --------------------------------------------------------------------------
 * Protocol-level shape validation for recovery metadata.
 *
 * This validates the canonical APP invariants that are independent of any
 * specific runtime. Host-specific compatibility checks (DLQ bindings,
 * jitter support, attempt limits, etc.) remain the app's responsibility.
 * ========================================================================== */

export function validateStreamRecoveryPolicy(
  source: string,
  policy?: AppStreamRecoveryPolicy,
): void {
  if (!policy) return;

  const label = source || "stream";
  const retry = policy.retry;
  const deadLetter = policy.deadLetter;

  if (retry) {
    if (!Number.isInteger(retry.maxAttempts) || retry.maxAttempts < 1) {
      throw new Error(
        `${label}: recoveryPolicy.retry.maxAttempts must be an integer >= 1`,
      );
    }

    if (retry.backoffMs !== undefined && retry.backoffMs < 0) {
      throw new Error(`${label}: recoveryPolicy.retry.backoffMs must be >= 0`);
    }

    if (retry.multiplier !== undefined && retry.multiplier < 1) {
      throw new Error(`${label}: recoveryPolicy.retry.multiplier must be >= 1`);
    }

    if (retry.maxBackoffMs !== undefined && retry.maxBackoffMs < 0) {
      throw new Error(
        `${label}: recoveryPolicy.retry.maxBackoffMs must be >= 0`,
      );
    }

    if (
      retry.backoffMs !== undefined &&
      retry.maxBackoffMs !== undefined &&
      retry.maxBackoffMs < retry.backoffMs
    ) {
      throw new Error(
        `${label}: recoveryPolicy.retry.maxBackoffMs must be >= backoffMs`,
      );
    }

    if (
      retry.retryableErrors?.some((code) => code.trim().length === 0)
    ) {
      throw new Error(
        `${label}: recoveryPolicy.retry.retryableErrors must contain stable non-empty codes`,
      );
    }
  }

  if (deadLetter && deadLetter.destination.trim().length === 0) {
    throw new Error(
      `${label}: recoveryPolicy.deadLetter.destination must be a non-empty logical identifier`,
    );
  }
}

export function validateStreamRuntimeCompatibility(
  source: string,
  policy: AppStreamRecoveryPolicy | undefined,
  runtime: AppStreamRuntimeCapabilities,
): void {
  if (!policy) return;

  const label = source || "stream";
  const retry = policy.retry;
  const deadLetter = policy.deadLetter;

  if (
    retry?.maxAttempts !== undefined &&
    runtime.maxAttemptsLimit !== undefined &&
    retry.maxAttempts > runtime.maxAttemptsLimit
  ) {
    throw new Error(
      `${label}: recoveryPolicy.retry.maxAttempts=${retry.maxAttempts} exceeds host limit ${runtime.maxAttemptsLimit}`,
    );
  }

  if (retry?.jitter && runtime.supportsJitter === false) {
    throw new Error(
      `${label}: recoveryPolicy.retry.jitter=true but host runtime does not support jitter`,
    );
  }

  if (
    deadLetter &&
    !runtime.deadLetters?.[deadLetter.destination]
  ) {
    throw new Error(
      `${label}: dead-letter destination "${deadLetter.destination}" is not bound by the host app`,
    );
  }
}

export function isStreamErrorRetryable(
  error: unknown,
  retryableErrors?: string[],
): boolean {
  if (!retryableErrors || retryableErrors.length === 0) {
    return true;
  }

  const code = extractStreamErrorCode(error);
  return code ? retryableErrors.includes(code) : false;
}

export function computeStreamRetryDelayMs(
  retry: NonNullable<AppStreamRecoveryPolicy["retry"]>,
  attempt: number,
): number {
  const base = retry.backoffMs ?? 0;
  if (base <= 0) return 0;

  const multiplier = retry.multiplier ?? 1;
  const exponent = Math.max(0, attempt - 1);
  let delay = base * Math.pow(multiplier, exponent);

  if (retry.maxBackoffMs !== undefined) {
    delay = Math.min(delay, retry.maxBackoffMs);
  }

  if (retry.jitter && delay > 0) {
    delay = Math.floor(Math.random() * delay);
  }

  return Math.floor(delay);
}

export function createStreamFailureEnvelope<TEvent>(
  caseName: string,
  event: StreamEvent<TEvent>,
  error: unknown,
  attempts: number,
  correlationId: string,
  firstAttemptAt: string,
  lastAttemptAt: string,
): StreamFailureEnvelope<StreamEvent<TEvent>> {
  const code = extractStreamErrorCode(error);
  const message = error instanceof Error
    ? error.message
    : "Unknown stream failure";
  const stack = error instanceof Error ? error.stack : undefined;

  return {
    caseName,
    surface: "stream",
    originalEvent: event,
    lastError: {
      message,
      ...(code !== undefined && { code }),
      ...(stack !== undefined && { stack }),
    },
    attempts,
    firstAttemptAt,
    lastAttemptAt,
    correlationId,
  };
}

function extractStreamErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return undefined;
}

/* ==========================================================================
 * BaseStreamCase
 * ========================================================================== */

/**
 * Base class for event-driven execution.
 */
export abstract class BaseStreamCase<TInput = unknown, TOutput = unknown> {
  protected readonly ctx: StreamContext;

  constructor(ctx: StreamContext) {
    this.ctx = ctx;
  }

  /* =======================================================================
   * Required methods
   * ===================================================================== */

  /**
   * Primary event handler.
   *
   * handler is the public entrypoint of the stream capability.
   * It receives a business event and processes it.
   *
   * Transport bindings (topic subscriptions, queue listeners)
   * live in subscribe() or in the adapter/host.
   */
  public abstract handler(event: StreamEvent<TInput>): Promise<void>;

  /**
   * Subscription registration.
   */
  public subscribe?(): unknown;

  /**
   * Contractual recovery declaration.
   *
   * The return value must be pure metadata:
   * - deterministic
   * - serializable
   * - without callbacks
   * - independent from the event payload
   *
   * The app host validates and translates this policy to the real runtime.
   */
  public recoveryPolicy?(): AppStreamRecoveryPolicy;

  /**
   * Internal capability test.
   *
   * Recommended APP practice — surfaces should ideally expose a
   * test() method for self-contained contract validation.
   *
   * Canonical signature: test(): Promise<void>
   * The test creates events internally and invokes handler()/pipeline().
   * It receives no input — it is internal validation.
   */
  public async test(): Promise<void> {}

  /* =======================================================================
   * Internal canonical slots
   * ===================================================================== */

  /**
   * Access to persistence and local integrations for the Case.
   *
   * Canonical slot for idempotency, checkpoints, and pipeline state.
   *
   * Rule: _repository must not perform cross-case composition.
   */
  protected _repository?(): unknown;

  /**
   * Cross-case orchestration via the registry (composed Case).
   *
   * Canonical slot for stream Cases that need to invoke other Cases.
   * Resolves capabilities through ctx.cases, never through direct imports.
   *
   * When present, the pipeline must use _composition as the main center.
   */
  protected async _composition?(event: StreamEvent<TInput>): Promise<void>;

  /* =======================================================================
   * Internal hooks
   * ===================================================================== */

  /**
   * Initial event consumption.
   */
  protected async _consume?(event: StreamEvent<TInput>): Promise<TInput>;

  /**
   * Atomic stream business logic (atomic Case).
   *
   * Canonical slot for processing the consumed event.
   * It receives input, processes it, and produces output.
   *
   * Mutually exclusive with _composition as the main execution center.
   */
  protected async _service?(input: TInput): Promise<TOutput>;

  /**
   * Resulting event publication.
   */
  protected async _publish?(output: TOutput): Promise<void>;

  /**
   * Standard execution pipeline.
   *
   * If _composition is defined, it delegates to it (composed Case).
   * Otherwise, it orchestrates the atomic flow: consume → service → publish.
   *
   * The default pipeline does not implement retry, backoff, or dead-letter.
   * Recovery is the responsibility of the app host/runtime when recoveryPolicy()
   * is declared.
   */
  protected async pipeline(event: StreamEvent<TInput>): Promise<void> {
    if (this._composition) {
      await this._composition(event);
      return;
    }

    const consumed = this._consume ? await this._consume(event) : event.payload;

    const transformed = this._service
      ? await this._service(consumed)
      : (consumed as unknown as TOutput);

    if (this._publish) {
      await this._publish(transformed);
    }
  }
}
