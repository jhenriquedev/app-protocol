/* ========================================================================== *
 * Lambdas App — Bootstrap
 * --------------------------------------------------------------------------
 * Modelo: 1 lambda por feature (domínio).
 *
 * Cada lambda recebe todas as rotas HTTP daquela feature.
 * A lambda resolve qual Case executar via path matching.
 *
 * Exemplo de deploy:
 *   /users/* → lambda "users" (user_validate + user_register)
 *
 * Cada feature lambda:
 * 1. Recebe o evento do API Gateway / Function URL
 * 2. Resolve o Case correto pelo path
 * 3. Instancia o Case com contexto
 * 4. Delega para handler()
 *
 * Stream lambdas seguem o mesmo modelo, mas são acionadas
 * por eventos (SQS, EventBridge, etc.) em vez de HTTP.
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
import { registry, getFeature } from "./registry";

/* --------------------------------------------------------------------------
 * Logger
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
 * Runtime case map per feature
 * --------------------------------------------------------------------------
 * Cada invocação materializa wrappers de composição para a feature atual.
 * Esses wrappers preservam o correlationId e os dados do contexto pai,
 * mas criam uma nova instância da surface canônica a cada salto.
 * ------------------------------------------------------------------------ */

type FeatureCasesMap = Record<string, Record<string, Record<string, unknown>>>;
type StreamSurfaceInstance = {
  subscribe?(): unknown;
  recoveryPolicy?(): AppStreamRecoveryPolicy;
};

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

function createCasesMap(
  featureName: string,
  parent: ParentExecutionContext
): FeatureCasesMap {
  const featureMap: Record<string, Record<string, unknown>> = {};
  const cases: FeatureCasesMap = {
    [featureName]: featureMap,
  };

  const featureCases = getFeature(featureName);

  for (const [caseName, surfaces] of Object.entries(featureCases)) {
    const entry: Record<string, unknown> = {};

    if (surfaces.api) {
      const ApiClass = surfaces.api;
      entry.api = {
        handler: async (input: unknown) => {
          const ctx = createApiContext(featureName, parent);
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
          const ctx = createStreamContext(featureName, parent);
          const instance = new StreamClass(ctx) as {
            handler(payload: unknown): Promise<void>;
          };
          return instance.handler(event);
        },
      };
    }

    featureMap[caseName] = entry;
  }

  return cases;
}

/* --------------------------------------------------------------------------
 * Request context factories
 * --------------------------------------------------------------------------
 * Cada invocação recebe um contexto fresco com:
 * - correlationId único (rastreabilidade da operação)
 * - cases: wrappers request-scoped derivados do registry da feature
 * ------------------------------------------------------------------------ */

function createApiContext(
  feature: string,
  parent?: Partial<ParentExecutionContext>
): ApiContext {
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
    cases: {},
  };

  ctx.cases = createCasesMap(feature, ctx);
  return ctx;
}

function createStreamContext(
  feature: string,
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
  };

  ctx.cases = createCasesMap(feature, ctx);
  return ctx;
}

async function dispatchFeatureStream(
  featureName: string,
  caseName: string,
  event: StreamEvent,
  parent?: Partial<ParentExecutionContext>
): Promise<void> {
  const surfaces = getFeature(featureName)[caseName];
  if (!surfaces?.stream) {
    throw new Error(`No stream surface registered for ${featureName}/${caseName}`);
  }

  const source = `${featureName}/${caseName}/stream`;
  const correlationId = parent?.correlationId ?? generateId();
  const firstAttemptAt = new Date().toISOString();
  const runtime = registry._providers.streamRuntime;
  let attempts = 0;

  while (true) {
    attempts += 1;
    const ctx = createStreamContext(featureName, {
      ...parent,
      correlationId,
    });
    const instance = new surfaces.stream(ctx) as StreamSurfaceInstance & {
      handler(payload: StreamEvent): Promise<void>;
    };
    const policy = instance.recoveryPolicy?.();
    validateStreamRecoveryPolicy(source, policy);
    validateStreamRuntimeCompatibility(source, policy, runtime);

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
        logger.warn(`${source}: retry scheduled`, {
          attempts,
          delayMs,
          correlationId,
        });
        await sleep(delayMs);
        continue;
      }

      if (policy?.deadLetter) {
        const binding = runtime.deadLetters?.[policy.deadLetter.destination];
        if (binding) {
          await binding.publish(
            createStreamFailureEnvelope(
              `${featureName}/${caseName}`,
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

/* ==========================================================================
 * HTTP Lambda handler — 1 por feature
 * --------------------------------------------------------------------------
 * Recebe evento do API Gateway / ALB / Function URL.
 * Resolve o Case pelo path e delega para handler().
 *
 * Deploy:
 *   Lambda "users" → rota /users/*
 * ========================================================================== */

interface LambdaHttpEvent {
  httpMethod: string;
  path: string;
  body?: string;
  headers?: Record<string, string>;
}

interface LambdaHttpResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

function mapAppErrorCodeToStatus(code?: string): number {
  switch (code) {
    case "VALIDATION_FAILED":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    default:
      return 500;
  }
}

function resolveApiStatusCode(result: ApiResponse<unknown>): number {
  if (result.statusCode !== undefined) {
    return result.statusCode;
  }

  return result.success ? 200 : mapAppErrorCodeToStatus(result.error?.code);
}

function buildPostSuccessEvent(
  featureName: string,
  caseName: string,
  result: ApiResponse<unknown>
): StreamEvent | undefined {
  if (!result.success || !result.data) {
    return undefined;
  }

  if (featureName === "users" && caseName === "user_register") {
    const user = result.data as UserRegisterOutput;

    return {
      type: "user_registered",
      payload: user,
      idempotencyKey: `users.user_register:${user.id}`,
      metadata: {
        source: "http",
        feature: featureName,
        caseName,
      },
    };
  }

  return undefined;
}

async function dispatchPostSuccessEvents(
  featureName: string,
  caseName: string,
  result: ApiResponse<unknown>,
  ctx: ApiContext
): Promise<void> {
  const event = buildPostSuccessEvent(featureName, caseName, result);
  if (!event) return;

  logger.info("Dispatching post-success stream event", {
    feature: featureName,
    caseName,
    eventType: event.type,
    correlationId: ctx.correlationId,
  });

  await dispatchFeatureStream(featureName, caseName, event, {
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

/**
 * Cria o handler HTTP para uma feature.
 *
 * Uso no deploy:
 *   export const handler = createFeatureHttpHandler("users");
 */
export function createFeatureHttpHandler(featureName: string) {
  // Monta a tabela de rotas para todos os Cases da feature
  const featureCases = getFeature(featureName);
  const routeTable = buildRouteTable(featureName, featureCases);

  return async (event: LambdaHttpEvent): Promise<LambdaHttpResponse> => {
    const { httpMethod, path, body } = event;

    logger.info("Lambda invoked", { feature: featureName, httpMethod, path });

    // Resolve a rota
    const route = routeTable.find(
      (r) => r.method === httpMethod && path.endsWith(r.path)
    );

    if (!route) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `No route for ${httpMethod} ${path}` }),
      };
    }

    try {
      const ctx = createApiContext(featureName);
      const instance = new (route.CaseClass as new (ctx: ApiContext) => unknown)(ctx) as {
        handler(input: unknown): Promise<ApiResponse<unknown>>;
      };

      const input = body ? JSON.parse(body) : {};
      const result = await instance.handler(input);
      await dispatchPostSuccessEvents(featureName, route.caseName, result, ctx);

      return {
        statusCode: resolveApiStatusCode(result),
        body: JSON.stringify(result),
        headers: { "Content-Type": "application/json" },
      };
    } catch (err) {
      logger.error("Lambda error", {
        feature: featureName,
        path,
        error: (err as Error).message,
      });

      return {
        statusCode: 500,
        body: JSON.stringify({ error: (err as Error).message }),
      };
    }
  };
}

/* --------------------------------------------------------------------------
 * Route table builder
 * --------------------------------------------------------------------------
 * Instancia cada Case, coleta router(), e monta a tabela de rotas.
 * Isso acontece uma vez no cold start da lambda.
 * ------------------------------------------------------------------------ */

interface RouteEntry {
  method: string;
  path: string;
  caseName: string;
  CaseClass: unknown;
}

function buildRouteTable(
  featureName: string,
  featureCases: Record<string, AppCaseSurfaces>
): RouteEntry[] {
  const routes: RouteEntry[] = [];

  for (const [caseName, surfaces] of Object.entries(featureCases)) {
    if (!surfaces.api) continue;

    // Instancia temporariamente para coletar router()
    const tempCtx: ApiContext = { correlationId: "boot", logger };
    const instance = new surfaces.api(tempCtx) as {
      router?(): unknown;
    };

    if (instance.router) {
      const routeDef = instance.router() as {
        method: string;
        path: string;
      };
      routes.push({
        method: routeDef.method,
        path: routeDef.path,
        caseName,
        CaseClass: surfaces.api,
      });
    }
  }

  logger.info(`Route table built for feature "${featureName}"`, {
    routes: routes.map((r) => `${r.method} ${r.path} → ${r.caseName}`),
  });

  return routes;
}

/* ==========================================================================
 * Stream Lambda handler — 1 por feature
 * --------------------------------------------------------------------------
 * Recebe evento de SQS / EventBridge / Kafka.
 * Resolve o Case pelo event type e delega para handler().
 *
 * Deploy:
 *   Lambda "users-stream" → fila/tópico de eventos users.*
 * ========================================================================== */

interface LambdaSqsEvent {
  Records: Array<{
    body: string;
    messageAttributes?: Record<string, { stringValue?: string }>;
  }>;
}

/**
 * Cria o handler de stream para uma feature.
 *
 * Uso no deploy:
 *   export const handler = createFeatureStreamHandler("users");
 */
export function createFeatureStreamHandler(featureName: string) {
  const featureCases = getFeature(featureName);

  // Monta mapa de event type → Case stream
  const subscriptionMap = buildSubscriptionMap(featureName, featureCases);

  return async (event: LambdaSqsEvent): Promise<void> => {
    for (const record of event.Records) {
      const parsed = JSON.parse(record.body) as StreamEvent;

      logger.info("Stream event received", {
        feature: featureName,
        eventType: parsed.type,
      });

      const entry = subscriptionMap.get(parsed.type);
      if (!entry) {
        logger.warn("No handler for event type", { type: parsed.type });
        continue;
      }

      await dispatchFeatureStream(featureName, entry.caseName, parsed);
    }
  };
}

function buildSubscriptionMap(
  featureName: string,
  featureCases: Record<string, AppCaseSurfaces>
): Map<string, { caseName: string; CaseClass: unknown }> {
  const map = new Map<string, { caseName: string; CaseClass: unknown }>();

  for (const [caseName, surfaces] of Object.entries(featureCases)) {
    if (!surfaces.stream) continue;

    const tempCtx: StreamContext = { correlationId: "boot", logger };
    const instance = new surfaces.stream(tempCtx) as StreamSurfaceInstance;

    // Protocol-level validation lives in core. App/runtime compatibility
    // remains a host concern at bootstrap.
    validateStreamRecoveryPolicy(
      `${featureName}/${caseName}/stream`,
      instance.recoveryPolicy?.()
    );
    validateStreamRuntimeCompatibility(
      `${featureName}/${caseName}/stream`,
      instance.recoveryPolicy?.(),
      registry._providers.streamRuntime
    );

    if (instance.subscribe) {
      const sub = instance.subscribe() as { topic: string };
      map.set(sub.topic, { caseName, CaseClass: surfaces.stream });
    }
  }

  logger.info(`Subscription map built for feature "${featureName}"`, {
    topics: [...map.keys()],
  });

  return map;
}

/* ==========================================================================
 * Entrypoints concretos — 1 export por lambda
 * --------------------------------------------------------------------------
 * Cada um desses exports vira uma lambda no deploy (serverless.yml, SAM, CDK).
 *
 * serverless.yml:
 *   functions:
 *     usersHttp:
 *       handler: apps/lambdas/app.usersHttp
 *       events:
 *         - httpApi: 'ANY /users/{proxy+}'
 *
 *     usersStream:
 *       handler: apps/lambdas/app.usersStream
 *       events:
 *         - sqs: arn:aws:sqs:...:users-events
 * ========================================================================== */

// Feature: users — HTTP
export const usersHttp = createFeatureHttpHandler("users");

// Feature: users — Stream
export const usersStream = createFeatureStreamHandler("users");
