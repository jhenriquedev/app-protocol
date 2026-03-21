import { type AgenticContext } from "../../core/agentic.case";
import { type ApiContext } from "../../core/api.case";
import { type AppLogger } from "../../core/shared/app_base_context";
import { AppCaseError } from "../../core/shared/app_structural_contracts";
import {
  type AppMcpCallResult,
  type AppMcpHttpExchange,
  type AppMcpHttpResponse,
  type AppMcpInitializeParams,
  type AppMcpInitializeResult,
  AppMcpProtocolError,
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
import { type AgentConfig, createRegistry } from "./registry";

const APP_VERSION = "1.1.1";
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

type AgentServer = Deno.HttpServer<Deno.NetAddr>;

type ParentExecutionContext = {
  correlationId: string;
  tenantId?: string;
  userId?: string;
  config?: Record<string, unknown>;
  confirmed?: boolean;
  mcp?: Partial<AppMcpRequestContext>;
};

type CasesMap = Record<string, Record<string, Record<string, unknown>>>;

type ExecuteEnvelope = {
  input?: unknown;
  confirmed?: boolean;
};

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
}

function corsHeaders(methods: string): Headers {
  return new Headers({
    "access-control-allow-origin": "*",
    "access-control-allow-methods": methods,
    "access-control-allow-headers": "content-type",
  });
}

function sendJson(statusCode: number, body: unknown): Response {
  const headers = corsHeaders("GET,POST,OPTIONS");
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(body, null, 2), {
    status: statusCode,
    headers,
  });
}

function sendStructuredError(
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return sendJson(statusCode, {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}

function sendMcpHttpResponse(response: AppMcpHttpResponse): Response {
  return new Response(response.bodyText, {
    status: response.statusCode,
    headers: response.headers,
  });
}

function getRequestPath(req: Request): string {
  return new URL(req.url).pathname;
}

function toHeaderMap(headers: Headers): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};

  for (const [name, value] of headers.entries()) {
    normalized[name.toLowerCase()] = value;
  }

  return normalized;
}

function mapErrorCodeToStatus(code?: string): number {
  switch (code) {
    case "INVALID_REQUEST":
    case "VALIDATION_FAILED":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "CONFIRMATION_REQUIRED":
      return 409;
    case "EXECUTION_MODE_RESTRICTED":
      return 409;
    default:
      return 500;
  }
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

async function readRequestBody(req: Request): Promise<unknown> {
  const content = await readRawRequestBody(req);
  if (content === undefined) {
    return undefined;
  }

  return JSON.parse(content) as unknown;
}

async function readRawRequestBody(req: Request): Promise<string | undefined> {
  const content = (await req.text()).trim();
  if (!content) {
    return undefined;
  }

  return content;
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
  mimeType?: string,
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
      ),
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

function toCatalogDocument(entry: AgenticCatalogEntry) {
  return {
    ref: entry.ref,
    publishedName: entry.publishedName,
    isMcpEnabled: entry.isMcpEnabled,
    requiresConfirmation: entry.requiresConfirmation,
    executionMode: entry.executionMode,
    semanticSummary: buildToolSemanticSummary(entry),
    promptFragment: buildToolPromptFragment(entry),
    resources: {
      semantic: buildToolSemanticResourceUri(entry),
    },
    definition: stripDefinitionForProjection(entry),
  };
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
    },
  };
}

function toMcpToolDescriptor(entry: AgenticCatalogEntry): AppMcpToolDescriptor {
  const summary = buildToolSemanticSummary(entry);

  return {
    name: entry.publishedName,
    title: entry.definition.mcp?.title ??
      humanizeIdentifier(entry.publishedName),
    description: entry.definition.mcp?.description
      ? `${entry.definition.mcp.description} ${summary}`
      : summary,
    inputSchema: entry.definition.tool.inputSchema,
    outputSchema: entry.definition.tool.outputSchema,
    annotations: toMcpSemanticAnnotations(entry),
  };
}

function toMcpSemanticResourceDescriptor(
  entry: AgenticCatalogEntry,
): AppMcpResourceDescriptor {
  return {
    uri: buildToolSemanticResourceUri(entry),
    name: `${entry.publishedName}_semantic`,
    title: `${
      entry.definition.mcp?.title ?? humanizeIdentifier(entry.publishedName)
    } Semantic Definition`,
    description: buildToolSemanticSummary(entry),
    mimeType: "application/json",
  };
}

function toMcpSystemPromptDescriptor(): AppMcpResourceDescriptor {
  return {
    uri: buildSystemPromptResourceUri(),
    name: "agent_system_prompt",
    title: "Agent Host System Prompt",
    description:
      "Global prompt assembled automatically from registered APP agentic tool fragments.",
    mimeType: "text/markdown",
  };
}

function toMcpSuccessResult(
  toolName: string,
  data: unknown,
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
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    },
    isError: true,
  };
}

export function bootstrap(config: AgentConfig = {}) {
  const registry = createRegistry(config);
  let listeningPort = registry._providers?.port ?? 3001;

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

  function createApiContext(
    parent?: Partial<ParentExecutionContext>,
  ): ApiContext {
    const ctx: ApiContext = {
      correlationId: parent?.correlationId ?? generateId(),
      executionId: generateId(),
      tenantId: parent?.tenantId,
      userId: parent?.userId,
      config: parent?.config,
      logger,
      packages: registry._packages,
      extra: {
        providers: registry._providers,
      },
    };

    ctx.cases = createCasesMap({
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      config: ctx.config,
    });
    return ctx;
  }

  function createAgenticContext(
    parent?: Partial<ParentExecutionContext>,
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
        serverName: "deno-task-board-agent",
        version: APP_VERSION,
        protocolVersion: MCP_PROTOCOL_VERSION,
        transport: parent?.mcp?.transport ?? "http",
        sessionId: parent?.mcp?.sessionId,
        clientInfo: parent?.mcp?.clientInfo,
      },
      extra: {
        providers: registry._providers,
      },
    };

    ctx.cases = createCasesMap({
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      config: ctx.config,
      mcp: parent?.mcp,
    });
    return ctx;
  }

  function buildAgentCatalog(parent?: Partial<ParentExecutionContext>) {
    return registry.buildCatalog(createAgenticContext(parent));
  }

  function resolveTool(
    toolName: string,
    parent?: Partial<ParentExecutionContext>,
  ) {
    return registry.resolveTool(toolName, createAgenticContext(parent));
  }

  async function executeTool(
    toolName: string,
    input: unknown,
    parent?: Partial<ParentExecutionContext>,
  ): Promise<unknown> {
    const entry = resolveTool(toolName, parent);

    if (!entry) {
      throw new AppCaseError(
        "NOT_FOUND",
        `Tool ${toolName} is not registered in apps/agent`,
      );
    }

    if (entry.executionMode === "suggest-only") {
      throw new AppCaseError(
        "EXECUTION_MODE_RESTRICTED",
        `Tool ${entry.publishedName} cannot execute directly in suggest-only mode`,
      );
    }

    if (entry.requiresConfirmation && parent?.confirmed !== true) {
      throw new AppCaseError(
        "CONFIRMATION_REQUIRED",
        `Tool ${entry.publishedName} requires explicit confirmation before execution`,
        {
          toolName: entry.publishedName,
          executionMode: entry.executionMode,
        },
      );
    }

    const ctx = createAgenticContext(parent);
    const runtimeEntry = registry.resolveTool(toolName, ctx);

    if (!runtimeEntry) {
      throw new AppCaseError(
        "NOT_FOUND",
        `Tool ${toolName} could not be resolved at execution time`,
      );
    }

    return runtimeEntry.definition.tool.execute(input, ctx);
  }

  function resolveMcpTool(
    toolName: string,
    parent?: Partial<ParentExecutionContext>,
  ) {
    const ctx = createAgenticContext(parent);
    const entry = registry.resolveTool(toolName, ctx);
    if (!entry || !entry.isMcpEnabled) {
      return undefined;
    }

    return entry;
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
      "You are operating deno-task-board-agent through the APP agent host.",
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
      name: "deno-task-board-agent",
      version: APP_VERSION,
      protocolVersion: MCP_PROTOCOL_VERSION,
      instructions: buildSystemPrompt(),
    };
  }

  async function initializeMcp(
    params?: AppMcpInitializeParams,
    _parent?: Partial<AppMcpRequestContext>,
  ): Promise<AppMcpInitializeResult> {
    if (
      params?.protocolVersion &&
      !MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(
        params
          .protocolVersion as (typeof MCP_SUPPORTED_PROTOCOL_VERSIONS)[number],
      )
    ) {
      throw new AppMcpProtocolError(
        -32602,
        `Unsupported MCP protocol version ${params.protocolVersion}.`,
        {
          supported: [...MCP_SUPPORTED_PROTOCOL_VERSIONS],
        },
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

  async function listMcpTools(
    parent?: Partial<AppMcpRequestContext>,
  ): Promise<AppMcpToolDescriptor[]> {
    const ctx = createAgenticContext({
      mcp: parent,
    });

    return registry.listMcpEnabledTools(ctx).map(toMcpToolDescriptor);
  }

  async function listMcpResources(
    parent?: Partial<AppMcpRequestContext>,
  ): Promise<AppMcpResourceDescriptor[]> {
    const ctx = createAgenticContext({
      mcp: parent,
    });
    const resources = registry
      .listMcpEnabledTools(ctx)
      .map(toMcpSemanticResourceDescriptor);

    return [toMcpSystemPromptDescriptor(), ...resources];
  }

  async function readMcpResource(
    uri: string,
    parent?: Partial<AppMcpRequestContext>,
  ): Promise<AppMcpReadResourceResult> {
    if (uri === buildSystemPromptResourceUri()) {
      return {
        contents: [
          toMcpTextResourceContent(
            uri,
            buildSystemPrompt({
              mcp: parent,
            }),
            "text/markdown",
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
        `MCP resource ${uri} is not published by apps/agent.`,
      );
    }

    const payload = {
      app: "deno-example-agent",
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
          "application/json",
        ),
      ],
    };
  }

  async function callMcpTool(
    name: string,
    args: unknown,
    parent?: Partial<AppMcpRequestContext>,
  ): Promise<AppMcpCallResult> {
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
            `MCP tool ${name} is not published by apps/agent`,
          ),
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
        "apps/agent must register a concrete stdio MCP adapter in _providers.mcpAdapters",
      );
    }

    if (!registry._providers?.mcpAdapters?.http) {
      throw new Error(
        "apps/agent must register a concrete remote HTTP MCP adapter in _providers.mcpAdapters",
      );
    }

    const publishedNames = new Set<string>();
    for (const entry of catalog) {
      if (publishedNames.has(entry.publishedName)) {
        throw new Error(
          `apps/agent published duplicate tool name ${entry.publishedName}`,
        );
      }

      publishedNames.add(entry.publishedName);

      const resolved = registry.resolveTool(entry.publishedName, ctx);
      if (!resolved) {
        throw new Error(
          `apps/agent failed to resolve published tool ${entry.publishedName}`,
        );
      }

      const descriptor = toMcpToolDescriptor(entry);
      if (!descriptor.description?.trim()) {
        throw new Error(
          `apps/agent failed to project semantic summary for ${entry.publishedName}`,
        );
      }

      const promptFragment = buildToolPromptFragment(entry);
      if (!promptFragment.includes(entry.definition.prompt.purpose)) {
        throw new Error(
          `apps/agent failed to project prompt fragment for ${entry.publishedName}`,
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
      throw new Error(
        "apps/agent must project a non-empty global system prompt",
      );
    }

    const resources = await listMcpResources({
      transport: "validation",
    });
    if (
      resources.length <
        catalog.filter((entry) => entry.isMcpEnabled).length + 1
    ) {
      throw new Error(
        "apps/agent must publish a system prompt resource and one semantic resource per MCP-enabled tool",
      );
    }

    return {
      tools: catalog.length,
      mcpEnabled: catalog.filter((entry) => entry.isMcpEnabled).length,
      requireConfirmation: catalog.filter(
        (entry) => entry.requiresConfirmation,
      ).length,
    };
  }

  async function publishMcp(): Promise<void> {
    await validateAgenticRuntime();

    const server: AppMcpServer = {
      serverInfo: mcpServerInfo,
      initialize: initializeMcp,
      listTools: listMcpTools,
      listResources: listMcpResources,
      readResource: readMcpResource,
      callTool: callMcpTool,
    };

    await registry._providers.mcpAdapters.stdio.serve(server);
  }

  async function handleRemoteMcp(req: Request): Promise<Response | undefined> {
    const adapter = registry._providers?.mcpAdapters?.http;
    const path = getRequestPath(req);

    if (!adapter || path !== adapter.endpointPath) {
      return undefined;
    }

    let bodyText: string | undefined;
    const method = req.method.toUpperCase();

    if (method === "POST") {
      try {
        bodyText = await readRawRequestBody(req);
      } catch (error: unknown) {
        const failure = {
          jsonrpc: "2.0" as const,
          id: null,
          error: {
            code: -32700,
            message: error instanceof Error
              ? error.message
              : "Invalid JSON request body",
          },
        };

        return sendMcpHttpResponse({
          statusCode: 400,
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json; charset=utf-8",
          },
          bodyText: JSON.stringify(failure),
        });
      }
    }

    const exchange: AppMcpHttpExchange = {
      method,
      path,
      headers: toHeaderMap(req.headers),
      bodyText,
    };

    const server: AppMcpServer = {
      serverInfo: mcpServerInfo,
      initialize: initializeMcp,
      listTools: listMcpTools,
      listResources: listMcpResources,
      readResource: readMcpResource,
      callTool: callMcpTool,
    };

    const response = await adapter.handle(exchange, server);
    return sendMcpHttpResponse(
      response ?? {
        statusCode: 404,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }

  async function handleRequest(req: Request): Promise<Response> {
    const path = getRequestPath(req);
    const method = req.method.toUpperCase();
    const pathSegments = path.split("/").filter(Boolean);

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders("GET,POST,OPTIONS"),
      });
    }

    const remoteMcpResponse = await handleRemoteMcp(req);
    if (remoteMcpResponse) {
      return remoteMcpResponse;
    }

    if (method === "GET" && path === "/health") {
      return sendJson(200, {
        ok: true,
        app: "deno-example-agent",
        status: "ready",
      });
    }

    if (method === "GET" && path === "/manifest") {
      const catalog = buildAgentCatalog();

      return sendJson(200, {
        app: "deno-example-agent",
        port: listeningPort,
        registeredDomains: Object.keys(registry._cases),
        packages: Object.keys(registry._packages ?? {}),
        tools: catalog.map((entry) => entry.publishedName),
        mcpEnabledTools: catalog
          .filter((entry) => entry.isMcpEnabled)
          .map((entry) => entry.publishedName),
        transports: {
          http: true,
          mcp: {
            stdio: registry._providers?.mcpAdapters?.stdio?.transport,
            remote: registry._providers?.mcpAdapters?.http?.transport,
            remotePath: registry._providers?.mcpAdapters?.http?.endpointPath,
          },
        },
        systemPrompt: buildSystemPrompt(),
      });
    }

    if (method === "GET" && path === "/catalog") {
      const catalog = buildAgentCatalog();
      return sendJson(200, {
        success: true,
        data: {
          systemPrompt: buildSystemPrompt(),
          resources: await listMcpResources({
            transport: "http",
          }),
          tools: catalog.map(toCatalogDocument),
        },
      });
    }

    if (
      method === "POST" &&
      pathSegments.length === 3 &&
      pathSegments[0] === "tools" &&
      pathSegments[2] === "execute"
    ) {
      const toolName = decodeURIComponent(pathSegments[1] ?? "");
      let body: unknown;

      try {
        body = await readRequestBody(req);
      } catch (error: unknown) {
        return sendStructuredError(
          400,
          "INVALID_REQUEST",
          error instanceof Error ? error.message : "Invalid request payload",
        );
      }

      const envelope = toExecutionEnvelope(body);

      try {
        const resolved = resolveTool(toolName, {
          confirmed: envelope.confirmed,
        });

        if (!resolved) {
          throw new AppCaseError(
            "NOT_FOUND",
            `Tool ${toolName} is not registered in apps/agent`,
          );
        }

        const data = await executeTool(toolName, envelope.input, {
          confirmed: envelope.confirmed,
        });

        return sendJson(200, {
          success: true,
          data,
          meta: {
            toolName: resolved.publishedName,
            requiresConfirmation: resolved.requiresConfirmation,
            executionMode: resolved.executionMode,
          },
        });
      } catch (error: unknown) {
        if (error instanceof AppCaseError) {
          return sendStructuredError(
            mapErrorCodeToStatus(error.code),
            error.code,
            error.message,
            error.details,
          );
        }

        logger.error("Unhandled agent route error", {
          error: error instanceof Error ? error.message : "unknown",
          method,
          path,
          toolName,
        });

        return sendStructuredError(
          500,
          "INTERNAL",
          "Internal agent scaffold error.",
        );
      }
    }

    return sendStructuredError(
      404,
      "NOT_FOUND",
      "Route not found in agent scaffold.",
      { method, path },
    );
  }

  async function startAgent(): Promise<AgentServer> {
    const runtimeSummary = await validateAgenticRuntime();
    const server = Deno.serve(
      {
        hostname: "127.0.0.1",
        port: registry._providers?.port ?? 3001,
        onListen: () => undefined,
      },
      handleRequest,
    );

    listeningPort = server.addr.port;

    logger.info("Agent scaffold started", {
      port: listeningPort,
      ...runtimeSummary,
    });

    return server;
  }

  return {
    registry,
    createApiContext,
    createAgenticContext,
    buildAgentCatalog,
    resolveTool,
    executeTool,
    validateAgenticRuntime,
    buildSystemPrompt,
    mcpServerInfo,
    initializeMcp,
    listMcpTools,
    listMcpResources,
    readMcpResource,
    callMcpTool,
    publishMcp,
    handleRequest,
    startAgent,
  };
}

const app = bootstrap();

export const registry = app.registry;
export const createApiContext = app.createApiContext;
export const createAgenticContext = app.createAgenticContext;
export const buildAgentCatalog = app.buildAgentCatalog;
export const resolveTool = app.resolveTool;
export const executeTool = app.executeTool;
export const validateAgenticRuntime = app.validateAgenticRuntime;
export const buildSystemPrompt = app.buildSystemPrompt;
export const mcpServerInfo = app.mcpServerInfo;
export const initializeMcp = app.initializeMcp;
export const listMcpTools = app.listMcpTools;
export const listMcpResources = app.listMcpResources;
export const readMcpResource = app.readMcpResource;
export const callMcpTool = app.callMcpTool;
export const publishMcp = app.publishMcp;
export const handleRequest = app.handleRequest;
export const startAgent = app.startAgent;
