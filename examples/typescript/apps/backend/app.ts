/* ========================================================================== *
 * Backend App — Bootstrap
 * --------------------------------------------------------------------------
 * Monolith host: API routes + stream subscriptions.
 *
 * Creates in-memory stores and injects them via ctx.db.
 * Builds cases map at boot for cross-case composition via ctx.cases.
 * ========================================================================== */

import { ApiContext } from "../../core/api.case";
import { StreamContext, StreamEvent } from "../../core/stream.case";
import { AppLogger } from "../../core/shared/app_base_context";
import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";
import { Task } from "../../cases/tasks/task_create/task_create.domain.case";
import { Notification } from "../../cases/notifications/notification_send/notification_send.domain.case";
import { registry } from "./registry";

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
 * Boot — build cases map once
 * ------------------------------------------------------------------------ */

type CasesMap = Record<string, Record<string, Record<string, unknown>>>;

function buildCasesMap(): CasesMap {
  const cases: CasesMap = {};

  const bootApiCtx: ApiContext = {
    correlationId: "boot",
    logger,
    db,
    cases,
  };

  const bootStreamCtx: StreamContext = {
    correlationId: "boot",
    logger,
    db,
    cases,
  };

  for (const [domain, domainCases] of Object.entries(registry)) {
    cases[domain] = {};
    for (const [caseName, _surfaces] of Object.entries(domainCases)) {
      const surfaces = _surfaces as AppCaseSurfaces;
      const entry: Record<string, unknown> = {};

      if (surfaces.api) {
        entry.api = new surfaces.api(bootApiCtx);
      }

      if (surfaces.stream) {
        entry.stream = new surfaces.stream(bootStreamCtx);
      }

      cases[domain]![caseName] = entry;
    }
  }

  return cases;
}

const casesMap = buildCasesMap();

/* --------------------------------------------------------------------------
 * Request context factories
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
 * ------------------------------------------------------------------------ */

async function startBackend(): Promise<void> {
  const routes: unknown[] = [];
  const subscriptions: unknown[] = [];

  for (const [domain, domainCases] of Object.entries(registry)) {
    for (const [caseName, _surfaces] of Object.entries(domainCases)) {
      const surfaces = _surfaces as AppCaseSurfaces;

      if (surfaces.api) {
        const ctx = createApiContext();
        const instance = new surfaces.api(ctx) as { router?(): unknown };

        if (instance.router) {
          const route = instance.router();
          routes.push(route);
          logger.info(`Mounted API: ${domain}/${caseName}`, { route });
        }
      }

      if (surfaces.stream) {
        const ctx = createStreamContext();
        const instance = new surfaces.stream(ctx) as { subscribe?(): unknown };

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
