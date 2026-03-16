/* ========================================================================== *
 * Chatbot App — Bootstrap
 * --------------------------------------------------------------------------
 * Agentic host: collects full definitions from all agentic surfaces.
 *
 * Uses definition() as the canonical contract — this includes all facets:
 * discovery, context, prompt, tool, mcp, rag, policy, examples.
 * ========================================================================== */

import {
  AgenticContext,
  AgenticDefinition,
} from "../../core/agentic.case";
import { AppLogger } from "../../core/shared/app_base_context";
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
 * Context factory
 * ------------------------------------------------------------------------ */

function createAgenticContext(cases?: unknown): AgenticContext {
  return {
    correlationId: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    logger,
    cases: cases as Record<string, unknown> | undefined,
  };
}

/* --------------------------------------------------------------------------
 * Bootstrap — collects full definitions from all agentic surfaces
 * --------------------------------------------------------------------------
 * Uses definition() as the single canonical entrypoint.
 * This ensures all facets (discovery, context, prompt, tool, mcp, rag,
 * policy, examples) are collected and available to the agent runtime.
 * ------------------------------------------------------------------------ */

interface RegisteredCase {
  domain: string;
  caseName: string;
  definition: AgenticDefinition;
  isMcpEnabled: boolean;
  requiresConfirmation: boolean;
}

async function startChatbot(cases?: unknown): Promise<{
  registeredCases: RegisteredCase[];
}> {
  const registeredCases: RegisteredCase[] = [];

  for (const [domain, domainCases] of Object.entries(registry)) {
    for (const [caseName, surfaces] of Object.entries(domainCases)) {
      if (surfaces.agentic) {
        const ctx = createAgenticContext(cases);
        const instance = new surfaces.agentic(ctx);

        const definition = (instance as {
          definition(): AgenticDefinition;
          isMcpEnabled(): boolean;
          requiresConfirmation(): boolean;
        });

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
          mcp: def.mcp?.enabled ? def.mcp.name : "disabled",
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

export { registry, createAgenticContext, startChatbot };
