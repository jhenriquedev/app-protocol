/* ========================================================================== *
 * Backend App — Bootstrap
 * --------------------------------------------------------------------------
 * Monolith host: API routes + stream subscriptions.
 *
 * Consome o registry unificado:
 * - registry._cases     → ctx.cases
 * - registry._providers → ctx.db
 * - registry._packages  → ctx.packages
 *
 * Importante:
 * ctx.cases é ligado ao contexto da execução atual. Cada salto de composição
 * cria uma nova instância do Case, mas preserva o correlationId da operação.
 * ========================================================================== */

import { ApiContext } from "../../core/api.case";
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
import { createRegistry } from "./registry";

const logger: AppLogger = {
  debug: (msg, meta) => console.log("[DEBUG]", msg, meta),
  info: (msg, meta) => console.log("[INFO]", msg, meta),
  warn: (msg, meta) => console.warn("[WARN]", msg, meta),
  error: (msg, meta) => console.error("[ERROR]", msg, meta),
};

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type CasesMap = Record<string, Record<string, Record<string, unknown>>>;

interface ParentExecutionContext {
  correlationId: string;
  tenantId?: string;
  userId?: string;
  config?: Record<string, unknown>;
}

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

export function bootstrap() {
  const registry = createRegistry();
  const db = registry._providers.db;
  const streamRuntime = registry._providers.streamRuntime;

  function createCasesMap(parent: ParentExecutionContext): CasesMap {
    const cases: CasesMap = {};

    for (const [domain, domainCases] of Object.entries(registry._cases)) {
      cases[domain] = {};

      for (const [caseName, surfaces] of Object.entries(domainCases)) {
        const entry: Record<string, unknown> = {};
        const typedSurfaces = surfaces as AppCaseSurfaces;

        if (typedSurfaces.api) {
          const ApiClass = typedSurfaces.api;
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

        if (typedSurfaces.stream) {
          const StreamClass = typedSurfaces.stream;
          entry.stream = {
            handler: async (event: unknown) => {
              const ctx = createStreamContext(parent);
              const instance = new StreamClass(ctx) as {
                handler(payload: unknown): Promise<void>;
              };
              return instance.handler(event);
            },
          };
        }

        cases[domain][caseName] = entry;
      }
    }

    return cases;
  }

  function createApiContext(parent?: Partial<ParentExecutionContext>): ApiContext {
    const ctx: ApiContext = {
      correlationId: parent?.correlationId ?? generateId(),
      executionId: generateId(),
      tenantId: parent?.tenantId,
      userId: parent?.userId,
      config: parent?.config,
      logger,
      db,
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
      db,
      packages: registry._packages,
    };

    ctx.cases = createCasesMap(ctx);
    return ctx;
  }

  async function startBackend(): Promise<void> {
    const routes: unknown[] = [];
    const subscriptions: unknown[] = [];

    for (const [domain, domainCases] of Object.entries(registry._cases)) {
      for (const [caseName, surfaces] of Object.entries(domainCases)) {
        if (surfaces.api) {
          const ApiClass = surfaces.api;
          const instance = new ApiClass(
            createApiContext({ correlationId: "boot" })
          ) as {
            router?(): unknown;
            handler?(input: unknown): Promise<unknown>;
          };

          if (instance.router) {
            const route = instance.router();
            if (isRouteBinding(route)) {
              const mountedRoute: RouteBinding = {
                ...route,
                handler: async (request: unknown) => {
                  const runtimeInstance = new ApiClass(createApiContext()) as {
                    router?(): unknown;
                    handler?(input: unknown): Promise<unknown>;
                  };
                  const runtimeRoute = runtimeInstance.router?.();
                  if (
                    isRouteBinding(runtimeRoute) &&
                    typeof runtimeRoute.handler === "function"
                  ) {
                    return runtimeRoute.handler(request);
                  }
                  if (typeof runtimeInstance.handler === "function") {
                    return runtimeInstance.handler(request);
                  }
                  throw new Error(
                    `API route binding for ${domain}/${caseName} did not expose a handler`
                  );
                },
              };
              routes.push(mountedRoute);
              logger.info(`Mounted API: ${domain}/${caseName}`, {
                route: mountedRoute,
              });
            }
          }
        }

        if (surfaces.stream) {
          const instance = new surfaces.stream(
            createStreamContext({ correlationId: "boot" })
          ) as {
            subscribe?(): unknown;
            recoveryPolicy?(): AppStreamRecoveryPolicy;
          };

          const label = `${domain}/${caseName}.stream`;
          const policy = instance.recoveryPolicy?.();
          validateStreamRecoveryPolicy(label, policy);
          validateStreamRuntimeCompatibility(label, policy, streamRuntime);

          if (policy) {
            logger.info(`${label}: recovery policy declared`, {
              retry: !!policy.retry,
              deadLetter: !!policy.deadLetter,
              maxAttempts: policy.retry?.maxAttempts,
              destination: policy.deadLetter?.destination,
            });
          }

          if (instance.subscribe) {
            const sub = instance.subscribe();
            if (isSubscriptionBinding(sub)) {
              const mountedSubscription: SubscriptionBinding = {
                ...sub,
                handler: async (event: StreamEvent) => {
                  await dispatchStream(domain, caseName, event);
                },
              };
              subscriptions.push(mountedSubscription);
              logger.info(`Mounted Stream: ${domain}/${caseName}`, {
                sub: mountedSubscription,
              });
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

    const label = `${domain}/${caseName}.stream`;
    const correlationId = parent?.correlationId ?? generateId();
    const firstAttemptAt = new Date().toISOString();
    let attempts = 0;

    while (true) {
      attempts += 1;
      const ctx = createStreamContext({
        ...parent,
        correlationId,
      });
      const instance = new surfaces.stream(ctx) as {
        handler(payload: StreamEvent<TEvent>): Promise<void>;
        recoveryPolicy?(): AppStreamRecoveryPolicy;
      };
      const policy = instance.recoveryPolicy?.();
      validateStreamRecoveryPolicy(label, policy);
      validateStreamRuntimeCompatibility(label, policy, streamRuntime);

      try {
        await instance.handler(event);
        return;
      } catch (error) {
        const retry = policy?.retry;
        const canRetry =
          !!retry &&
          attempts < retry.maxAttempts &&
          isStreamErrorRetryable(error, retry.retryableErrors);

        if (canRetry) {
          const delayMs = computeStreamRetryDelayMs(retry, attempts);
          logger.warn(`${label}: retry scheduled`, {
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

  return {
    registry,
    db,
    createApiContext,
    createStreamContext,
    dispatchStream,
    startBackend,
  };
}

const app = bootstrap();

export const registry = app.registry;
export const db = app.db;
export const createApiContext = app.createApiContext;
export const createStreamContext = app.createStreamContext;
export const dispatchStream = app.dispatchStream;
export const startBackend = app.startBackend;
