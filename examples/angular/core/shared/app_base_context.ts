/* ========================================================================== *
 * APP v1.1.1
 * core/shared/app_base_context.ts
 * ----------------------------------------------------------------------------
 * Shared APP base context.
 *
 * This contract defines the minimum any surface may need:
 * execution identity, user identity, and observability.
 *
 * Each surface extends this context with its specific needs:
 * - ApiContext   → http, db, auth
 * - UiContext    → framework renderer, client router, store
 * - StreamContext → eventBus, queue adapters, retry
 * - AgenticContext → cases registry, MCP runtime
 *
 * domain.case.ts does not receive context — it is pure by definition.
 *
 * Design decisions:
 *
 * 1. correlationId is the identity of the full operation.
 *    A request entering through the API, emitting an event to the stream,
 *    triggering an agent that calls another Case — all of it carries the same
 *    correlationId. It is equivalent to traceId in OpenTelemetry.
 *    If not provided by the caller, it must be generated automatically.
 *
 * 2. executionId is the identity of each step within the operation.
 *    When the API validates input, that is one execution. When the stream
 *    consumes the resulting event, that is another execution. All executions
 *    share the same correlationId, but each has its own executionId.
 *    It is optional — not every execution needs step-level granularity.
 *
 * 3. Only cross-cutting information lives here.
 *    Specific infrastructure (http, db, eventBus, renderer)
 *    belongs in each surface's own context.
 * ========================================================================== */

import { Dict } from "../domain.case";

/* ==========================================================================
 * Logger contract
 * --------------------------------------------------------------------------
 * Minimum observability contract.
 *
 * Every logger in APP must implement this interface.
 * Concrete implementations may extend it with additional levels,
 * structured logging, or integration with observability platforms.
 *
 * meta accepts Dict to allow contextual fields such as:
 * - correlationId (automatically injected by the runtime)
 * - executionId
 * - caseName
 * - surface
 * ========================================================================== */

export interface AppLogger {
  debug(message: string, meta?: Dict): void;
  info(message: string, meta?: Dict): void;
  warn(message: string, meta?: Dict): void;
  error(message: string, meta?: Dict): void;
}

/* ==========================================================================
 * AppBaseContext
 * --------------------------------------------------------------------------
 * Base context shared by all surfaces that receive context.
 *
 * This contract is intentionally lean.
 * It carries only what is genuinely cross-cutting:
 * - traceability (correlationId, executionId)
 * - identity (tenantId, userId)
 * - observability (logger)
 * - configuration (config)
 *
 * Everything infrastructure-specific belongs to the context
 * of the corresponding surface (ApiContext, UiContext, etc.).
 * ========================================================================== */

export interface AppBaseContext {
  /**
   * Identity of the full operation.
   *
   * All surfaces, Cases, and boundaries participating in the same
   * operation must share the same correlationId.
   *
   * Equivalente ao traceId no OpenTelemetry.
   *
   * If not provided by the caller, the runtime must generate it automatically
   * (UUID v4 or an equivalent format).
   */
  correlationId: string;

  /**
   * Identity of the current step within the operation.
   *
   * Each surface or execution step may generate its own executionId
   * to allow granular tracing within the same operation.
   *
   * Optional — not every execution needs step-level granularity.
   */
  executionId?: string;

  /**
   * Tenant identifier.
   *
   * Optional — not every system is multi-tenant.
   */
  tenantId?: string;

  /**
   * Authenticated user identifier.
   *
   * Optional — not every operation requires authentication.
   */
  userId?: string;

  /**
   * Canonical APP logger.
   *
   * Required — every surface that receives context must have
   * access to observability.
   *
   * Implementations are encouraged to inject correlationId
   * and executionId automatically into each log entry.
   */
  logger: AppLogger;

  /**
   * Host configuration.
   *
   * Free space for the project to inject runtime configuration,
   * feature flags, or environment parameters.
   */
  config?: Dict;
}
