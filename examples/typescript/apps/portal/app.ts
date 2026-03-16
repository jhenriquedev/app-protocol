/* ========================================================================== *
 * Portal App — Bootstrap
 * --------------------------------------------------------------------------
 * Frontend host: mounts UI surfaces.
 * ========================================================================== */

import { UiContext } from "../../core/ui.case";
import { AppLogger } from "../../core/shared/app_base_context";
import { AppHttpClient } from "../../core/shared/app_infra_contracts";
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
 * API client
 * ------------------------------------------------------------------------ */

const apiClient: AppHttpClient = {
  async request(config: unknown): Promise<unknown> {
    const { method, url, body } = config as {
      method: string;
      url: string;
      body?: unknown;
    };

    const response = await fetch(`http://localhost:3000${url}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    const result = (await response.json()) as { data: unknown };
    return result.data;
  },
};

/* --------------------------------------------------------------------------
 * Context factory
 * ------------------------------------------------------------------------ */

function createUiContext(): UiContext {
  return {
    correlationId: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    logger,
    api: apiClient,
  };
}

/* --------------------------------------------------------------------------
 * Bootstrap
 * ------------------------------------------------------------------------ */

async function startPortal(): Promise<void> {
  const views: Array<{ domain: string; caseName: string; view: unknown }> = [];

  for (const [domain, domainCases] of Object.entries(registry)) {
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

export { registry, createUiContext, startPortal };
