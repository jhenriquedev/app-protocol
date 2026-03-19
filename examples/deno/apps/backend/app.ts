import { type ApiContext, type ApiResponse } from "../../core/api.case";
import { type AppLogger } from "../../core/shared/app_base_context";
import { AppCaseError } from "../../core/shared/app_structural_contracts";
import { type BackendConfig, createRegistry } from "./registry";

const logger: AppLogger = {
  debug: (message, meta) => console.debug("[backend]", message, meta),
  info: (message, meta) => console.info("[backend]", message, meta),
  warn: (message, meta) => console.warn("[backend]", message, meta),
  error: (message, meta) => console.error("[backend]", message, meta),
};

type BackendServer = Deno.HttpServer<Deno.NetAddr>;

type RouteRequest = {
  body?: unknown;
  method: string;
  path: string;
  params: Record<string, string>;
  req: Request;
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

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
}

function corsHeaders(methods: string): Headers {
  return new Headers({
    "access-control-allow-origin": "*",
    "access-control-allow-methods": methods,
    "access-control-allow-headers": "content-type",
  });
}

function sendJson(statusCode: number, body: unknown): Response {
  const headers = corsHeaders("GET,POST,PATCH,OPTIONS");
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(body, null, 2), {
    status: statusCode,
    headers,
  });
}

function getRequestPath(req: Request): string {
  return new URL(req.url).pathname;
}

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
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return sendJson(statusCode, {
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
  actualPath: string,
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

async function readRequestBody(req: Request): Promise<unknown> {
  const content = (await req.text()).trim();

  if (!content) {
    return undefined;
  }

  return JSON.parse(content) as unknown;
}

export function bootstrap(config: BackendConfig = {}) {
  const registry = createRegistry(config);
  let listeningPort = registry._providers.port;

  function materializeCases(
    context: ApiContext,
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
          }),
        ),
      ]),
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
        createApiContext({ correlationId: "boot" }),
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
            `Mounted route ${route.method} ${route.path} does not expose a handler`,
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

  async function handleRequest(req: Request): Promise<Response> {
    const path = getRequestPath(req);
    const method = req.method.toUpperCase();

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders("GET,POST,PATCH,OPTIONS"),
      });
    }

    if (method === "GET" && path === "/health") {
      return sendJson(200, {
        ok: true,
        app: "deno-example-backend",
        status: "ready",
      });
    }

    if (method === "GET" && path === "/manifest") {
      return sendJson(200, {
        app: "deno-example-backend",
        port: listeningPort,
        registeredDomains: Object.keys(registry._cases),
        packages: Object.keys(registry._packages),
        routes: routes.map((route) => `${route.method} ${route.path}`),
      });
    }

    const matchedRoute = resolveRoute(method, path);

    if (matchedRoute?.route.handler) {
      let body: unknown;

      try {
        body = await readRequestBody(req);
      } catch (error: unknown) {
        const message = error instanceof Error
          ? error.message
          : "Invalid request payload";

        return sendStructuredError(400, "INVALID_REQUEST", message);
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
          const statusCode = response.statusCode ??
            (response.success
              ? 200
              : mapErrorCodeToStatus(response.error?.code));

          return sendJson(statusCode, response);
        }

        return sendJson(200, response);
      } catch (error: unknown) {
        if (error instanceof AppCaseError) {
          return sendStructuredError(
            mapErrorCodeToStatus(error.code),
            error.code,
            error.message,
            error.details,
          );
        }

        logger.error("Unhandled backend route error", {
          error: error instanceof Error ? error.message : "unknown",
          method,
          path,
        });

        return sendStructuredError(
          500,
          "INTERNAL",
          "Internal backend scaffold error.",
        );
      }
    }

    return sendStructuredError(
      404,
      "NOT_FOUND",
      "Route not found in structural scaffold.",
      { method, path },
    );
  }

  async function startBackend(): Promise<BackendServer> {
    const server = Deno.serve(
      {
        hostname: "127.0.0.1",
        port: registry._providers.port,
        onListen: () => undefined,
      },
      handleRequest,
    );

    listeningPort = server.addr.port;

    logger.info("Backend scaffold started", {
      port: listeningPort,
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
