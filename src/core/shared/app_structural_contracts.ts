/* ========================================================================== *
 * APP v0.0.3
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
