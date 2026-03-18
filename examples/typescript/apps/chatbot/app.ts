/* ========================================================================== *
 * Chatbot App — Bootstrap
 * --------------------------------------------------------------------------
 * Agentic host: registra definitions agentic e resolve execução canônica via
 * ctx.cases apontando para surfaces de API do próprio registry.
 * ========================================================================== */

import {
  AgenticContext,
  AgenticDefinition,
} from "../../core/agentic.case";
import { ApiContext } from "../../core/api.case";
import { AppLogger } from "../../core/shared/app_base_context";
import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";
import { createRegistry } from "./registry";

const logger: AppLogger = {
  debug: (msg, meta) => console.log("[DEBUG]", msg, meta),
  info: (msg, meta) => console.log("[INFO]", msg, meta),
  warn: (msg, meta) => console.warn("[WARN]", msg, meta),
  error: (msg, meta) => console.error("[ERROR]", msg, meta),
};

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

type CasesMap = Record<string, Record<string, Record<string, unknown>>>;

interface ParentExecutionContext {
  correlationId: string;
  tenantId?: string;
  userId?: string;
  config?: Record<string, unknown>;
}

interface RegisteredCase {
  domain: string;
  caseName: string;
  definition: AgenticDefinition;
  isMcpEnabled: boolean;
  requiresConfirmation: boolean;
}

export function bootstrap() {
  const registry = createRegistry();
  const db = registry._providers.db;

  function createCasesMap(parent: ParentExecutionContext): CasesMap {
    const cases: CasesMap = {};

    for (const [domain, domainCases] of Object.entries(registry._cases)) {
      cases[domain] = {};

      for (const [caseName, surfaces] of Object.entries(domainCases)) {
        const entry: Record<string, unknown> = {};
        const typedSurfaces = surfaces as AppCaseSurfaces;

        if (typedSurfaces.api) {
          const ApiClass = typedSurfaces.api;
          entry.api = {
            handler: async (input: unknown) => {
              const ctx = createApiContext(parent);
              const instance = new ApiClass(ctx) as {
                handler(payload: unknown): Promise<unknown>;
              };
              return instance.handler(input);
            },
          };
        }

        cases[domain][caseName] = entry;
      }
    }

    return cases;
  }

  function createApiContext(parent?: Partial<ParentExecutionContext>): ApiContext {
    const ctx: ApiContext = {
      correlationId: parent?.correlationId ?? generateId(),
      executionId: generateId(),
      tenantId: parent?.tenantId,
      userId: parent?.userId,
      config: parent?.config,
      logger,
      db,
      packages: registry._packages,
    };

    ctx.cases = createCasesMap(ctx);
    return ctx;
  }

  function createAgenticContext(
    parent?: Partial<ParentExecutionContext>
  ): AgenticContext {
    const ctx: AgenticContext = {
      correlationId: parent?.correlationId ?? generateId(),
      executionId: generateId(),
      tenantId: parent?.tenantId,
      userId: parent?.userId,
      config: parent?.config,
      logger,
      packages: registry._packages,
      mcp: {
        serverName: "task-manager-chatbot",
        version: "1.0.1",
      },
    };

    ctx.cases = createCasesMap(ctx);
    return ctx;
  }

  async function startChatbot(): Promise<{ registeredCases: RegisteredCase[] }> {
    const registeredCases: RegisteredCase[] = [];

    for (const [domain, domainCases] of Object.entries(registry._cases)) {
      for (const [caseName, surfaces] of Object.entries(domainCases)) {
        if (surfaces.agentic) {
          const ctx = createAgenticContext();
          const instance = new surfaces.agentic(ctx);

          const definition = instance as {
            definition(): AgenticDefinition;
            isMcpEnabled(): boolean;
            requiresConfirmation(): boolean;
          };

          const def = definition.definition();

          registeredCases.push({
            domain,
            caseName,
            definition: def,
            isMcpEnabled: definition.isMcpEnabled(),
            requiresConfirmation: definition.requiresConfirmation(),
          });

          logger.info(`Registered agentic: ${domain}/${caseName}`, {
            tool: def.tool.name,
            mcp: def.mcp?.enabled ? def.mcp.name ?? def.tool.name : "disabled",
            rag: def.rag?.mode ?? "none",
            policy: def.policy?.riskLevel ?? "unset",
            examples: def.examples?.length ?? 0,
          });
        }
      }
    }

    logger.info("Chatbot started", {
      tools: registeredCases.length,
      mcpEnabled: registeredCases.filter((c) => c.isMcpEnabled).length,
      mutating: registeredCases.filter((c) => c.definition.tool.isMutating).length,
      requireConfirmation: registeredCases.filter((c) => c.requiresConfirmation).length,
    });

    return { registeredCases };
  }

  return { registry, db, createApiContext, createAgenticContext, startChatbot };
}

const app = bootstrap();

export const registry = app.registry;
export const db = app.db;
export const createApiContext = app.createApiContext;
export const createAgenticContext = app.createAgenticContext;
export const startChatbot = app.startChatbot;
