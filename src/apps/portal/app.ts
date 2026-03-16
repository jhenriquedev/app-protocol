/* ========================================================================== *
 * Portal App — Bootstrap
 * --------------------------------------------------------------------------
 * Host para aplicação frontend (portal).
 *
 * Consome o registry unificado:
 * - registry._cases     → instancia UI Cases
 * - registry._providers → ctx.api (AppHttpClient via fetch adapter)
 * - registry._packages  → ctx.packages (DesignSystem, DateUtils)
 *
 * Cases de UI acessam componentes via ctx.packages.designSystem
 * e HTTP via ctx.api — sem conhecer implementação concreta.
 * ========================================================================== */

import { UiContext } from "../../core/ui.case";
import { AppLogger } from "../../core/shared/app_base_context";
import { createRegistry, type PortalConfig } from "./registry";

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
 * Bootstrap
 * ------------------------------------------------------------------------ */

export function bootstrap(config: PortalConfig) {
  const registry = createRegistry(config);

  /* ........................................................................
   * Context factory
   * ......................................................................
   * O contexto de UI recebe:
   * - api: do _providers (adapter fetch → AppHttpClient)
   * - packages: do _packages (DesignSystem, DateUtils)
   * ...................................................................... */

  function createUiContext(): UiContext {
    return {
      correlationId: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      logger,
      // _providers → ctx.api
      api: registry._providers.httpClient,
      // _packages → ctx.packages
      packages: registry._packages,
    };
  }

  /* ........................................................................
   * Startup
   * ...................................................................... */

  async function start(): Promise<void> {
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

  return { registry, createUiContext, start };
}
