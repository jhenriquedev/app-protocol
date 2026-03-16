/* ========================================================================== *
 * Portal App — Bootstrap
 * --------------------------------------------------------------------------
 * Frontend host: mounts UI surfaces.
 *
 * Consome o registry unificado:
 * - registry._cases     → instancia UI Cases
 * - registry._providers → ctx.api
 * - registry._packages  → ctx.packages
 * ========================================================================== */

import { UiContext } from "../../core/ui.case";
import { AppLogger } from "../../core/shared/app_base_context";
import { createRegistry, type PortalConfig } from "./registry";

const logger: AppLogger = {
  debug: (msg, meta) => console.log("[DEBUG]", msg, meta),
  info: (msg, meta) => console.log("[INFO]", msg, meta),
  warn: (msg, meta) => console.warn("[WARN]", msg, meta),
  error: (msg, meta) => console.error("[ERROR]", msg, meta),
};

const defaultConfig: PortalConfig = {
  apiBaseURL: "http://localhost:3000",
};

export function bootstrap(config: PortalConfig = defaultConfig) {
  const registry = createRegistry(config);

  function createUiContext(): UiContext {
    return {
      correlationId: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      executionId: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      logger,
      api: registry._providers.httpClient,
      packages: registry._packages,
    };
  }

  async function startPortal(): Promise<void> {
    const views: Array<{ domain: string; caseName: string; view: unknown }> = [];

    for (const [domain, domainCases] of Object.entries(registry._cases)) {
      for (const [caseName, surfaces] of Object.entries(domainCases)) {
        if (surfaces.ui) {
          const ctx = createUiContext();
          const instance = new surfaces.ui(ctx) as { view(): unknown };

          views.push({
            domain,
            caseName,
            view: instance.view(),
          });

          logger.info(`Mounted UI: ${domain}/${caseName}`);
        }
      }
    }

    logger.info("Portal started", { views: views.length });
  }

  return { registry, createUiContext, startPortal };
}

const app = bootstrap();

export const registry = app.registry;
export const createUiContext = app.createUiContext;
export const startPortal = app.startPortal;
