/* ========================================================================== *
 * APP v1.1.5
 * core/api.case.ts
 * ----------------------------------------------------------------------------
 * Base contract for the APP API surface.
 *
 * Responsibility:
 * - expose a capability through a backend interface (HTTP, RPC, CLI, etc)
 * - orchestrate validation, authorization, and execution
 * - return a structured response
 *
 * Fundamental rule:
 * - domain logic belongs in domain.case.ts
 * - persistence or integration must be encapsulated in private methods
 *
 * Context:
 * - ApiContext extends AppBaseContext with backend infrastructure
 * - each project defines the concrete types for http, db, auth, etc.
 * ========================================================================== */

import { Dict } from "./domain.case";
import { AppBaseContext } from "./shared/app_base_context";
import {
  AppCache,
  AppHttpClient,
  AppStorageClient,
} from "./shared/app_infra_contracts";
import { AppCaseError, AppResult } from "./shared/app_structural_contracts";

/* ==========================================================================
 * ApiContext
 * --------------------------------------------------------------------------
 * API surface-specific context.
 *
 * Extends AppBaseContext with backend infrastructure:
 * - httpClient: outbound HTTP client (fetch, axios, etc.)
 * - db: database access (unknown — no stable contract)
 * - auth: authentication and authorization (unknown — domain semantics)
 * - storage: persistent storage client
 * - cache: cache com TTL
 *
 * Fields with a minimum contract use interfaces from app_infra_contracts.ts.
 * Fields without stable semantics remain unknown.
 * ========================================================================== */

export interface ApiContext extends AppBaseContext {
  /**
   * Outbound HTTP client.
   *
   * Examples: fetch wrapper, Axios instance, got, ky, undici.
   * Note: this is a client contract, not a server/framework contract.
   */
  httpClient?: AppHttpClient;

  /**
   * Database access.
   *
   * Kept as unknown — incompatible paradigms (ORM, query builder,
   * document store) prevent a convergent minimum contract.
   *
   * Examples: Prisma client, Drizzle, Knex, connection pool.
   */
  db?: unknown;

  /**
   * Authentication and authorization information.
   *
   * Kept as unknown — it carries domain semantics that vary
   * across models (RBAC, ABAC, claims, scopes, sessions).
   *
   * Examples: JWT decoded, session object, API key metadata.
   */
  auth?: unknown;

  /**
   * Persistent storage client.
   *
   * Examples: S3 client, GCS client, local filesystem adapter.
   */
  storage?: AppStorageClient;

  /**
   * Cache with optional TTL.
   *
   * Examples: Redis client, in-memory cache, Memcached.
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
 * ApiResponse
 * --------------------------------------------------------------------------
 * Extends AppResult with API-specific metadata.
 *
 * ApiResponse inherits the canonical result shape (success, data, error)
 * and adds optional HTTP-specific fields. Surfaces that don't need
 * API-specific metadata can use AppResult directly.
 * ========================================================================== */

/**
 * API surface response structure.
 *
 * Extends AppResult with optional API-specific metadata.
 */
export interface ApiResponse<T = unknown> extends AppResult<T> {
  /**
   * HTTP status code hint.
   *
   * The runtime/adapter may use this to set the HTTP response status.
   * APP does not mandate HTTP — this is a convenience for HTTP-based hosts.
   */
  statusCode?: number;
}

/* ==========================================================================
 * BaseApiCase
 * ========================================================================== */

/**
 * Base class for API surfaces.
 */
export abstract class BaseApiCase<TInput = unknown, TOutput = unknown> {
  protected readonly ctx: ApiContext;

  constructor(ctx: ApiContext) {
    this.ctx = ctx;
  }

  /* =======================================================================
   * Required methods
   * ===================================================================== */

  /**
   * Primary capability handler.
   *
   * handler is the public entrypoint of the capability. It receives business
   * input and returns a business result. It is NOT an HTTP endpoint.
   *
   * Transport bindings (HTTP routes, gRPC definitions, CLI commands)
   * live in router() or in the adapter/host.
   *
   * It must:
   * - validate input
   * - verify authorization
   * - execute the main logic
   * - return a structured response
   */
  public abstract handler(input: TInput): Promise<ApiResponse<TOutput>>;

  /**
   * Optional router — transport bindings.
   *
   * This is where the Case declares its transport surface (HTTP, gRPC, CLI).
   * The router delegates to handler(); it never contains business logic.
   * The host/adapter assembles routes by collecting each Case's router().
   *
   * Return type is framework-specific (unknown).
   */
  public router?(): unknown;

  /**
   * Internal capability test.
   *
   * Recommended APP practice — surfaces should ideally expose a
   * test() method for self-contained contract validation.
   *
   * Canonical signature: test(): Promise<void>
   * The test invokes handler() internally and performs assertions.
   * It receives no input and returns no result — it is internal validation.
   */
  public async test(): Promise<void> {}

  /* =======================================================================
   * Protected hooks (optional)
   * ===================================================================== */

  /**
   * Input validation before execution.
   */
  protected async _validate?(input: TInput): Promise<void>;

  /**
   * Authorization check.
   */
  protected async _authorize?(input: TInput): Promise<void>;

  /**
   * Access to persistence and local integrations for the Case.
   *
   * Canonical slot for queries, mutations, cache reads, and calls
   * to external infrastructure services.
   *
   * Rule: _repository must not perform cross-case composition.
   */
  protected _repository?(): unknown;

  /**
   * Main logic execution (atomic Case).
   *
   * Canonical slot for business logic that does not involve
   * cross-case orchestration. Mutually exclusive with _composition
   * as the main execution center.
   *
   * Atomic Cases implement _service.
   * Composed Cases implement _composition.
   * The pipeline requires at least one of the two to be defined.
   */
  protected async _service?(input: TInput): Promise<TOutput>;

  /**
   * Cross-case orchestration via the registry (composed Case).
   *
   * Canonical slot for Cases that need to invoke other Cases.
   * Resolves capabilities through ctx.cases, never through direct imports.
   *
   * Mutually exclusive with _service as the main execution center.
   * When present, the pipeline must use _composition instead of _service.
   */
  protected async _composition?(input: TInput): Promise<TOutput>;

  /**
   * Standard utility method for execution.
   *
   * Orchestrates the pipeline: validate → authorize → (composition | service).
   *
   * If _composition is defined, it is the execution center (composed Case).
   * Otherwise, _service is used (atomic Case).
   */
  protected async execute(input: TInput): Promise<ApiResponse<TOutput>> {
    try {
      if (this._validate) await this._validate(input);
      if (this._authorize) await this._authorize(input);

      if (!this._composition && !this._service) {
        throw new AppCaseError(
          "INTERNAL",
          "BaseApiCase: at least one of _service or _composition must be implemented",
        );
      }

      const result = this._composition
        ? await this._composition(input)
        : await this._service!(input);

      return {
        success: true,
        data: result,
      };
    } catch (err) {
      if (err instanceof AppCaseError) {
        return {
          success: false,
          error: err.toAppError(),
        };
      }
      // Unexpected errors re-throw — the host/adapter decides how to handle them.
      throw err;
    }
  }
}
