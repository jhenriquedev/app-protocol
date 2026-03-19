import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { UiContext } from "../../core/ui.case";
import { type Dict } from "../../core/domain.case";
import { type AppLogger } from "../../core/shared/app_base_context";
import { createRegistry, type PortalConfig } from "./registry";
import { PortalRoot } from "./root";

const logger: AppLogger = {
  debug: (message, meta) => console.debug("[portal]", message, meta),
  info: (message, meta) => console.info("[portal]", message, meta),
  warn: (message, meta) => console.warn("[portal]", message, meta),
  error: (message, meta) => console.error("[portal]", message, meta),
};

const defaultConfig: PortalConfig = {
  apiBaseURL: "http://localhost:3000",
  port: 5173,
};

interface RenderableUiCase {
  view(): string;
}

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function sendHtml(
  res: ServerResponse,
  statusCode: number,
  body: string
): void {
  res.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body, null, 2));
}

function redirect(
  res: ServerResponse,
  location: string,
  statusCode = 303
): void {
  res.writeHead(statusCode, {
    location,
  });
  res.end();
}

function getRequestUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? "/", "http://localhost");
}

async function readFormBody(req: IncomingMessage): Promise<Record<string, string>> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const content = Buffer.concat(chunks).toString("utf8");
  const params = new URLSearchParams(content);

  return Object.fromEntries(
    [...params.entries()].map(([key, value]) => [key, value.trim()])
  );
}

export function bootstrap(config: PortalConfig = defaultConfig) {
  const registry = createRegistry(config);

  function createUiContext(extra?: Dict): UiContext {
    return {
      correlationId: generateId(),
      executionId: generateId(),
      logger,
      api: registry._providers.httpClient,
      packages: registry._packages,
      renderer: {
        runtime: "node-html",
      },
      extra: {
        apiBaseURL: config.apiBaseURL,
        ...extra,
      },
    };
  }

  async function renderRoot(options?: {
    taskCreateUi?: RenderableUiCase;
    flash?:
      | {
          type: "success" | "error";
          message: string;
        }
      | null;
    moveError?:
      | {
          taskId: string;
          message: string;
        }
      | null;
  }): Promise<string> {
    return PortalRoot({
      registry,
      createUiContext,
      taskCreateUi: options?.taskCreateUi,
      flash: options?.flash,
      moveError: options?.moveError,
    });
  }

  async function handleCreateAction(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const body = await readFormBody(req);
    const TaskCreateUi = registry._cases.tasks.task_create.ui;
    const taskCreateUi = new TaskCreateUi(
      createUiContext({
        actionPath: "/actions/task-create",
        dialogId: "create-task-dialog",
      })
    );

    try {
      const result = await taskCreateUi.submit({
        title: body.title ?? "",
        description: body.description || undefined,
      });

      redirect(
        res,
        `/?flashType=success&flashMessage=${encodeURIComponent(
          `Task "${result.task.title}" created successfully.`
        )}`
      );
    } catch (error: unknown) {
      const html = await renderRoot({
        taskCreateUi,
        flash: {
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to create task.",
        },
      });
      sendHtml(res, 400, html);
    }
  }

  async function handleMoveAction(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const body = await readFormBody(req);
    const taskId = body.taskId ?? "";
    const targetStatus = body.targetStatus ?? "";
    const TaskMoveUi = registry._cases.tasks.task_move.ui;
    const taskMoveUi = new TaskMoveUi(createUiContext());

    try {
      const result = await taskMoveUi.submit({
        taskId,
        targetStatus: targetStatus as "todo" | "doing" | "done",
      });

      redirect(
        res,
        `/?flashType=success&flashMessage=${encodeURIComponent(
          `Task "${result.task.title}" moved to ${result.task.status}.`
        )}`
      );
    } catch (error: unknown) {
      const html = await renderRoot({
        moveError: {
          taskId,
          message:
            error instanceof Error ? error.message : "Failed to move task.",
        },
      });
      sendHtml(res, 400, html);
    }
  }

  async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = getRequestUrl(req);
    const method = (req.method ?? "GET").toUpperCase();

    if (method === "GET" && url.pathname === "/") {
      const flashType = url.searchParams.get("flashType");
      const flashMessage = url.searchParams.get("flashMessage");
      const html = await renderRoot({
        flash:
          flashType === "success" || flashType === "error"
            ? {
                type: flashType,
                message: flashMessage ?? "",
              }
            : null,
      });
      sendHtml(res, 200, html);
      return;
    }

    if (method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        app: "node-example-portal",
        status: "ready",
      });
      return;
    }

    if (method === "GET" && url.pathname === "/manifest") {
      sendJson(res, 200, {
        app: "node-example-portal",
        runtime: "node-http-html",
        routes: ["/", "/health", "/manifest", "/actions/task-create", "/actions/task-move"],
        packages: Object.keys(registry._packages),
      });
      return;
    }

    if (method === "POST" && url.pathname === "/actions/task-create") {
      await handleCreateAction(req, res);
      return;
    }

    if (method === "POST" && url.pathname === "/actions/task-move") {
      await handleMoveAction(req, res);
      return;
    }

    sendHtml(
      res,
      404,
      await renderRoot({
        flash: {
          type: "error",
          message: `Route ${method} ${url.pathname} was not found in apps/portal.`,
        },
      })
    );
  }

  async function startPortal(): Promise<Server> {
    const server = createServer((req, res) => {
      void handleRequest(req, res).catch((error: unknown) => {
        logger.error("Portal request failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        sendJson(res, 500, {
          success: false,
          error: {
            code: "INTERNAL",
            message:
              error instanceof Error ? error.message : "Unhandled portal error",
          },
        });
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(registry._providers.port, () => resolve());
    });

    logger.info("Portal scaffold started", {
      port: registry._providers.port,
      packages: Object.keys(registry._packages),
    });

    return server;
  }

  return {
    registry,
    createUiContext,
    renderRoot,
    startPortal,
  };
}

const app = bootstrap();

export const registry = app.registry;
export const createUiContext = app.createUiContext;
export const renderRoot = app.renderRoot;
export const startPortal = app.startPortal;
