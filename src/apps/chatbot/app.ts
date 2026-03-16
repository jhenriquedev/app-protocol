/* ========================================================================== *
 * Chatbot App — Bootstrap
 * --------------------------------------------------------------------------
 * Example host for an agentic application (chatbot, AI assistant, MCP server).
 *
 * This file demonstrates how an agentic host:
 * 1. Imports its registry (only Agentic surfaces)
 * 2. Builds a shared cases map at boot (API surfaces for canonical execution)
 * 3. Creates an AgenticContext per request with cases + MCP info
 * 4. Exposes tools for agent consumption (MCP, direct invocation, etc.)
 *
 * Key architectural points:
 * - Agentic surfaces do NOT execute logic themselves — they delegate to
 *   canonical API surfaces via ctx.cases.
 * - The chatbot host must also load API surfaces into ctx.cases so that
 *   tool.execute() can resolve canonical code paths.
 * - The agentic registry and the backend registry coexist independently.
 *   Each host loads what it needs.
 *
 * Error handling:
 * - Uses AppError for structured errors in tool responses.
 * - Catches thrown errors and wraps them in AppResult<T> format.
 * ========================================================================== */

import { AgenticContext, BaseAgenticCase } from "../../core/agentic.case";
import { ApiContext } from "../../core/api.case";
import { AppLogger } from "../../core/shared/app_base_context";
import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";
import { AppError, AppResult } from "../../core/shared/app_structural_contracts";
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
 * Boot — build cases map with API surfaces for canonical execution
 * --------------------------------------------------------------------------
 * Agentic tools resolve to API handler() via ctx.cases.
 * The chatbot host must instantiate the API surfaces and expose them
 * in the cases map so that tool.execute() works.
 *
 * This is the same two-phase pattern as backend/app.ts:
 * Phase 1: create empty container
 * Phase 2: populate with API instances that share the same container
 * ------------------------------------------------------------------------ */

type CasesMap = Record<string, Record<string, Record<string, unknown>>>;

function buildCasesMap(): CasesMap {
  const cases: CasesMap = {};

  for (const [domain, domainCases] of Object.entries(registry._cases)) {
    cases[domain] = {};

    for (const [caseName, surfaces] of Object.entries(domainCases)) {
      const typedSurfaces = surfaces as AppCaseSurfaces;
      const entry: Record<string, unknown> = {};

      if (typedSurfaces.api) {
        const bootCtx: ApiContext = {
          correlationId: "boot",
          logger,
          cases,
        };
        entry.api = new typedSurfaces.api(bootCtx);
      }

      cases[domain][caseName] = entry;
    }
  }

  return cases;
}

const casesMap = buildCasesMap();

/* --------------------------------------------------------------------------
 * Context factories
 * ------------------------------------------------------------------------ */

function createAgenticContext(): AgenticContext {
  return {
    correlationId: generateId(),
    logger,
    cases: casesMap,
    mcp: {
      // MCP server info — host-specific, not protocol-mandated.
      // In practice: server name, version, transport config.
      serverName: "chatbot",
      version: "0.0.4",
    },
  };
}

/* --------------------------------------------------------------------------
 * Tool discovery
 * --------------------------------------------------------------------------
 * Iterates the agentic registry, instantiates each surface, and collects
 * tool definitions for agent consumption.
 *
 * Returns a map of tool name → { definition, execute } ready for:
 * - MCP server tool registration
 * - Direct agent invocation
 * - CLI tool listing
 * ------------------------------------------------------------------------ */

interface DiscoveredTool {
  name: string;
  description: string;
  inputSchema: unknown;
  outputSchema: unknown;
  isMutating: boolean;
  requiresConfirmation: boolean;
  execute(input: unknown): Promise<AppResult<unknown>>;
}

function discoverTools(): Map<string, DiscoveredTool> {
  const tools = new Map<string, DiscoveredTool>();

  for (const [domain, domainCases] of Object.entries(registry._cases)) {
    for (const [caseName, _surfaces] of Object.entries(domainCases)) {
      const surfaces = _surfaces as AppCaseSurfaces;

      if (surfaces.agentic) {
        const ctx = createAgenticContext();
        const instance = new surfaces.agentic(ctx) as BaseAgenticCase;

        const tool = instance.tool();
        const discovery = instance.discovery();

        tools.set(tool.name, {
          name: tool.name,
          description: discovery.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          isMutating: tool.isMutating ?? false,
          requiresConfirmation: tool.requiresConfirmation ?? false,
          execute: async (input: unknown): Promise<AppResult<unknown>> => {
            try {
              const result = await tool.execute(input, ctx);
              return { success: true, data: result };
            } catch (err) {
              const error: AppError = {
                code: "TOOL_EXECUTION_FAILED",
                message: err instanceof Error ? err.message : String(err),
                details: { tool: tool.name, domain, caseName },
              };
              return { success: false, error };
            }
          },
        });

        logger.info(`Discovered tool: ${domain}/${caseName}`, {
          toolName: tool.name,
          isMutating: tool.isMutating,
        });

        // MCP registration if enabled
        const mcp = instance.mcp?.();
        if (mcp?.enabled) {
          logger.info(`MCP-enabled: ${tool.name}`, {
            title: mcp.title,
            mcpName: mcp.name ?? tool.name,
          });
        }
      }
    }
  }

  return tools;
}

/* --------------------------------------------------------------------------
 * Chatbot bootstrap
 * --------------------------------------------------------------------------
 * Discovers all agentic tools and starts the agent runtime.
 *
 * In a real project this would:
 * - Start an MCP server (stdio or SSE transport)
 * - Register tools with the MCP protocol
 * - Wire up a conversation loop or API endpoint
 * ------------------------------------------------------------------------ */

async function startChatbot(): Promise<void> {
  const tools = discoverTools();

  logger.info("Chatbot started", {
    tools: tools.size,
    toolNames: [...tools.keys()],
  });

  // Example: simulate agent invoking a tool
  const registerTool = tools.get("user_register");
  if (registerTool) {
    logger.info("Simulating agent tool invocation: user_register");

    const result = await registerTool.execute({
      email: "agent-created@example.com",
      name: "Agent Created User",
      password: "SecureP@ss1",
    });

    if (result.success) {
      logger.info("Tool execution succeeded", { data: result.data });
    } else {
      logger.error("Tool execution failed", { error: result.error });
    }
  }
}

export { registry, createAgenticContext, discoverTools };
