/* ========================================================================== *
 * Chatbot App — Bootstrap
 * --------------------------------------------------------------------------
 * Example host for an agentic application (chatbot, AI assistant, MCP server).
 *
 * This file demonstrates how an agentic host:
 * 1. Imports its registry (only Agentic surfaces)
 * 2. Builds request-scoped cases maps for canonical API execution
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
import { ApiContext, ApiResponse } from "../../core/api.case";
import { StreamContext, StreamEvent } from "../../core/stream.case";
import { AppLogger } from "../../core/shared/app_base_context";
import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";
import { AppError, AppResult } from "../../core/shared/app_structural_contracts";
import { UserRegisterOutput } from "../../cases/users/user_register/user_register.domain.case";
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
 * Runtime case map for canonical execution
 * --------------------------------------------------------------------------
 * Agentic tools resolve to API handler() via ctx.cases.
 * The chatbot host exposes wrappers request-scoped que instanciam
 * a surface canônica com o contexto da execução atual.
 * ------------------------------------------------------------------------ */

type CasesMap = Record<string, Record<string, Record<string, unknown>>>;

interface ParentExecutionContext {
  correlationId: string;
  tenantId?: string;
  userId?: string;
  config?: ApiContext["config"];
  auth?: ApiContext["auth"];
  db?: ApiContext["db"];
  storage?: ApiContext["storage"];
  eventBus?: StreamContext["eventBus"];
  queue?: StreamContext["queue"];
  extra?: AgenticContext["extra"];
  mcp?: AgenticContext["mcp"];
}

function createCasesMap(parent: ParentExecutionContext): CasesMap {
  const cases: CasesMap = {};

  for (const [domain, domainCases] of Object.entries(registry._cases)) {
    cases[domain] = {};

    for (const [caseName, surfaces] of Object.entries(domainCases)) {
      const typedSurfaces = surfaces as AppCaseSurfaces;
      const entry: Record<string, unknown> = {};

      if (typedSurfaces.api) {
        const ApiClass = typedSurfaces.api;
        entry.api = {
          handler: async (input: unknown) => {
            const ctx = createApiContext(parent);
            const instance = new ApiClass(ctx) as {
              handler(payload: unknown): Promise<ApiResponse<unknown>>;
            };
            const result = await instance.handler(input);
            await dispatchPostSuccessEvents(domain, caseName, result, ctx);
            return result;
          },
        };
      }

      if (typedSurfaces.stream) {
        const StreamClass = typedSurfaces.stream;
        entry.stream = {
          handler: async (event: unknown) => {
            const ctx = createStreamContext(parent);
            const instance = new StreamClass(ctx) as {
              handler(payload: unknown): Promise<void>;
            };
            return instance.handler(event);
          },
        };
      }

      cases[domain][caseName] = entry;
    }
  }

  return cases;
}

/* --------------------------------------------------------------------------
 * Context factories
 * ------------------------------------------------------------------------ */

function createApiContext(parent?: Partial<ParentExecutionContext>): ApiContext {
  const ctx: ApiContext = {
    correlationId: parent?.correlationId ?? generateId(),
    executionId: generateId(),
    tenantId: parent?.tenantId,
    userId: parent?.userId,
    config: parent?.config,
    logger,
    auth: parent?.auth,
    db: parent?.db,
    storage: parent?.storage,
    extra: parent?.extra,
    cases: {},
  };

  ctx.cases = createCasesMap(ctx);
  return ctx;
}

function createStreamContext(
  parent?: Partial<ParentExecutionContext>
): StreamContext {
  const ctx: StreamContext = {
    correlationId: parent?.correlationId ?? generateId(),
    executionId: generateId(),
    tenantId: parent?.tenantId,
    userId: parent?.userId,
    config: parent?.config,
    logger,
    eventBus: parent?.eventBus,
    queue: parent?.queue,
    db: parent?.db,
    extra: parent?.extra,
    cases: {},
  };

  ctx.cases = createCasesMap(ctx);
  return ctx;
}

function createAgenticContext(
  parent?: Partial<ParentExecutionContext>
): AgenticContext {
  const ctx: AgenticContext = {
    correlationId: generateId(),
    executionId: generateId(),
    tenantId: parent?.tenantId,
    userId: parent?.userId,
    config: parent?.config,
    logger,
    extra: parent?.extra,
    mcp: parent?.mcp ?? {
      // MCP server info — host-specific, not protocol-mandated.
      // In practice: server name, version, transport config.
      serverName: "chatbot",
      version: "0.0.7",
    },
  };

  if (parent?.correlationId) {
    ctx.correlationId = parent.correlationId;
  }

  ctx.cases = createCasesMap(ctx);
  return ctx;
}

function buildPostSuccessEvent(
  domain: string,
  caseName: string,
  result: ApiResponse<unknown>
): StreamEvent | undefined {
  if (!result.success || !result.data) {
    return undefined;
  }

  if (domain === "users" && caseName === "user_register") {
    const user = result.data as UserRegisterOutput;

    return {
      type: "user_registered",
      payload: user,
      idempotencyKey: `users.user_register:${user.id}`,
      metadata: {
        source: "agentic",
        domain,
        caseName,
      },
    };
  }

  return undefined;
}

async function dispatchPostSuccessEvents(
  domain: string,
  caseName: string,
  result: ApiResponse<unknown>,
  ctx: ApiContext
): Promise<void> {
  const event = buildPostSuccessEvent(domain, caseName, result);
  if (!event) return;

  const registeredCases = registry._cases as Record<
    string,
    Record<string, AppCaseSurfaces>
  >;
  const streamClass = registeredCases[domain]?.[caseName]?.stream;
  if (!streamClass) {
    throw new Error(`No stream surface registered for ${domain}/${caseName}`);
  }

  logger.info("Dispatching post-success stream event", {
    domain,
    caseName,
    eventType: event.type,
    correlationId: ctx.correlationId,
  });

  const streamCtx = createStreamContext({
    correlationId: ctx.correlationId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    config: ctx.config,
    db: ctx.db,
    extra: ctx.extra,
  });

  const instance = new streamClass(streamCtx) as {
    handler(payload: StreamEvent): Promise<void>;
  };

  await instance.handler(event);
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

      const AgenticClass = surfaces.agentic;
      if (AgenticClass) {
        const discoveryCtx = createAgenticContext();
        const instance = new AgenticClass(discoveryCtx) as BaseAgenticCase;

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
              const runtimeCtx = createAgenticContext();
              const runtimeInstance = new AgenticClass(runtimeCtx) as BaseAgenticCase;
              const result = await runtimeInstance.execute(input);
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
