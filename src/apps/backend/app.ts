/* ========================================================================== *
 * Backend App — Bootstrap
 * --------------------------------------------------------------------------
 * Host para aplicação backend.
 *
 * Consome o registry unificado e monta o contexto:
 *
 * 1. registry._cases     → ctx.cases   (mapa de Cases para _composition)
 * 2. registry._providers → ctx.cache, ctx.httpClient (contratos de core/)
 * 3. registry._packages  → ctx.packages (bibliotecas puras)
 *
 * O Case nunca sabe de onde veio a implementação.
 * Consome tudo via ctx e contratos de core/.
 * ========================================================================== */

import { ApiContext, ApiResponse } from "../../core/api.case";
import {
  AppStreamRecoveryPolicy,
  computeStreamRetryDelayMs,
  createStreamFailureEnvelope,
  isStreamErrorRetryable,
  StreamContext,
  StreamEvent,
  validateStreamRecoveryPolicy,
  validateStreamRuntimeCompatibility,
} from "../../core/stream.case";
import { AppLogger } from "../../core/shared/app_base_context";
import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";
import { UserRegisterOutput } from "../../cases/users/user_register/user_register.domain.case";
import {
  createRegistry,
  type BackendConfig,
} from "./registry";

/* --------------------------------------------------------------------------
 * Logger (minimal example)
 * ------------------------------------------------------------------------ */

const logger: AppLogger = {
  debug: (msg, meta) => console.log("[DEBUG]", msg, meta),
  info: (msg, meta) => console.log("[INFO]", msg, meta),
  warn: (msg, meta) => console.warn("[WARN]", msg, meta),
  error: (msg, meta) => console.error("[ERROR]", msg, meta),
};

/* --------------------------------------------------------------------------
 * ID generator
 * ------------------------------------------------------------------------ */

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* --------------------------------------------------------------------------
 * Bootstrap
 * --------------------------------------------------------------------------
 * 1. Cria o registry (configura providers, registra cases e packages)
 * 2. Cria wrappers de composição derivados do registry para cada execução
 * 3. Cria contextos por request usando os três slots do registry
 * ------------------------------------------------------------------------ */

type CasesMap = Record<string, Record<string, Record<string, unknown>>>;

interface ParentExecutionContext {
  correlationId: string;
  tenantId?: string;
  userId?: string;
  config?: ApiContext["config"];
  auth?: ApiContext["auth"];
  db?: ApiContext["db"];
  storage?: ApiContext["storage"];
  eventBus?: StreamContext["eventBus"];
  queue?: StreamContext["queue"];
  extra?: ApiContext["extra"];
}

type StreamSurfaceInstance = {
  handler(event: StreamEvent): Promise<void>;
  subscribe?(): unknown;
  recoveryPolicy?(): AppStreamRecoveryPolicy;
};

type RouteBinding = {
  method: string;
  path: string;
  handler?: (request: unknown) => Promise<unknown> | unknown;
};

type SubscriptionBinding = {
  topic: string;
  handler?: (event: StreamEvent) => Promise<void> | void;
};

function isRouteBinding(value: unknown): value is RouteBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    "method" in value &&
    "path" in value
  );
}

function isSubscriptionBinding(value: unknown): value is SubscriptionBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    "topic" in value
  );
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value
  );
}

export function bootstrap(config: BackendConfig) {
  const registry = createRegistry(config);
  const streamRuntime = registry._providers.streamRuntime;

  function createCasesMap(parent: ParentExecutionContext): CasesMap {
    const cases: CasesMap = {};

    for (const [domain, domainCases] of Object.entries(registry._cases)) {
      cases[domain] = {};

      for (const [caseName, _surfaces] of Object.entries(domainCases)) {
        const surfaces = _surfaces as AppCaseSurfaces;
        const entry: Record<string, unknown> = {};

        if (surfaces.api) {
          const ApiClass = surfaces.api;
          entry.api = {
            handler: async (input: unknown) => {
              const ctx = createApiContext(parent);
              const instance = new ApiClass(ctx) as {
                handler(payload: unknown): Promise<unknown>;
              };
              return instance.handler(input);
            },
          };
        }

        if (surfaces.stream) {
          const StreamClass = surfaces.stream;
          entry.stream = {
            handler: async (event: unknown) => {
              const ctx = createStreamContext(parent);
              const instance = new StreamClass(ctx) as {
                handler(payload: unknown): Promise<void>;
              };
              return instance.handler(event as StreamEvent);
            },
          };
        }

        cases[domain][caseName] = entry;
      }
    }

    return cases;
  }

  /* ........................................................................
   * Request context factories
   * ......................................................................
   * Cada request recebe contexto fresco com:
   * - correlationId único
   * - cases: wrappers request-scoped derivados do registry
   * - providers: instâncias do registry (cache, httpClient)
   * - packages: bibliotecas puras do registry
   * ...................................................................... */

  function createApiContext(parent?: Partial<ParentExecutionContext>): ApiContext {
    const ctx: ApiContext = {
      correlationId: parent?.correlationId ?? generateId(),
      executionId: generateId(),
      tenantId: parent?.tenantId,
      userId: parent?.userId,
      config: parent?.config,
      logger,
      auth: parent?.auth,
      db: parent?.db,
      storage: parent?.storage,
      extra: parent?.extra,
      // _cases → ctx.cases
      cases: {},
      // _providers → propriedades diretas do ctx (contratos de core/)
      cache: registry._providers.cache,
      httpClient: registry._providers.httpClient,
      // _packages → ctx.packages
      packages: registry._packages,
    };

    ctx.cases = createCasesMap(ctx);
    return ctx;
  }

  function createStreamContext(
    parent?: Partial<ParentExecutionContext>
  ): StreamContext {
    const ctx: StreamContext = {
      correlationId: parent?.correlationId ?? generateId(),
      executionId: generateId(),
      tenantId: parent?.tenantId,
      userId: parent?.userId,
      config: parent?.config,
      logger,
      eventBus: parent?.eventBus,
      queue: parent?.queue,
      db: parent?.db,
      extra: parent?.extra,
      cases: {},
      cache: registry._providers.cache,
      packages: registry._packages,
    };

    ctx.cases = createCasesMap(ctx);
    return ctx;
  }

  async function dispatchStream<TEvent>(
    domain: string,
    caseName: string,
    event: StreamEvent<TEvent>,
    parent?: Partial<ParentExecutionContext>
  ): Promise<void> {
    const registeredCases = registry._cases as Record<
      string,
      Record<string, AppCaseSurfaces>
    >;
    const surfaces = registeredCases[domain]?.[caseName];
    if (!surfaces?.stream) {
      throw new Error(`No stream surface registered for ${domain}/${caseName}`);
    }

    const source = `${domain}/${caseName}/stream`;
    const correlationId = parent?.correlationId ?? generateId();
    const firstAttemptAt = new Date().toISOString();
    let attempts = 0;

    while (true) {
      attempts += 1;
      const ctx = createStreamContext({
        ...parent,
        correlationId,
      });

      const instance = new surfaces.stream(ctx) as StreamSurfaceInstance;
      const policy = instance.recoveryPolicy?.();
      validateStreamRecoveryPolicy(source, policy);
      validateStreamRuntimeCompatibility(source, policy, streamRuntime);

      try {
        await instance.handler(event as StreamEvent);
        return;
      } catch (error) {
        const retry = policy?.retry;
        const canRetry =
          !!retry &&
          attempts < retry.maxAttempts &&
          isStreamErrorRetryable(error, retry.retryableErrors);

        if (canRetry) {
          const delayMs = computeStreamRetryDelayMs(retry, attempts);
          logger.warn(`${source}: retry scheduled`, {
            attempts,
            delayMs,
            correlationId,
          });
          await sleep(delayMs);
          continue;
        }

        if (policy?.deadLetter) {
          const binding = streamRuntime.deadLetters?.[policy.deadLetter.destination];
          if (binding) {
            await binding.publish(
              createStreamFailureEnvelope(
                `${domain}/${caseName}`,
                event,
                error,
                attempts,
                correlationId,
                firstAttemptAt,
                new Date().toISOString()
              )
            );
          }
        }

        throw error;
      }
    }
  }

  function buildPostSuccessEvent(
    domain: string,
    caseName: string,
    result: ApiResponse<unknown>
  ): StreamEvent | undefined {
    if (!result.success || !result.data) {
      return undefined;
    }

    if (domain === "users" && caseName === "user_register") {
      const user = result.data as UserRegisterOutput;

      return {
        type: "user_registered",
        payload: user,
        idempotencyKey: `users.user_register:${user.id}`,
        metadata: {
          source: "backend",
          domain,
          caseName,
        },
      };
    }

    return undefined;
  }

  async function dispatchPostSuccessEvents(
    domain: string,
    caseName: string,
    result: ApiResponse<unknown>,
    ctx: ApiContext
  ): Promise<void> {
    const event = buildPostSuccessEvent(domain, caseName, result);
    if (!event) return;

    logger.info("Dispatching post-success stream event", {
      domain,
      caseName,
      eventType: event.type,
      correlationId: ctx.correlationId,
    });

    await dispatchStream(domain, caseName, event, {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      config: ctx.config,
      auth: ctx.auth,
      db: ctx.db,
      storage: ctx.storage,
      extra: ctx.extra,
    });
  }

  /* ........................................................................
   * Monolith startup
   * ...................................................................... */

  async function start(): Promise<void> {
    const routes: unknown[] = [];
    const subscriptions: unknown[] = [];

    for (const [domain, domainCases] of Object.entries(registry._cases)) {
      for (const [caseName, _surfaces] of Object.entries(domainCases)) {
        const surfaces = _surfaces as AppCaseSurfaces;

        if (surfaces.api) {
          const ApiClass = surfaces.api;
          const instance = new ApiClass(
            createApiContext({ correlationId: "boot" })
          ) as { router?(): unknown };
          if (instance.router) {
            const route = instance.router();
            if (isRouteBinding(route)) {
              routes.push({
                ...route,
                handler: async (request: unknown) => {
                  const ctx = createApiContext();
                  const runtimeInstance = new ApiClass(ctx) as {
                    router?(): unknown;
                    handler?(input: unknown): Promise<unknown>;
                  };
                  const runtimeRoute = runtimeInstance.router?.();
                  let result: unknown;
                  if (
                    isRouteBinding(runtimeRoute) &&
                    typeof runtimeRoute.handler === "function"
                  ) {
                    result = await runtimeRoute.handler(request);
                  } else if (typeof runtimeInstance.handler === "function") {
                    result = await runtimeInstance.handler(request);
                  } else {
                    throw new Error(
                      `API route binding for ${domain}/${caseName} did not expose a handler`
                    );
                  }

                  if (isApiResponse(result)) {
                    await dispatchPostSuccessEvents(domain, caseName, result, ctx);
                  }

                  return result;
                },
              });
              logger.info(`Mounted API: ${domain}/${caseName}`);
            }
          }
        }

        if (surfaces.stream) {
          const instance = new surfaces.stream(
            createStreamContext({ correlationId: "boot" })
          ) as StreamSurfaceInstance;

          // Protocol-level validation happens here.
          // Runtime-specific compatibility (DLQ bindings, jitter support,
          // attempt limits) must still be enforced by the app host.
          validateStreamRecoveryPolicy(
            `${domain}/${caseName}/stream`,
            instance.recoveryPolicy?.()
          );
          validateStreamRuntimeCompatibility(
            `${domain}/${caseName}/stream`,
            instance.recoveryPolicy?.(),
            streamRuntime
          );

          if (instance.subscribe) {
            const subscription = instance.subscribe();
            if (isSubscriptionBinding(subscription)) {
              subscriptions.push({
                ...subscription,
                handler: async (event: StreamEvent) => {
                  await dispatchStream(domain, caseName, event);
                },
              });
              logger.info(`Mounted Stream: ${domain}/${caseName}`);
            }
          }
        }
      }
    }

    logger.info("Backend started", {
      routes: routes.length,
      subscriptions: subscriptions.length,
    });
  }

  return {
    registry,
    createApiContext,
    createStreamContext,
    dispatchStream,
    start,
  };
}
