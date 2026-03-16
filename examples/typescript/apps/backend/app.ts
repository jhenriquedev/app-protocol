/* ========================================================================== *
 * Backend App — Bootstrap
 * --------------------------------------------------------------------------
 * Monolith host: API routes + stream subscriptions.
 *
 * Creates in-memory stores and injects them via ctx.db.
 *
 * Composition model:
 * ctx.cases contains factory wrappers, not singleton instances.
 * Each call to handler() creates a fresh instance with a per-execution
 * context (unique correlationId), preserving AppBaseContext semantics.
 * The casesMap structure is built once at boot; only the instances
 * inside are per-call.
 * ========================================================================== */

import { ApiContext } from "../../core/api.case";
import { StreamContext } from "../../core/stream.case";
import { AppLogger } from "../../core/shared/app_base_context";
import { Task } from "../../cases/tasks/task_create/task_create.domain.case";
import { Notification } from "../../cases/notifications/notification_send/notification_send.domain.case";
import { registry, BackendCasesMap } from "./registry";

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
 * In-memory stores (injected as infrastructure via ctx.db)
 * ------------------------------------------------------------------------ */

const db = {
  tasks: new Map<string, Task>(),
  notifications: [] as Notification[],
};

/* --------------------------------------------------------------------------
 * ID generator
 * ------------------------------------------------------------------------ */

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

/* --------------------------------------------------------------------------
 * Boot — build cases map with per-call factory wrappers
 * --------------------------------------------------------------------------
 * The casesMap is a stable structure built once at boot.
 * Each surface entry is a thin wrapper that creates a fresh instance
 * with a per-execution context on every handler() call.
 *
 * This preserves AppBaseContext semantics:
 * - Each execution gets its own correlationId
 * - Composition calls inherit fresh context, not stale boot context
 * - The casesMap itself is shared (no per-request rebuild)
 * ------------------------------------------------------------------------ */

type CasesMap = Record<string, Record<string, Record<string, unknown>>>;

function buildCasesMap(): CasesMap {
  const cases: CasesMap = {};

  for (const [domain, domainCases] of Object.entries(registry)) {
    cases[domain] = {};
    for (const [caseName, surfaces] of Object.entries(domainCases)) {
      const entry: Record<string, unknown> = {};

      if (surfaces.api) {
        const ApiClass = surfaces.api;
        entry.api = {
          handler: async (input: unknown) => {
            const ctx: ApiContext = {
              correlationId: generateId(),
              logger,
              db,
              cases,
            };
            const instance = new ApiClass(ctx);
            return (instance as { handler(input: unknown): Promise<unknown> }).handler(input);
          },
        };
      }

      if (surfaces.stream) {
        const StreamClass = surfaces.stream;
        entry.stream = {
          handler: async (event: unknown) => {
            const ctx: StreamContext = {
              correlationId: generateId(),
              logger,
              db,
              cases,
            };
            const instance = new StreamClass(ctx);
            return (instance as { handler(event: unknown): Promise<void> }).handler(event);
          },
        };
      }

      cases[domain]![caseName] = entry;
    }
  }

  return cases;
}

const casesMap = buildCasesMap();

/* --------------------------------------------------------------------------
 * Request context factories
 * --------------------------------------------------------------------------
 * Used by route handlers and stream listeners for the top-level entry.
 * Composition inside Cases uses the factory wrappers in casesMap,
 * so each composed call gets its own fresh context automatically.
 * ------------------------------------------------------------------------ */

function createApiContext(): ApiContext {
  return {
    correlationId: generateId(),
    logger,
    db,
    cases: casesMap,
  };
}

function createStreamContext(): StreamContext {
  return {
    correlationId: generateId(),
    logger,
    db,
    cases: casesMap,
  };
}

/* --------------------------------------------------------------------------
 * Monolith bootstrap
 * --------------------------------------------------------------------------
 * Route/subscription collection uses temporary instances (boot-time only).
 * These are discarded after collecting router()/subscribe() metadata.
 * Request-time instances are created fresh per call.
 * ------------------------------------------------------------------------ */

async function startBackend(): Promise<void> {
  const routes: unknown[] = [];
  const subscriptions: unknown[] = [];

  for (const [domain, domainCases] of Object.entries(registry)) {
    for (const [caseName, surfaces] of Object.entries(domainCases)) {
      if (surfaces.api) {
        const bootCtx: ApiContext = { correlationId: "boot", logger, db };
        const instance = new surfaces.api(bootCtx) as { router?(): unknown };

        if (instance.router) {
          const route = instance.router();
          routes.push(route);
          logger.info(`Mounted API: ${domain}/${caseName}`, { route });
        }
      }

      if (surfaces.stream) {
        const bootCtx: StreamContext = { correlationId: "boot", logger, db };
        const instance = new surfaces.stream(bootCtx) as { subscribe?(): unknown };

        if (instance.subscribe) {
          const sub = instance.subscribe();
          subscriptions.push(sub);
          logger.info(`Mounted Stream: ${domain}/${caseName}`, { sub });
        }
      }
    }
  }

  logger.info("Backend started", {
    routes: routes.length,
    subscriptions: subscriptions.length,
  });
}

export { registry, db, casesMap, createApiContext, createStreamContext, startBackend };
