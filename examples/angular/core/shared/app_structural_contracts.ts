/* ========================================================================== *
 * APP v1.1.0
 * core/shared/app_structural_contracts.ts
 * ----------------------------------------------------------------------------
 * Structural contracts that cross all surfaces.
 *
 * Unlike infrastructure contracts (which model external capabilities),
 * structural contracts define canonical data shapes used across the protocol:
 * - errors
 * - results (success/failure wrappers)
 * - pagination
 *
 * These shapes are intentionally minimal. Host projects may extend them
 * with additional fields, but the base contracts provide enough structure
 * for tooling, adapters, and agents to operate without casting.
 * ========================================================================== */

/* ==========================================================================
 * AppError
 * --------------------------------------------------------------------------
 * Protocol-level structured error.
 *
 * Every surface that produces errors (API handler, stream handler,
 * agentic tool) can use this shape for consistent error representation.
 *
 * - code:    programmatic identifier (e.g. "VALIDATION_FAILED", "NOT_FOUND")
 * - message: human-readable description
 * - details: optional payload for debugging or downstream consumption
 *
 * This shape is convergent across stacks: HTTP APIs, gRPC, GraphQL,
 * and event-driven systems all use the code + message + details triad.
 * ========================================================================== */

export interface AppError {
  /**
   * Programmatic error identifier.
   *
   * Should be a stable, uppercase string that consumers can match on.
   * Examples: "VALIDATION_FAILED", "NOT_FOUND", "UNAUTHORIZED", "TIMEOUT"
   */
  code: string;

  /**
   * Human-readable error description.
   */
  message: string;

  /**
   * Optional structured payload for debugging or downstream consumption.
   *
   * Examples: validation errors array, stack trace, upstream error details.
   */
  details?: unknown;
}

/* ==========================================================================
 * AppCaseError
 * --------------------------------------------------------------------------
 * Throwable error class that implements the AppError interface.
 *
 * Every surface should throw AppCaseError instead of plain Error when
 * the error represents a business or protocol failure (validation,
 * authorization, not found, conflict, etc.).
 *
 * Benefits:
 * - Catch blocks can use `instanceof AppCaseError` to distinguish
 *   business errors from unexpected runtime errors.
 * - The execute() pipeline in BaseApiCase catches AppCaseError and
 *   returns it as a structured AppResult with success: false.
 * - Hosts, adapters, and agents can extract code + message + details
 *   without parsing error strings.
 *
 * Common codes:
 * - VALIDATION_FAILED — input does not satisfy domain rules
 * - UNAUTHORIZED     — caller lacks required permissions
 * - NOT_FOUND        — requested resource does not exist
 * - CONFLICT         — operation conflicts with current state
 * - COMPOSITION_FAILED — cross-case composition error
 * - INTERNAL         — unexpected internal error
 * ========================================================================== */

export class AppCaseError extends Error implements AppError {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppCaseError";
    this.code = code;
    this.details = details;
  }

  /**
   * Serializes to the AppError interface shape.
   * Useful for JSON responses and logging.
   */
  public toAppError(): AppError {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

/**
 * Rehydrates an AppCaseError from a structural AppError payload.
 *
 * Useful when a surface delegates to another canonical surface that returns
 * an AppResult-style envelope instead of throwing directly.
 */
export function toAppCaseError(
  error: AppError | undefined,
  fallbackMessage: string,
  fallbackCode = "INTERNAL",
  fallbackDetails?: unknown
): AppCaseError {
  if (error) {
    return new AppCaseError(error.code, error.message, error.details);
  }

  return new AppCaseError(fallbackCode, fallbackMessage, fallbackDetails);
}

/* ==========================================================================
 * AppResult
 * --------------------------------------------------------------------------
 * Canonical result wrapper for success/failure representation.
 *
 * Unifies the return shape across surfaces. Every surface that returns
 * a result to a caller (API handler, stream handler, agentic tool)
 * can use this shape instead of inventing its own wrapper.
 *
 * The success flag enables quick branching without inspecting data/error:
 * - success: true  → data is present
 * - success: false → error is present
 * ========================================================================== */

export interface AppResult<T = unknown> {
  /**
   * Whether the operation succeeded.
   */
  success: boolean;

  /**
   * Result payload when success is true.
   */
  data?: T;

  /**
   * Structured error when success is false.
   */
  error?: AppError;
}

/* ==========================================================================
 * StreamFailureEnvelope
 * --------------------------------------------------------------------------
 * Canonical dead-letter payload shape for stream failures.
 *
 * This contract is structural, not transport-specific.
 * Apps may enrich it with additional metadata, but the minimum shape
 * remains stable so tooling and hosts can reason about dead-letter events.
 * ========================================================================== */

export interface StreamFailureEnvelope<TEvent = unknown> {
  /**
   * Canonical case identifier that produced the failure.
   */
  caseName: string;

  /**
   * Surface identifier.
   *
   * Fixed to "stream" for this envelope type.
   */
  surface: "stream";

  /**
   * Original event that failed processing.
   */
  originalEvent: TEvent;

  /**
   * Last observed error after retries were exhausted.
   */
  lastError: {
    message: string;
    code?: string;
    stack?: string;
  };

  /**
   * Total attempts executed, including the first one.
   */
  attempts: number;

  /**
   * First attempt timestamp in ISO format.
   */
  firstAttemptAt: string;

  /**
   * Last attempt timestamp in ISO format.
   */
  lastAttemptAt: string;

  /**
   * Correlation identifier shared across the operation.
   */
  correlationId: string;
}

/* ==========================================================================
 * AppPaginationParams
 * --------------------------------------------------------------------------
 * Pagination input parameters.
 *
 * Supports both offset-based (page/limit) and cursor-based pagination.
 * The host chooses which strategy to use — both can coexist in the
 * same contract because they address different use cases:
 * - page/limit: simple, stateless, good for UI grids
 * - cursor: scalable, consistent under concurrent writes
 * ========================================================================== */

export interface AppPaginationParams {
  /**
   * Page number (1-based) for offset pagination.
   */
  page?: number;

  /**
   * Maximum number of items per page.
   */
  limit?: number;

  /**
   * Opaque cursor for cursor-based pagination.
   */
  cursor?: string;
}

/* ==========================================================================
 * AppPaginatedResult
 * --------------------------------------------------------------------------
 * Paginated result wrapper.
 *
 * Extends the result concept with pagination metadata.
 * Works with both offset-based and cursor-based strategies.
 * ========================================================================== */

export interface AppPaginatedResult<T = unknown> {
  /**
   * The items in the current page.
   */
  items: T[];

  /**
   * Total number of items across all pages.
   *
   * Optional — not all backends can compute total efficiently.
   */
  total?: number;

  /**
   * Current page number (mirrors input).
   */
  page?: number;

  /**
   * Items per page (mirrors input).
   */
  limit?: number;

  /**
   * Cursor for the next page.
   *
   * When present, signals that more pages exist.
   */
  cursor?: string;

  /**
   * Whether more items exist beyond the current page.
   */
  hasMore?: boolean;
}
