/* ========================================================================== *
 * Backend App — Bootstrap
 * --------------------------------------------------------------------------
 * Example host for a backend application.
 *
 * This file demonstrates how a host:
 * 1. Imports its registry (only API + Stream surfaces)
 * 2. Builds a shared cases map once at boot (no per-request instantiation)
 * 3. Creates per-request contexts with a single correlationId
 * 4. Mounts the runtime (routes, subscriptions)
 *
 * The deployment model (monolith, lambda, edge) changes only HOW
 * this file consumes the registry — the Cases themselves are unchanged.
 *
 * Instanciação:
 * - Cases são instanciados uma vez no boot com um contexto de bootstrap.
 * - O mapa de cases é construído em duas fases (create → populate)
 *   para evitar recursão e garantir que ctx.cases esteja completo
 *   quando qualquer Case acessar _composition.
 * - Em cada request, o host cria um contexto fresco com correlationId
 *   único e o mesmo mapa de cases pré-construído.
 * ========================================================================== */

import { ApiContext } from "../../core/api.case";
import { StreamContext } from "../../core/stream.case";
import { AppLogger } from "../../core/shared/app_base_context";
import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";
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
 * ID generator
 * ------------------------------------------------------------------------ */

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

/* --------------------------------------------------------------------------
 * Boot — build cases map once
 * --------------------------------------------------------------------------
 * Fase 1: cria o container vazio e instancia cada Case com um contexto
 *         de bootstrap que aponta para o container compartilhado.
 * Fase 2: quando o loop termina, o container está completo.
 *         Qualquer chamada futura a _composition via ctx.cases
 *         encontra todos os Cases disponíveis.
 *
 * Não há recursão: o contexto de bootstrap é criado inline,
 * e o container é preenchido incrementalmente no mesmo loop.
 * ------------------------------------------------------------------------ */

type CasesMap = Record<string, Record<string, Record<string, unknown>>>;

function buildCasesMap(): CasesMap {
  const cases: CasesMap = {};

  // Contexto de bootstrap compartilhado — todos os Cases de composição
  // referenciam o mesmo objeto, que é populado incrementalmente.
  const bootCtx: ApiContext = {
    correlationId: "boot",
    logger,
    cases,
  };

  for (const [domain, domainCases] of Object.entries(registry)) {
    cases[domain] = {};
    for (const [caseName, _surfaces] of Object.entries(domainCases)) {
      const surfaces = _surfaces as AppCaseSurfaces;
      const entry: Record<string, unknown> = {};

      if (surfaces.api) {
        entry.api = new surfaces.api(bootCtx);
      }

      if (surfaces.stream) {
        const streamCtx: StreamContext = { correlationId: "boot", logger, cases };
        entry.stream = new surfaces.stream(streamCtx);
      }

      cases[domain][caseName] = entry;
    }
  }

  return cases;
}

// Instancia uma vez no boot do módulo
const casesMap = buildCasesMap();

/* --------------------------------------------------------------------------
 * Request context factories
 * --------------------------------------------------------------------------
 * Cada request recebe um contexto fresco com:
 * - correlationId único (rastreabilidade da operação)
 * - cases: o mapa pré-construído no boot (compartilhado, não recriado)
 *
 * Isso garante que:
 * - todas as chamadas dentro de uma operação compartilham o mesmo correlationId
 * - _composition resolve Cases já instanciados, sem recursão
 * ------------------------------------------------------------------------ */

function createApiContext(): ApiContext {
  return {
    correlationId: generateId(),
    logger,
    cases: casesMap,
  };
}

function createStreamContext(): StreamContext {
  return {
    correlationId: generateId(),
    logger,
    cases: casesMap,
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
    for (const [caseName, _surfaces] of Object.entries(domainCases)) {
      const surfaces = _surfaces as AppCaseSurfaces;
      // Mount API surfaces
      if (surfaces.api) {
        const ctx = createApiContext();
        const instance = new surfaces.api(ctx) as {
          router?(): unknown;
        };

        if (instance.router) {
          const route = instance.router();
          routes.push(route);
          logger.info(`Mounted API: ${domain}/${caseName}`, { route });
        }
      }

      // Mount Stream surfaces
      if (surfaces.stream) {
        const ctx = createStreamContext();
        const instance = new surfaces.stream(ctx) as {
          subscribe?(): unknown;
        };

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

export { registry, createApiContext, createStreamContext };
