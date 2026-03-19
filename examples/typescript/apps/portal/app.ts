import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { type UiContext } from "../../core/ui.case";
import { type AppLogger } from "../../core/shared/app_base_context";
import { AppCaseError } from "../../core/shared/app_structural_contracts";
import { createRegistry, type PortalConfig } from "./registry";
import { renderPortalRoot } from "./root";

const logger: AppLogger = {
  debug: (message, meta) => console.debug("[typescript/portal]", message, meta),
  info: (message, meta) => console.info("[typescript/portal]", message, meta),
  warn: (message, meta) => console.warn("[typescript/portal]", message, meta),
  error: (message, meta) => console.error("[typescript/portal]", message, meta),
};

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

async function readTextBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readFormBody(
  request: IncomingMessage
): Promise<Record<string, string>> {
  const text = await readTextBody(request);
  const params = new URLSearchParams(text);
  return Object.fromEntries(params.entries());
}

function sendHtml(response: ServerResponse, statusCode: number, html: string): void {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
  });
  response.end(html);
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

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(303, {
    location,
  });
  response.end();
}

export function bootstrap(config: PortalConfig = {}) {
  const registry = createRegistry(config);

  function createUiContext(extra?: Record<string, unknown>): UiContext {
    return {
      correlationId: generateId(),
      executionId: generateId(),
      logger,
      api: registry._providers.httpClient,
      packages: registry._packages,
      extra,
    };
  }

  async function renderHome(
    response: ServerResponse,
    state?: {
      flash?: { tone: "success" | "error"; message: string } | null;
      createError?: string;
      createValues?: { title?: string; description?: string };
      moveError?: { itemId: string; message: string } | null;
      statusCode?: number;
    }
  ) {
    const html = await renderPortalRoot({
      registry,
      createUiContext,
      flash: state?.flash,
      createError: state?.createError,
      createValues: state?.createValues,
      moveError: state?.moveError,
    });

    sendHtml(response, state?.statusCode ?? 200, html);
  }

  async function handleTaskCreateAction(
    request: IncomingMessage,
    response: ServerResponse
  ) {
    const form = await readFormBody(request);
    const apiResponse = (await registry._providers.httpClient.request({
      method: "POST",
      url: "/tasks",
      input: {
        title: form.title ?? "",
        description: form.description || undefined,
      },
    })) as {
      success: boolean;
      error?: { code: string; message: string };
    };

    if (apiResponse.success) {
      redirect(response, "/?flash=created");
      return;
    }

    await renderHome(response, {
      statusCode: 400,
      createError: apiResponse.error?.message ?? "Could not create work item.",
      createValues: {
        title: form.title,
        description: form.description,
      },
    });
  }

  async function handleTaskMoveAction(
    request: IncomingMessage,
    response: ServerResponse
  ) {
    const form = await readFormBody(request);
    const apiResponse = (await registry._providers.httpClient.request({
      method: "PATCH",
      url: `/tasks/${form.itemId}/status`,
      input: {
        targetStatus: form.targetStatus,
      },
    })) as {
      success: boolean;
      error?: { code: string; message: string };
    };

    if (apiResponse.success) {
      redirect(response, "/?flash=moved");
      return;
    }

    await renderHome(response, {
      statusCode: 400,
      moveError: {
        itemId: form.itemId,
        message: apiResponse.error?.message ?? "Could not move work item.",
      },
    });
  }

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", "http://localhost");

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
          ok: true,
          host: "portal",
          port: registry._providers.port,
          backendBaseUrl: registry._providers.backendBaseUrl,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/manifest") {
        sendJson(response, 200, {
          host: "portal",
          routes: [
            "GET /",
            "POST /actions/task-create",
            "POST /actions/task-move",
            "GET /health",
            "GET /manifest",
          ],
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/") {
        const flashParam = url.searchParams.get("flash");
        const flash =
          flashParam === "created"
            ? { tone: "success" as const, message: "Work item created." }
            : flashParam === "moved"
              ? { tone: "success" as const, message: "Work item moved." }
              : null;
        await renderHome(response, {
          flash,
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/actions/task-create") {
        await handleTaskCreateAction(request, response);
        return;
      }

      if (request.method === "POST" && url.pathname === "/actions/task-move") {
        await handleTaskMoveAction(request, response);
        return;
      }

      sendJson(response, 404, {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `No portal route matched ${request.method} ${url.pathname}`,
        },
      });
    } catch (error) {
      const appError =
        error instanceof AppCaseError
          ? error
          : new AppCaseError(
              "INTERNAL",
              error instanceof Error ? error.message : "Unexpected portal error"
            );

      logger.error("portal request failed", {
        path: request.url,
        code: appError.code,
        message: appError.message,
      });

      await renderHome(response, {
        statusCode: 500,
        flash: {
          tone: "error",
          message: appError.message,
        },
      });
    }
  }

  function start() {
    const server = createServer((request, response) => {
      void handle(request, response);
    });

    return new Promise<typeof server>((resolve) => {
      server.listen(registry._providers.port, () => {
        logger.info("portal listening", {
          port: registry._providers.port,
        });
        resolve(server);
      });
    });
  }

  return {
    registry,
    createUiContext,
    handle,
    start,
  };
}
