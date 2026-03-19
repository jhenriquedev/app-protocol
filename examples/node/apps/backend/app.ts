import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { type ApiContext, type ApiResponse } from "../../core/api.case";
import { type AppLogger } from "../../core/shared/app_base_context";
import { AppCaseError } from "../../core/shared/app_structural_contracts";
import { createRegistry, type BackendConfig } from "./registry";

const logger: AppLogger = {
  debug: (message, meta) => console.debug("[backend]", message, meta),
  info: (message, meta) => console.info("[backend]", message, meta),
  warn: (message, meta) => console.warn("[backend]", message, meta),
  error: (message, meta) => console.error("[backend]", message, meta),
};

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body, null, 2));
}

function getRequestPath(req: IncomingMessage): string {
  const url = req.url ?? "/";
  return new URL(url, "http://localhost").pathname;
}

type RouteRequest = {
  body?: unknown;
  method: string;
  path: string;
  params: Record<string, string>;
  req: IncomingMessage;
};

type RouteBinding = {
  method: string;
  path: string;
  handler?: (request: RouteRequest) => Promise<unknown> | unknown;
};

type RouteMatch = {
  route: RouteBinding;
  params: Record<string, string>;
};

function isRouteBinding(value: unknown): value is RouteBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    "method" in value &&
    "path" in value
  );
}

function isApiResponse(value: unknown): value is ApiResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof (value as { success?: unknown }).success === "boolean"
  );
}

function mapErrorCodeToStatus(code?: string): number {
  switch (code) {
    case "INVALID_REQUEST":
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

function sendStructuredError(
  res: ServerResponse,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): void {
  sendJson(res, statusCode, {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}

function matchRoutePath(
  routePath: string,
  actualPath: string
): Record<string, string> | null {
  const routeSegments = routePath.split("/").filter(Boolean);
  const pathSegments = actualPath.split("/").filter(Boolean);

  if (routeSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index]!;
    const pathSegment = pathSegments[index]!;

    if (routeSegment.startsWith(":")) {
      params[routeSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }

    if (routeSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}

async function readRequestBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const content = Buffer.concat(chunks).toString("utf8").trim();
  if (!content) {
    return undefined;
  }

  return JSON.parse(content) as unknown;
}

export function bootstrap(config: BackendConfig = {}) {
  const registry = createRegistry(config);

  function materializeCases(
    context: ApiContext
  ): Record<string, Record<string, Record<string, unknown>>> {
    return Object.fromEntries(
      Object.entries(registry._cases).map(([domainName, domainCases]) => [
        domainName,
        Object.fromEntries(
          Object.entries(domainCases).map(([caseName, surfaces]) => {
            const instances: Record<string, unknown> = {};

            if (surfaces.api) {
              instances.api = new surfaces.api(context);
            }

            return [caseName, instances];
          })
        ),
      ])
    );
  }

  function createApiContext(parent?: Partial<ApiContext>): ApiContext {
    const context: ApiContext = {
      correlationId: parent?.correlationId ?? generateId(),
      executionId: generateId(),
      tenantId: parent?.tenantId,
      userId: parent?.userId,
      config: parent?.config,
      logger,
      packages: registry._packages,
      cases: {},
      extra: {
        ...(parent?.extra ?? {}),
        providers: registry._providers,
      },
    };

    context.cases = materializeCases(context);
    return context;
  }

  const routes = Object.values(registry._cases).flatMap((domainCases) =>
    Object.values(domainCases).flatMap((surfaces) => {
      if (!surfaces.api) {
        return [];
      }

      const ApiCase = surfaces.api;
      const bootInstance = new ApiCase(
        createApiContext({ correlationId: "boot" })
      ) as {
        router?(): unknown;
        handler?(input: unknown): Promise<unknown>;
      };

      const route = bootInstance.router?.();
      if (!isRouteBinding(route)) {
        return [];
      }

      const mountedRoute: RouteBinding = {
        method: route.method.toUpperCase(),
        path: route.path,
        handler: async (request: RouteRequest) => {
          const runtimeInstance = new ApiCase(createApiContext()) as {
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
            return runtimeInstance.handler(request.body);
          }

          throw new Error(
            `Mounted route ${route.method} ${route.path} does not expose a handler`
          );
        },
      };

      return [mountedRoute];
    })
  );

  function resolveRoute(method: string, path: string): RouteMatch | undefined {
    for (const route of routes) {
      if (route.method !== method) {
        continue;
      }

      const params = matchRoutePath(route.path, path);
      if (params) {
        return { route, params };
      }
    }

    return undefined;
  }

  async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const path = getRequestPath(req);
    const method = (req.method ?? "GET").toUpperCase();

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      res.end();
      return;
    }

    if (method === "GET" && path === "/health") {
      sendJson(res, 200, {
        ok: true,
        app: "node-example-backend",
        status: "ready",
      });
      return;
    }

    if (method === "GET" && path === "/manifest") {
      sendJson(res, 200, {
        app: "node-example-backend",
        port: registry._providers.port,
        registeredDomains: Object.keys(registry._cases),
        packages: Object.keys(registry._packages),
        routes: routes.map((route) => `${route.method} ${route.path}`),
      });
      return;
    }

    const matchedRoute = resolveRoute(method, path);

    if (matchedRoute?.route.handler) {
      let body: unknown;

      try {
        body = await readRequestBody(req);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Invalid request payload";

        sendStructuredError(res, 400, "INVALID_REQUEST", message);
        return;
      }

      try {
        const response = await matchedRoute.route.handler({
          body,
          method,
          path,
          params: matchedRoute.params,
          req,
        });

        if (isApiResponse(response)) {
          const statusCode =
            response.statusCode ??
            (response.success
              ? 200
              : mapErrorCodeToStatus(response.error?.code));

          sendJson(res, statusCode, response);
          return;
        }

        sendJson(res, 200, response);
        return;
      } catch (error: unknown) {
        if (error instanceof AppCaseError) {
          sendStructuredError(
            res,
            mapErrorCodeToStatus(error.code),
            error.code,
            error.message,
            error.details
          );
          return;
        }

        logger.error("Unhandled backend route error", {
          error: error instanceof Error ? error.message : "unknown",
          method,
          path,
        });

        sendStructuredError(
          res,
          500,
          "INTERNAL",
          "Internal backend scaffold error."
        );
        return;
      }
    }

    sendStructuredError(
      res,
      404,
      "NOT_FOUND",
      "Route not found in structural scaffold.",
      { method, path }
    );
  }

  async function startBackend(): Promise<Server> {
    const server = createServer((req, res) => {
      void handleRequest(req, res).catch((error: unknown) => {
        logger.error("Unhandled backend scaffold error", {
          error: error instanceof Error ? error.message : "unknown",
        });

        sendStructuredError(
          res,
          500,
          "INTERNAL",
          "Internal backend scaffold error."
        );
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(registry._providers.port, resolve);
    });

    logger.info("Backend scaffold started", {
      port: registry._providers.port,
      packages: Object.keys(registry._packages),
    });

    return server;
  }

  return {
    registry,
    createApiContext,
    handleRequest,
    startBackend,
  };
}

const app = bootstrap();

export const registry = app.registry;
export const createApiContext = app.createApiContext;
export const handleRequest = app.handleRequest;
export const startBackend = app.startBackend;
