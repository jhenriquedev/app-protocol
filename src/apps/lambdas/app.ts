/* ========================================================================== *
 * Lambdas App — Bootstrap
 * --------------------------------------------------------------------------
 * Modelo: 1 lambda por feature (domínio).
 *
 * Cada lambda recebe todas as rotas HTTP daquela feature.
 * A lambda resolve qual Case executar via path matching.
 *
 * Exemplo de deploy:
 *   /users/*   → lambda "users"  (user_validate + user_register)
 *   /billing/* → lambda "billing" (invoice_pay + balance_check)
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

import { ApiContext } from "../../core/api.case";
import { StreamContext, StreamEvent } from "../../core/stream.case";
import { AppLogger } from "../../core/shared/app_base_context";
import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";
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
 * Context factories
 * ------------------------------------------------------------------------ */

function createApiContext(feature: string): ApiContext {
  // ctx.cases carrega apenas os Cases da feature atual + dependências
  const featureCases = getFeature(feature);
  const casesInstances: Record<string, Record<string, unknown>> = {};

  // Instancia os Cases da feature para composição interna
  casesInstances[feature] = {};
  for (const [caseName, surfaces] of Object.entries(featureCases)) {
    if (surfaces.api) {
      // Lazy: cria instância para composição
      const ctx: ApiContext = {
        correlationId: generateId(),
        logger,
        cases: casesInstances, // referência circular intencional
      };
      casesInstances[feature][caseName] = {
        api: new (surfaces.api as new (ctx: ApiContext) => unknown)(ctx),
      };
    }
  }

  return {
    correlationId: generateId(),
    logger,
    cases: casesInstances,
  };
}

function createStreamContext(feature: string): StreamContext {
  return {
    correlationId: generateId(),
    logger,
    cases: {}, // stream normalmente não precisa de composição
  };
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

/* ==========================================================================
 * HTTP Lambda handler — 1 por feature
 * --------------------------------------------------------------------------
 * Recebe evento do API Gateway / ALB / Function URL.
 * Resolve o Case pelo path e delega para handler().
 *
 * Deploy:
 *   Lambda "users"   → rota /users/*
 *   Lambda "billing"  → rota /billing/*
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
      const instance = new (route.CaseClass as new (ctx: ApiContext) => {
        handler(input: unknown): Promise<unknown>;
      })(ctx);

      const input = body ? JSON.parse(body) : {};
      const result = await instance.handler(input);

      return {
        statusCode: 200,
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
    const instance = new (surfaces.api as new (ctx: ApiContext) => {
      router?(): unknown;
    })(tempCtx);

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

      const ctx = createStreamContext(featureName);
      const instance = new (entry.CaseClass as new (ctx: StreamContext) => {
        handler(event: StreamEvent): Promise<void>;
      })(ctx);

      await instance.handler(parsed);
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
    const instance = new (surfaces.stream as new (ctx: StreamContext) => {
      subscribe?(): unknown;
    })(tempCtx);

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

// Feature: billing — HTTP
// export const billingHttp = createFeatureHttpHandler("billing");

// Feature: billing — Stream
// export const billingStream = createFeatureStreamHandler("billing");
