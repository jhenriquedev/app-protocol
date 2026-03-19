/* ========================================================================== *
 * APP v1.1.0
 * core/shared/app_infra_contracts.ts
 * ----------------------------------------------------------------------------
 * Minimal infrastructure contracts for per-surface contexts.
 *
 * These interfaces define the minimum shape that APP recognizes
 * for each infrastructure capability. They exist to:
 * - provide type safety beyond `unknown`
 * - enable tooling, linting, and conformance checks
 * - document the protocol's expectations for each capability
 *
 * Host projects may extend these interfaces with richer contracts.
 * APP only defines the minimum convergent operation for each capability.
 *
 * Eligibility criteria for inclusion:
 * 1. The primary operation is convergent across implementations
 * 2. The interface describes generic infrastructure, not domain logic
 * 3. The capability name has stable, non-ambiguous meaning within APP
 *
 * Capabilities that do not yet meet all three criteria remain typed
 * as `unknown` in their respective surface contexts (e.g. auth, db, queue).
 * ========================================================================== */

/* ==========================================================================
 * AppHttpClient
 * --------------------------------------------------------------------------
 * Minimal outbound HTTP client contract.
 *
 * Covers: fetch, axios, got, ky, undici, and similar HTTP clients.
 *
 * This is explicitly a client (outbound) contract.
 * Server/framework concerns (Hono, Express, Fastify) are not modeled here.
 * ========================================================================== */

export interface AppHttpClient {
  /**
   * Sends an HTTP request.
   *
   * The config shape is host-defined (e.g. { url, method, headers, body }).
   * APP does not prescribe a specific request config format.
   */
  request(config: unknown): Promise<unknown>;
}

/* ==========================================================================
 * AppStorageClient
 * --------------------------------------------------------------------------
 * Minimal persistent storage client contract.
 *
 * Covers: key-value stores, object storage (S3, GCS), and similar.
 *
 * Semantic distinction from AppCache:
 * - AppStorageClient = durable persistence (data survives restarts,
 *   deploys, and cache eviction). No TTL. Think: S3, DynamoDB, Redis
 *   used as primary store, filesystem.
 * - AppCache = ephemeral data with optional TTL. Think: Redis as cache,
 *   Memcached, in-memory LRU.
 *
 * The get/set shape is intentionally identical — both converge on
 * key-based access. The difference is lifecycle and durability, not API.
 *
 * This is a client contract — it describes how a surface consumes
 * storage, not how storage is implemented.
 *
 * Host projects with more specific needs (e.g. blob streaming,
 * directory listing) should extend this interface.
 * ========================================================================== */

export interface AppStorageClient {
  /**
   * Retrieves a persisted value by key.
   *
   * Returns the value or undefined/null if the key does not exist.
   */
  get(key: string): Promise<unknown>;

  /**
   * Persists a value by key (durable write).
   */
  set(key: string, value: unknown): Promise<void>;
}

/* ==========================================================================
 * AppCache
 * --------------------------------------------------------------------------
 * Minimal cache contract with optional TTL.
 *
 * Covers: Redis, Memcached, in-memory caches, DynamoDB-as-cache.
 *
 * The TTL is in seconds. If not provided, the implementation decides
 * the default expiration policy.
 * ========================================================================== */

export interface AppCache {
  /**
   * Retrieves a cached value by key.
   *
   * Returns the cached value or undefined/null if not found or expired.
   */
  get(key: string): Promise<unknown>;

  /**
   * Stores a value in cache with optional TTL (in seconds).
   */
  set(key: string, value: unknown, ttl?: number): Promise<void>;
}

/* ==========================================================================
 * AppEventPublisher
 * --------------------------------------------------------------------------
 * Minimal event publisher contract.
 *
 * Covers the publish side of event-driven communication.
 *
 * The subscribe/consume side is modeled by the stream surface
 * (BaseStreamCase.subscribe()), not by this contract.
 * This separation avoids forcing monolithic adapters and respects
 * the common pattern of separating producers and consumers.
 * ========================================================================== */

export interface AppEventPublisher {
  /**
   * Publishes an event to the event bus.
   *
   * The event string is the event type/topic.
   * The payload shape is host-defined.
   */
  publish(event: string, payload: unknown): Promise<void>;
}
