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
 * 2. Builda o mapa de Cases (boot-time, uma vez)
 * 3. Cria contextos por request usando os três slots do registry
 * ------------------------------------------------------------------------ */

type CasesMap = Record<string, Record<string, Record<string, unknown>>>;

type StreamSurfaceInstance = {
  handler(event: StreamEvent): Promise<void>;
  subscribe?(): unknown;
  recoveryPolicy?(): AppStreamRecoveryPolicy;
};

export function bootstrap(config: BackendConfig) {
  const registry = createRegistry(config);
  const streamRuntime = registry._providers.streamRuntime;

  /* ........................................................................
   * Build cases map (boot-time)
   * ......................................................................
   * Fase 1: cria container vazio e instancia cada Case com contexto de boot.
   * Fase 2: quando o loop termina, o container está completo.
   *         _composition via ctx.cases encontra todos os Cases disponíveis.
   * ...................................................................... */

  const casesMap: CasesMap = {};

  const bootCtx: ApiContext = {
    correlationId: "boot",
    logger,
    cases: casesMap,
    // _providers → propriedades diretas do contexto
    cache: registry._providers.cache,
    httpClient: registry._providers.httpClient,
    // _packages → ctx.packages
    packages: registry._packages,
  };

  for (const [domain, domainCases] of Object.entries(registry._cases)) {
    casesMap[domain] = {};
    for (const [caseName, _surfaces] of Object.entries(domainCases)) {
      const surfaces = _surfaces as AppCaseSurfaces;
      const entry: Record<string, unknown> = {};

      if (surfaces.api) {
        entry.api = new surfaces.api(bootCtx);
      }

      if (surfaces.stream) {
        const streamCtx: StreamContext = {
          correlationId: "boot",
          logger,
          cases: casesMap,
          cache: registry._providers.cache,
          packages: registry._packages,
        };
        const instance = new surfaces.stream(streamCtx) as StreamSurfaceInstance;
        const source = `${domain}/${caseName}/stream`;
        const policy = instance.recoveryPolicy?.();
        validateStreamRecoveryPolicy(source, policy);
        validateStreamRuntimeCompatibility(source, policy, streamRuntime);
        entry.stream = instance;
      }

      casesMap[domain][caseName] = entry;
    }
  }

  /* ........................................................................
   * Request context factories
   * ......................................................................
   * Cada request recebe contexto fresco com:
   * - correlationId único
   * - cases: mapa pré-construído no boot (compartilhado)
   * - providers: instâncias do registry (cache, httpClient)
   * - packages: bibliotecas puras do registry
   * ...................................................................... */

  function createApiContext(parent?: Partial<ApiContext>): ApiContext {
    return {
      correlationId: parent?.correlationId ?? generateId(),
      executionId: generateId(),
      tenantId: parent?.tenantId,
      userId: parent?.userId,
      config: parent?.config,
      logger,
      // _cases → ctx.cases
      cases: casesMap,
      // _providers → propriedades diretas do ctx (contratos de core/)
      cache: registry._providers.cache,
      httpClient: registry._providers.httpClient,
      // _packages → ctx.packages
      packages: registry._packages,
    };
  }

  function createStreamContext(parent?: Partial<StreamContext>): StreamContext {
    return {
      correlationId: parent?.correlationId ?? generateId(),
      executionId: generateId(),
      tenantId: parent?.tenantId,
      userId: parent?.userId,
      config: parent?.config,
      logger,
      cases: casesMap,
      cache: registry._providers.cache,
      packages: registry._packages,
    };
  }

  async function dispatchStream<TEvent>(
    domain: string,
    caseName: string,
    event: StreamEvent<TEvent>,
    parent?: Partial<StreamContext>
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
          const ctx = createApiContext();
          const instance = new surfaces.api(ctx) as { router?(): unknown };
          if (instance.router) {
            routes.push(instance.router());
            logger.info(`Mounted API: ${domain}/${caseName}`);
          }
        }

        if (surfaces.stream) {
          const ctx = createStreamContext();
          const instance = new surfaces.stream(ctx) as StreamSurfaceInstance;

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
            subscriptions.push(instance.subscribe());
            logger.info(`Mounted Stream: ${domain}/${caseName}`);
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
    casesMap,
    createApiContext,
    createStreamContext,
    dispatchStream,
    start,
  };
}
