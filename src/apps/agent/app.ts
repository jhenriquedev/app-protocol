/* ========================================================================== *
 * Agent App — Bootstrap
 * ----------------------------------------------------------------------------
 * Host canônico agentic do src/.
 *
 * Responsabilidades:
 * - materializar AgenticContext a partir do registry canônico
 * - publicar catálogo e prompt global derivados das surfaces agentic
 * - resolver e executar tools com enforcement de policy
 * - expor o mesmo catálogo pela fronteira MCP
 * ========================================================================== */

import { type AgenticContext } from "../../core/agentic.case";
import { type ApiContext, type ApiResponse } from "../../core/api.case";
import { type StreamContext, type StreamEvent } from "../../core/stream.case";
import { type AppLogger } from "../../core/shared/app_base_context";
import { AppCaseError } from "../../core/shared/app_structural_contracts";
import {
  AppMcpProtocolError,
  type AppMcpCallResult,
  type AppMcpHttpExchange,
  type AppMcpHttpResponse,
  type AppMcpInitializeParams,
  type AppMcpInitializeResult,
  type AppMcpReadResourceResult,
  type AppMcpRequestContext,
  type AppMcpResourceDescriptor,
  type AppMcpServer,
  type AppMcpServerInfo,
  type AppMcpTextContent,
  type AppMcpTextResourceContent,
  type AppMcpToolDescriptor,
} from "../../core/shared/app_mcp_contracts";
import {
  type AgenticCatalogEntry,
  type AppCaseSurfaces,
} from "../../core/shared/app_host_contracts";
import { type UserRegisterOutput } from "../../cases/users/user_register/user_register.domain.case";
import { createRegistry, type AgentConfig } from "./registry";

const APP_VERSION = "1.1.2";
const MCP_PROTOCOL_VERSION = "2025-11-25";
const MCP_SUPPORTED_PROTOCOL_VERSIONS = [
  MCP_PROTOCOL_VERSION,
  "2025-06-18",
] as const;

const logger: AppLogger = {
  debug: (message, meta) => console.debug("[agent]", message, meta),
  info: (message, meta) => console.info("[agent]", message, meta),
  warn: (message, meta) => console.warn("[agent]", message, meta),
  error: (message, meta) => console.error("[agent]", message, meta),
};

type ParentExecutionContext = {
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
  confirmed?: boolean;
  mcp?: Partial<AppMcpRequestContext>;
};

type CasesMap = Record<string, Record<string, Record<string, unknown>>>;

type ExecuteEnvelope = {
  input?: unknown;
  confirmed?: boolean;
};

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function toExecutionEnvelope(body: unknown): ExecuteEnvelope {
  if (typeof body !== "object" || body === null) {
    return {
      input: body,
      confirmed: false,
    };
  }

  const record = body as Record<string, unknown>;
  if ("confirmed" in record) {
    const { confirmed, input, ...rest } = record;

    return {
      input: "input" in record ? input : rest,
      confirmed: confirmed === true,
    };
  }

  if ("input" in record) {
    return {
      input: record.input,
      confirmed: false,
    };
  }

  return {
    input: body,
    confirmed: false,
  };
}

function toMcpTextContent(text: string): AppMcpTextContent {
  return {
    type: "text",
    text,
  };
}

function toMcpTextResourceContent(
  uri: string,
  text: string,
  mimeType?: string
): AppMcpTextResourceContent {
  return {
    uri,
    text,
    ...(mimeType ? { mimeType } : {}),
  };
}

function normalizeTextItems(values?: string[]): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function humanizeIdentifier(value: string): string {
  return value
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function joinSentence(label: string, values?: string[]): string | undefined {
  const normalized = normalizeTextItems(values);
  if (normalized.length === 0) {
    return undefined;
  }

  return `${label}: ${normalized.join("; ")}.`;
}

function stripDefinitionForProjection(entry: AgenticCatalogEntry) {
  const { tool, ...definitionWithoutTool } = entry.definition;

  return {
    ...definitionWithoutTool,
    tool: {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      isMutating: tool.isMutating ?? false,
      requiresConfirmation: tool.requiresConfirmation ?? false,
    },
  };
}

function buildToolSemanticSummary(entry: AgenticCatalogEntry): string {
  const { discovery, context, prompt, policy } = entry.definition;
  const parts = [
    prompt.purpose.trim(),
    joinSentence("Use when", [
      ...(prompt.whenToUse ?? []),
      ...(discovery.intents ?? []),
    ]),
    joinSentence("Do not use when", prompt.whenNotToUse),
    joinSentence("Preconditions", context.preconditions),
    joinSentence("Constraints", [
      ...(context.constraints ?? []),
      ...(prompt.constraints ?? []),
      ...(policy?.limits ?? []),
    ]),
    prompt.expectedOutcome
      ? `Expected outcome: ${prompt.expectedOutcome.trim()}.`
      : undefined,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return parts.join(" ");
}

function buildToolPromptFragment(entry: AgenticCatalogEntry): string {
  const { discovery, context, prompt, rag, policy } = entry.definition;
  const lines = [
    `Tool ${entry.publishedName}: ${prompt.purpose}`,
    joinSentence("Use when", [
      ...(prompt.whenToUse ?? []),
      ...(discovery.intents ?? []),
    ]),
    joinSentence("Do not use when", prompt.whenNotToUse),
    joinSentence("Aliases", discovery.aliases),
    joinSentence("Capabilities", discovery.capabilities),
    joinSentence("Dependencies", context.dependencies),
    joinSentence("Preconditions", context.preconditions),
    joinSentence("Constraints", [
      ...(context.constraints ?? []),
      ...(prompt.constraints ?? []),
      ...(policy?.limits ?? []),
    ]),
    joinSentence("Reasoning hints", prompt.reasoningHints),
    joinSentence("RAG topics", rag?.topics),
    joinSentence(
      "RAG resources",
      rag?.resources?.map((resource) =>
        resource.description
          ? `${resource.kind}:${resource.ref} (${resource.description})`
          : `${resource.kind}:${resource.ref}`
      )
    ),
    joinSentence("RAG hints", rag?.hints),
    `Execution mode: ${entry.executionMode}.`,
    `Requires confirmation: ${entry.requiresConfirmation ? "yes" : "no"}.`,
    prompt.expectedOutcome
      ? `Expected outcome: ${prompt.expectedOutcome}.`
      : undefined,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return lines.join("\n");
}

function buildSystemPromptResourceUri(): string {
  return "app://agent/system/prompt";
}

function buildToolSemanticResourceUri(entry: AgenticCatalogEntry): string {
  return `app://agent/tools/${entry.publishedName}/semantic`;
}

function toMcpSemanticAnnotations(entry: AgenticCatalogEntry) {
  return {
    readOnlyHint: !(entry.definition.tool.isMutating ?? false),
    destructiveHint: entry.definition.tool.isMutating ?? false,
    requiresConfirmation: entry.requiresConfirmation,
    executionMode: entry.executionMode,
    appSemantic: {
      summary: buildToolSemanticSummary(entry),
      discovery: entry.definition.discovery,
      context: entry.definition.context,
      prompt: entry.definition.prompt,
      policy: entry.definition.policy,
      rag: entry.definition.rag,
      exampleNames:
        entry.definition.examples?.map((example) => example.name) ?? [],
      resourceUri: buildToolSemanticResourceUri(entry),
    },
  };
}

function toMcpToolDescriptor(entry: AgenticCatalogEntry): AppMcpToolDescriptor {
  const summary = buildToolSemanticSummary(entry);

  return {
    name: entry.publishedName,
    title: entry.definition.mcp?.title ?? humanizeIdentifier(entry.publishedName),
    description:
      entry.definition.mcp?.description
        ? `${entry.definition.mcp.description} ${summary}`
        : summary,
    inputSchema: entry.definition.tool.inputSchema,
    outputSchema: entry.definition.tool.outputSchema,
    annotations: toMcpSemanticAnnotations(entry),
  };
}

function toMcpSemanticResourceDescriptor(
  entry: AgenticCatalogEntry
): AppMcpResourceDescriptor {
  return {
    uri: buildToolSemanticResourceUri(entry),
    name: `${entry.publishedName}_semantic`,
    title: `${humanizeIdentifier(entry.publishedName)} Semantic Contract`,
    description:
      `Complete APP agentic definition projected automatically from the registry for ${entry.publishedName}.`,
    mimeType: "application/json",
    annotations: {
      toolName: entry.publishedName,
      executionMode: entry.executionMode,
      requiresConfirmation: entry.requiresConfirmation,
    },
  };
}

function toMcpSystemPromptDescriptor(): AppMcpResourceDescriptor {
  return {
    uri: buildSystemPromptResourceUri(),
    name: "agent_system_prompt",
    title: "Agent System Prompt",
    description:
      "Host-level system prompt composed automatically from the registered tool fragments.",
    mimeType: "text/markdown",
    annotations: {
      kind: "system-prompt",
    },
  };
}

function toMcpSuccessResult(
  toolName: string,
  data: unknown
): AppMcpCallResult {
  return {
    content: [toMcpTextContent(`Tool ${toolName} executed successfully.`)],
    structuredContent: data,
    isError: false,
  };
}

function toMcpErrorResult(error: AppCaseError): AppMcpCallResult {
  return {
    content: [toMcpTextContent(error.message)],
    structuredContent: {
      success: false,
      error: error.toAppError(),
    },
    isError: true,
  };
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
        source: "agent",
        domain,
        caseName,
      },
    };
  }

  return undefined;
}

export function bootstrap(config: AgentConfig = {}) {
  const registry = createRegistry(config);
  let runtimeValidationPromise:
    | Promise<{
        tools: number;
        mcpEnabled: number;
        requireConfirmation: number;
      }>
    | undefined;

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
      packages: registry._packages,
      extra: {
        ...(parent?.extra ?? {}),
        providers: registry._providers,
      },
    };

    ctx.cases = createCasesMap({
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      config: ctx.config,
      auth: ctx.auth,
      db: ctx.db,
      storage: ctx.storage,
      extra: parent?.extra,
      confirmed: parent?.confirmed,
      mcp: parent?.mcp,
    });
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
      packages: registry._packages,
      extra: {
        ...(parent?.extra ?? {}),
        providers: registry._providers,
      },
    };

    ctx.cases = createCasesMap({
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      config: ctx.config,
      auth: parent?.auth,
      db: ctx.db,
      storage: parent?.storage,
      eventBus: ctx.eventBus,
      queue: ctx.queue,
      extra: parent?.extra,
      confirmed: parent?.confirmed,
      mcp: parent?.mcp,
    });
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
        serverName: "app-protocol-agent",
        version: APP_VERSION,
        protocolVersion: MCP_PROTOCOL_VERSION,
        transport: parent?.mcp?.transport ?? "http",
        sessionId: parent?.mcp?.sessionId,
        clientInfo: parent?.mcp?.clientInfo,
      },
      extra: {
        ...(parent?.extra ?? {}),
        providers: registry._providers,
      },
    };

    ctx.cases = createCasesMap({
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      config: ctx.config,
      auth: parent?.auth,
      db: parent?.db,
      storage: parent?.storage,
      eventBus: parent?.eventBus,
      queue: parent?.queue,
      extra: parent?.extra,
      confirmed: parent?.confirmed,
      mcp: parent?.mcp,
    });
    return ctx;
  }

  async function dispatchPostSuccessEvents(
    domain: string,
    caseName: string,
    result: ApiResponse<unknown>,
    ctx: ApiContext
  ): Promise<void> {
    const event = buildPostSuccessEvent(domain, caseName, result);
    if (!event) {
      return;
    }

    const registeredCases = registry._cases as Record<
      string,
      Record<string, AppCaseSurfaces>
    >;
    const streamClass = registeredCases[domain]?.[caseName]?.stream;
    if (!streamClass) {
      return;
    }

    const streamCtx = createStreamContext({
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      config: ctx.config,
      auth: ctx.auth,
      db: ctx.db,
      storage: ctx.storage,
      extra: ctx.extra,
    });

    const instance = new streamClass(streamCtx) as {
      handler(payload: StreamEvent): Promise<void>;
    };

    await instance.handler(event);
  }

  function buildAgentCatalog(parent?: Partial<ParentExecutionContext>) {
    return registry.buildCatalog(createAgenticContext(parent));
  }

  function buildSystemPrompt(parent?: Partial<ParentExecutionContext>): string {
    const catalog = buildAgentCatalog(parent).sort((left, right) =>
      left.publishedName.localeCompare(right.publishedName)
    );
    const confirmationTools = catalog
      .filter((entry) => entry.requiresConfirmation)
      .map((entry) => entry.publishedName);
    const suggestOnlyTools = catalog
      .filter((entry) => entry.executionMode === "suggest-only")
      .map((entry) => entry.publishedName);

    const sections = [
      "You are operating app-protocol-agent through the APP agent host.",
      "Use the registry-derived tool contracts exactly as published. Canonical execution always delegates through ctx.cases and the registered API surfaces.",
      confirmationTools.length > 0
        ? `Tools requiring confirmation: ${confirmationTools.join(", ")}.`
        : "No tools currently require confirmation.",
      suggestOnlyTools.length > 0
        ? `Suggest-only tools: ${suggestOnlyTools.join(", ")}.`
        : undefined,
      "Tool prompt fragments:",
      ...catalog.map((entry) => buildToolPromptFragment(entry)),
    ].filter((value): value is string => Boolean(value && value.trim()));

    return sections.join("\n\n");
  }

  function mcpServerInfo(): AppMcpServerInfo {
    return {
      name: "app-protocol-agent",
      version: APP_VERSION,
      protocolVersion: MCP_PROTOCOL_VERSION,
      instructions: buildSystemPrompt(),
    };
  }

  function resolveTool(
    toolName: string,
    parent?: Partial<ParentExecutionContext>
  ) {
    return registry.resolveTool(toolName, createAgenticContext(parent));
  }

  async function ensureAgenticRuntimeValidated() {
    if (!runtimeValidationPromise) {
      runtimeValidationPromise = validateAgenticRuntime().catch((error) => {
        runtimeValidationPromise = undefined;
        throw error;
      });
    }

    return runtimeValidationPromise;
  }

  async function executeTool(
    toolName: string,
    input: unknown,
    parent?: Partial<ParentExecutionContext>
  ): Promise<unknown> {
    await ensureAgenticRuntimeValidated();

    const entry = resolveTool(toolName, parent);

    if (!entry) {
      throw new AppCaseError(
        "NOT_FOUND",
        `Tool ${toolName} is not registered in apps/agent`
      );
    }

    if (entry.executionMode === "suggest-only") {
      throw new AppCaseError(
        "EXECUTION_MODE_RESTRICTED",
        `Tool ${entry.publishedName} cannot execute directly in suggest-only mode`
      );
    }

    if (entry.requiresConfirmation && parent?.confirmed !== true) {
      throw new AppCaseError(
        "CONFIRMATION_REQUIRED",
        `Tool ${entry.publishedName} requires explicit confirmation before execution`,
        {
          toolName: entry.publishedName,
          executionMode: entry.executionMode,
        }
      );
    }

    const ctx = createAgenticContext(parent);
    const runtimeEntry = registry.resolveTool(toolName, ctx);

    if (!runtimeEntry) {
      throw new AppCaseError(
        "NOT_FOUND",
        `Tool ${toolName} could not be resolved at execution time`
      );
    }

    return runtimeEntry.definition.tool.execute(input, ctx);
  }

  function resolveMcpTool(
    toolName: string,
    parent?: Partial<ParentExecutionContext>
  ) {
    const ctx = createAgenticContext(parent);
    const entry = registry.resolveTool(toolName, ctx);
    if (!entry || !entry.isMcpEnabled) {
      return undefined;
    }

    return entry;
  }

  async function initializeMcp(
    params?: AppMcpInitializeParams,
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpInitializeResult> {
    await ensureAgenticRuntimeValidated();

    if (
      params?.protocolVersion &&
      !MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(
        params.protocolVersion as (typeof MCP_SUPPORTED_PROTOCOL_VERSIONS)[number]
      )
    ) {
      throw new AppMcpProtocolError(
        -32602,
        `Unsupported MCP protocol version ${params.protocolVersion}.`,
        {
          supported: [...MCP_SUPPORTED_PROTOCOL_VERSIONS],
        }
      );
    }

    const info = mcpServerInfo();

    return {
      protocolVersion: info.protocolVersion,
      capabilities: {
        tools: {
          listChanged: false,
        },
        resources: {
          listChanged: false,
        },
      },
      serverInfo: {
        name: info.name,
        version: info.version,
      },
      instructions: info.instructions,
    };
  }

  async function listMcpToolsRaw(
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpToolDescriptor[]> {
    const ctx = createAgenticContext({
      mcp: parent,
    });

    return registry.listMcpEnabledTools(ctx).map(toMcpToolDescriptor);
  }

  async function listMcpTools(
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpToolDescriptor[]> {
    await ensureAgenticRuntimeValidated();
    return listMcpToolsRaw(parent);
  }

  async function listMcpResourcesRaw(
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpResourceDescriptor[]> {
    const ctx = createAgenticContext({
      mcp: parent,
    });
    const resources = registry
      .listMcpEnabledTools(ctx)
      .map(toMcpSemanticResourceDescriptor);

    return [toMcpSystemPromptDescriptor(), ...resources];
  }

  async function listMcpResources(
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpResourceDescriptor[]> {
    await ensureAgenticRuntimeValidated();
    return listMcpResourcesRaw(parent);
  }

  async function readMcpResource(
    uri: string,
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpReadResourceResult> {
    await ensureAgenticRuntimeValidated();

    if (uri === buildSystemPromptResourceUri()) {
      return {
        contents: [
          toMcpTextResourceContent(
            uri,
            buildSystemPrompt({
              mcp: parent,
            }),
            "text/markdown"
          ),
        ],
      };
    }

    const ctx = createAgenticContext({
      mcp: parent,
    });
    const entry = registry
      .listMcpEnabledTools(ctx)
      .find((candidate) => buildToolSemanticResourceUri(candidate) === uri);

    if (!entry) {
      throw new AppMcpProtocolError(
        -32004,
        `MCP resource ${uri} is not published by apps/agent.`
      );
    }

    const payload = {
      app: "app-protocol-agent",
      ref: entry.ref,
      publishedName: entry.publishedName,
      isMcpEnabled: entry.isMcpEnabled,
      requiresConfirmation: entry.requiresConfirmation,
      executionMode: entry.executionMode,
      semanticSummary: buildToolSemanticSummary(entry),
      promptFragment: buildToolPromptFragment(entry),
      definition: stripDefinitionForProjection(entry),
    };

    return {
      contents: [
        toMcpTextResourceContent(
          uri,
          JSON.stringify(payload, null, 2),
          "application/json"
        ),
      ],
    };
  }

  async function callMcpTool(
    name: string,
    args: unknown,
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpCallResult> {
    await ensureAgenticRuntimeValidated();

    const envelope = toExecutionEnvelope(args);

    try {
      const resolved = resolveMcpTool(name, {
        confirmed: envelope.confirmed,
        mcp: parent,
      });

      if (!resolved) {
        return toMcpErrorResult(
          new AppCaseError(
            "NOT_FOUND",
            `MCP tool ${name} is not published by apps/agent`
          )
        );
      }

      const data = await executeTool(name, envelope.input, {
        confirmed: envelope.confirmed,
        mcp: parent,
      });

      return toMcpSuccessResult(resolved.publishedName, data);
    } catch (error: unknown) {
      if (error instanceof AppCaseError) {
        return toMcpErrorResult(error);
      }

      throw error;
    }
  }

  async function validateAgenticRuntime(): Promise<{
    tools: number;
    mcpEnabled: number;
    requireConfirmation: number;
  }> {
    const ctx = createAgenticContext({
      correlationId: "agent-runtime-validation",
    });
    const catalog = registry.buildCatalog(ctx);

    if (catalog.length === 0) {
      throw new Error("apps/agent must register at least one agentic tool");
    }

    if (!registry._providers?.mcpAdapters?.stdio) {
      throw new Error(
        "apps/agent must register a concrete stdio MCP adapter in _providers.mcpAdapters"
      );
    }

    if (!registry._providers?.mcpAdapters?.http) {
      throw new Error(
        "apps/agent must register a concrete remote HTTP MCP adapter in _providers.mcpAdapters"
      );
    }

    const publishedNames = new Set<string>();
    for (const entry of catalog) {
      if (publishedNames.has(entry.publishedName)) {
        throw new Error(
          `apps/agent published duplicate tool name ${entry.publishedName}`
        );
      }

      publishedNames.add(entry.publishedName);

      const resolved = registry.resolveTool(entry.publishedName, ctx);
      if (!resolved) {
        throw new Error(
          `apps/agent failed to resolve published tool ${entry.publishedName}`
        );
      }

      const descriptor = toMcpToolDescriptor(entry);
      if (!descriptor.description?.trim()) {
        throw new Error(
          `apps/agent failed to project semantic summary for ${entry.publishedName}`
        );
      }

      const promptFragment = buildToolPromptFragment(entry);
      if (!promptFragment.includes(entry.definition.prompt.purpose)) {
        throw new Error(
          `apps/agent failed to project prompt fragment for ${entry.publishedName}`
        );
      }
    }

    for (const ref of registry.listAgenticCases()) {
      const instance = registry.instantiateAgentic(ref, ctx);
      await instance.test();
    }

    const globalPrompt = buildSystemPrompt({
      correlationId: "agent-runtime-validation",
    });
    if (!globalPrompt.trim()) {
      throw new Error("apps/agent must project a non-empty global system prompt");
    }

    const resources = await listMcpResourcesRaw({
      transport: "validation",
    });
    if (resources.length < catalog.filter((entry) => entry.isMcpEnabled).length + 1) {
      throw new Error(
        "apps/agent must publish a system prompt resource and one semantic resource per MCP-enabled tool"
      );
    }

    return {
      tools: catalog.length,
      mcpEnabled: catalog.filter((entry) => entry.isMcpEnabled).length,
      requireConfirmation: catalog.filter(
        (entry) => entry.requiresConfirmation
      ).length,
    };
  }

  function createMcpServer(): AppMcpServer {
    return {
      serverInfo: mcpServerInfo,
      initialize: initializeMcp,
      listTools: listMcpTools,
      listResources: listMcpResources,
      readResource: readMcpResource,
      callTool: callMcpTool,
    };
  }

  async function publishMcp(): Promise<void> {
    await ensureAgenticRuntimeValidated();
    await registry._providers.mcpAdapters.stdio.serve(createMcpServer());
  }

  async function handleMcpHttp(
    exchange: AppMcpHttpExchange
  ): Promise<AppMcpHttpResponse | undefined> {
    await ensureAgenticRuntimeValidated();
    return registry._providers.mcpAdapters.http.handle(
      exchange,
      createMcpServer()
    );
  }

  async function startMcpTransport(): Promise<void> {
    await publishMcp();
  }

  return {
    registry,
    createApiContext,
    createAgenticContext,
    buildAgentCatalog,
    buildSystemPrompt,
    resolveTool,
    executeTool,
    mcpServerInfo,
    initializeMcp,
    listMcpTools,
    listMcpResources,
    readMcpResource,
    callMcpTool,
    publishMcp,
    handleMcpHttp,
    startMcpTransport,
    validateAgenticRuntime,
  };
}

const agentApp = bootstrap();

export const registry = agentApp.registry;
export const createApiContext = agentApp.createApiContext;
export const createAgenticContext = agentApp.createAgenticContext;
export const buildAgentCatalog = agentApp.buildAgentCatalog;
export const buildSystemPrompt = agentApp.buildSystemPrompt;
export const resolveTool = agentApp.resolveTool;
export const executeTool = agentApp.executeTool;
export const initializeMcp = agentApp.initializeMcp;
export const listMcpTools = agentApp.listMcpTools;
export const listMcpResources = agentApp.listMcpResources;
export const readMcpResource = agentApp.readMcpResource;
export const callMcpTool = agentApp.callMcpTool;
export const publishMcp = agentApp.publishMcp;
export const handleMcpHttp = agentApp.handleMcpHttp;
export const startMcpTransport = agentApp.startMcpTransport;
export const validateAgenticRuntime = agentApp.validateAgenticRuntime;
