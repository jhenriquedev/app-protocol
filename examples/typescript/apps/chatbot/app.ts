/* ========================================================================== *
 * Chatbot App — Bootstrap
 * --------------------------------------------------------------------------
 * Agentic host: collects tool definitions and discovery for AI agent use.
 * ========================================================================== */

import { AgenticContext } from "../../core/agentic.case";
import { AppLogger } from "../../core/shared/app_base_context";
import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";
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
 * Bootstrap — collects tools and discovery from all agentic surfaces
 * ------------------------------------------------------------------------ */

interface AgenticTool {
  domain: string;
  caseName: string;
  name: string;
  description: string;
  isMutating?: boolean;
}

async function startChatbot(cases?: unknown): Promise<{
  tools: AgenticTool[];
  discovery: Array<{ name: string; description: string; category?: string }>;
}> {
  const tools: AgenticTool[] = [];
  const discovery: Array<{ name: string; description: string; category?: string }> = [];

  for (const [domain, domainCases] of Object.entries(registry)) {
    for (const [caseName, _surfaces] of Object.entries(domainCases)) {
      const surfaces = _surfaces as AppCaseSurfaces;

      if (surfaces.agentic) {
        const ctx = createAgenticContext(cases);
        const instance = new surfaces.agentic(ctx) as {
          discovery(): { name: string; description: string; category?: string };
          tool(): { name: string; description: string; isMutating?: boolean };
          definition(): unknown;
        };

        const disc = instance.discovery();
        discovery.push(disc);

        const tool = instance.tool();
        tools.push({
          domain,
          caseName,
          name: tool.name,
          description: tool.description,
          isMutating: tool.isMutating,
        });

        logger.info(`Registered agentic: ${domain}/${caseName}`, {
          tool: tool.name,
        });
      }
    }
  }

  logger.info("Chatbot started", {
    tools: tools.length,
    discovery: discovery.length,
  });

  return { tools, discovery };
}

export { registry, createAgenticContext, startChatbot };
