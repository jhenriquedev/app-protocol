import { UiContext } from "../../core/ui.case";
import { type Dict } from "../../core/domain.case";
import { type AppLogger } from "../../core/shared/app_base_context";
import { createRegistry, type PortalConfig } from "./registry";

const logger: AppLogger = {
  debug: (message, meta) => console.debug("[portal]", message, meta),
  info: (message, meta) => console.info("[portal]", message, meta),
  warn: (message, meta) => console.warn("[portal]", message, meta),
  error: (message, meta) => console.error("[portal]", message, meta),
};

const defaultConfig: PortalConfig = {
  apiBaseURL: "http://localhost:3000",
};

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
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
        runtime: "angular",
      },
      extra: {
        apiBaseURL: config.apiBaseURL,
        ...extra,
      },
    };
  }

  return {
    registry,
    createUiContext,
  };
}

const app = bootstrap();

export const registry = app.registry;
export const createUiContext = app.createUiContext;
