/* ========================================================================== *
 * Backend App — Bootstrap
 * --------------------------------------------------------------------------
 * Example host for a backend application.
 *
 * This file demonstrates how a host:
 * 1. Imports its registry (only API + Stream surfaces)
 * 2. Creates contexts with ctx.cases populated from the registry
 * 3. Mounts the runtime (routes, subscriptions)
 *
 * The deployment model (monolith, lambda, edge) changes only HOW
 * this file consumes the registry — the Cases themselves are unchanged.
 * ========================================================================== */

import { ApiContext } from "../../core/api.case";
import { StreamContext } from "../../core/stream.case";
import { AppLogger } from "../../core/shared/app_base_context";
import { registry } from "./registry";

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
 * Context factories
 * --------------------------------------------------------------------------
 * The host creates contexts with ctx.cases populated from the registry.
 * This is how _composition accesses other Cases at runtime.
 * ------------------------------------------------------------------------ */

function buildCasesFromRegistry(): Record<string, unknown> {
  const cases: Record<string, Record<string, Record<string, unknown>>> = {};

  for (const [domain, domainCases] of Object.entries(registry)) {
    cases[domain] = {};
    for (const [caseName, surfaces] of Object.entries(domainCases)) {
      cases[domain][caseName] = {};

      if (surfaces.api) {
        // Lazy instantiation — creates the context with cases reference
        const ctx = createApiContext();
        cases[domain][caseName] = {
          ...cases[domain][caseName],
          api: new (surfaces.api as new (ctx: ApiContext) => unknown)(ctx),
        };
      }
    }
  }

  return cases;
}

function createApiContext(): ApiContext {
  return {
    correlationId: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    logger,
    cases: buildCasesFromRegistry(),
  };
}

function createStreamContext(): StreamContext {
  return {
    correlationId: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    logger,
    cases: buildCasesFromRegistry(),
  };
}

/* --------------------------------------------------------------------------
 * Monolith bootstrap
 * --------------------------------------------------------------------------
 * Iterates the registry, instantiates each Case, collects routers.
 * In a real project this would use Hono, Express, Fastify, etc.
 * ------------------------------------------------------------------------ */

async function startMonolith(): Promise<void> {
  const routes: unknown[] = [];
  const subscriptions: unknown[] = [];

  for (const [domain, domainCases] of Object.entries(registry)) {
    for (const [caseName, surfaces] of Object.entries(domainCases)) {
      // Mount API surfaces
      if (surfaces.api) {
        const ctx = createApiContext();
        const instance = new (surfaces.api as new (ctx: ApiContext) => {
          router?(): unknown;
        })(ctx);

        if (instance.router) {
          const route = instance.router();
          routes.push(route);
          logger.info(`Mounted API: ${domain}/${caseName}`, { route });
        }
      }

      // Mount Stream surfaces
      if (surfaces.stream) {
        const ctx = createStreamContext();
        const instance = new (surfaces.stream as new (ctx: StreamContext) => {
          subscribe?(): unknown;
        })(ctx);

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

/* --------------------------------------------------------------------------
 * Lambda bootstrap (alternative)
 * --------------------------------------------------------------------------
 * For lambda: export the registry and context factories.
 * Each lambda function imports what it needs.
 *
 * Example lambda function:
 *
 *   import { registry } from "../app";
 *   import { createApiContext } from "../app";
 *
 *   export const handler = async (event) => {
 *     const ctx = createApiContext();
 *     const Case = registry.users.user_register.api;
 *     const instance = new Case(ctx);
 *     return instance.handler(event.body);
 *   };
 * ------------------------------------------------------------------------ */

export { registry, createApiContext, createStreamContext };

// Uncomment for monolith:
// startMonolith();
