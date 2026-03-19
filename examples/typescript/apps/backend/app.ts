import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { type ApiContext, type ApiResponse } from "../../core/api.case";
import { type AppLogger } from "../../core/shared/app_base_context";
import { AppCaseError } from "../../core/shared/app_structural_contracts";
import { type AppCaseSurfaces } from "../../core/shared/app_host_contracts";
import { createRegistry, type BackendConfig } from "./registry";

type ParentExecutionContext = {
  correlationId: string;
  tenantId?: string;
  userId?: string;
  config?: ApiContext["config"];
  auth?: ApiContext["auth"];
  db?: ApiContext["db"];
  storage?: ApiContext["storage"];
  extra?: ApiContext["extra"];
};

type CasesMap = Record<string, Record<string, Record<string, unknown>>>;

const logger: AppLogger = {
  debug: (message, meta) => console.debug("[typescript/backend]", message, meta),
  info: (message, meta) => console.info("[typescript/backend]", message, meta),
  warn: (message, meta) => console.warn("[typescript/backend]", message, meta),
  error: (message, meta) => console.error("[typescript/backend]", message, meta),
};

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function toHttpStatus(code?: string): number {
  switch (code) {
    case "VALIDATION_FAILED":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    default:
      return 500;
  }
}

async function readTextBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const text = await readTextBody(request);
  if (text.trim().length === 0) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendApiResult(
  response: ServerResponse,
  result: ApiResponse<unknown>,
  successStatusCode = 200
): void {
  if (result.success) {
    sendJson(response, result.statusCode ?? successStatusCode, result);
    return;
  }

  sendJson(response, result.statusCode ?? toHttpStatus(result.error?.code), result);
}

export function bootstrap(config: BackendConfig = {}) {
  const registry = createRegistry(config);

  function createCasesMap(parent: ParentExecutionContext): CasesMap {
    const cases: CasesMap = {};

    for (const [domain, domainCases] of Object.entries(registry._cases)) {
      cases[domain] = {};

      for (const [caseName, entry] of Object.entries(domainCases)) {
        const surfaces = entry as AppCaseSurfaces;
        const instanceMap: Record<string, unknown> = {};

        if (surfaces.api) {
          const ApiClass = surfaces.api;
          instanceMap.api = {
            handler: async (input: unknown) => {
              const api = new ApiClass(createApiContext(parent)) as {
                handler(payload: unknown): Promise<ApiResponse<unknown>>;
              };
              return api.handler(input);
            },
          };
        }

        cases[domain][caseName] = instanceMap;
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
      auth: parent?.auth,
      db: parent?.db,
      storage: parent?.storage,
      extra: parent?.extra,
      packages: registry._packages,
      cases: {},
    };

    ctx.cases = createCasesMap(ctx);
    return ctx;
  }

  async function handleHealth(_request: IncomingMessage, response: ServerResponse) {
    sendJson(response, 200, {
      ok: true,
      host: "backend",
      port: registry._providers.port,
    });
  }

  async function handleManifest(
    _request: IncomingMessage,
    response: ServerResponse
  ) {
    sendJson(response, 200, {
      host: "backend",
      routes: [
        "GET /health",
        "GET /manifest",
        "GET /tasks",
        "POST /tasks",
        "PATCH /tasks/:id/status",
      ],
      domains: Object.keys(registry._cases),
    });
  }

  async function handleTaskList(
    _request: IncomingMessage,
    response: ServerResponse
  ) {
    const api = new registry._cases.tasks.task_list.api(createApiContext());
    const result = await api.handler({});
    sendApiResult(response, result);
  }

  async function handleTaskCreate(
    request: IncomingMessage,
    response: ServerResponse
  ) {
    const input = await readJsonBody(request);
    const api = new registry._cases.tasks.task_create.api(createApiContext());
    const result = await api.handler(input as never);
    sendApiResult(response, result, 201);
  }

  async function handleTaskMove(
    request: IncomingMessage,
    response: ServerResponse,
    itemId: string
  ) {
    const body = (await readJsonBody(request)) as {
      targetStatus?: string;
    };
    const api = new registry._cases.tasks.task_move.api(createApiContext());
    const result = await api.handler({
      itemId,
      targetStatus: body.targetStatus as never,
    });
    sendApiResult(response, result);
  }

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", "http://localhost");

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        await handleHealth(request, response);
        return;
      }

      if (request.method === "GET" && url.pathname === "/manifest") {
        await handleManifest(request, response);
        return;
      }

      if (request.method === "GET" && url.pathname === "/tasks") {
        await handleTaskList(request, response);
        return;
      }

      if (request.method === "POST" && url.pathname === "/tasks") {
        await handleTaskCreate(request, response);
        return;
      }

      if (
        request.method === "PATCH" &&
        /^\/tasks\/[^/]+\/status$/.test(url.pathname)
      ) {
        const [, , itemId] = url.pathname.split("/");
        await handleTaskMove(request, response, itemId);
        return;
      }

      sendJson(response, 404, {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `No backend route matched ${request.method} ${url.pathname}`,
        },
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(response, 400, {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Request body is not valid JSON",
          },
        });
        return;
      }

      const appError =
        error instanceof AppCaseError
          ? error
          : new AppCaseError(
              "INTERNAL",
              error instanceof Error ? error.message : "Unexpected backend error"
            );

      logger.error("backend request failed", {
        path: request.url,
        code: appError.code,
        message: appError.message,
      });

      sendJson(response, toHttpStatus(appError.code), {
        success: false,
        error: appError.toAppError(),
      });
    }
  }

  function start() {
    const server = createServer((request, response) => {
      void handle(request, response);
    });

    return new Promise<typeof server>((resolve) => {
      server.listen(registry._providers.port, () => {
        logger.info("backend listening", {
          port: registry._providers.port,
        });
        resolve(server);
      });
    });
  }

  return {
    registry,
    createApiContext,
    handle,
    start,
  };
}
