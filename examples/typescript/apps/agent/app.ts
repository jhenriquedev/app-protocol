import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  type AgenticCatalogEntry,
  type AppCaseSurfaces,
} from "../../core/shared/app_host_contracts";
import { type AgenticContext } from "../../core/agentic.case";
import { type ApiContext, type ApiResponse } from "../../core/api.case";
import { type AppLogger } from "../../core/shared/app_base_context";
import { AppCaseError } from "../../core/shared/app_structural_contracts";
import {
  AppMcpProtocolError,
  type AppMcpCallResult,
  type AppMcpHttpExchange,
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
import { createRegistry, type AgentConfig } from "./registry";

const APP_VERSION = "1.1.1";
const DEFAULT_MCP_PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_MCP_PROTOCOL_VERSIONS = [
  DEFAULT_MCP_PROTOCOL_VERSION,
  "2025-11-25",
] as const;

type ParentExecutionContext = {
  correlationId: string;
  tenantId?: string;
  userId?: string;
  config?: ApiContext["config"];
  auth?: ApiContext["auth"];
  db?: ApiContext["db"];
  storage?: ApiContext["storage"];
  extra?: AgenticContext["extra"];
  confirmed?: boolean;
  mcp?: Partial<AppMcpRequestContext>;
};

type CasesMap = Record<string, Record<string, Record<string, unknown>>>;

type ExecuteEnvelope = {
  input?: unknown;
  confirmed?: boolean;
};

const logger: AppLogger = {
  debug: (message, meta) => console.debug("[typescript/agent]", message, meta),
  info: (message, meta) => console.info("[typescript/agent]", message, meta),
  warn: (message, meta) => console.warn("[typescript/agent]", message, meta),
  error: (message, meta) => console.error("[typescript/agent]", message, meta),
};

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function humanize(value: string): string {
  return value
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeItems(values?: string[]): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function joinLabel(label: string, values?: string[]): string | undefined {
  const normalized = normalizeItems(values);
  if (normalized.length === 0) {
    return undefined;
  }

  return `${label}: ${normalized.join("; ")}.`;
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
    confirmed: record.confirmed === true,
  };
}

function toHttpStatus(code?: string): number {
  switch (code) {
    case "VALIDATION_FAILED":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "CONFIRMATION_REQUIRED":
      return 409;
    case "EXECUTION_MODE_RESTRICTED":
      return 403;
    default:
      return 500;
  }
}

async function readTextBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const text = await readTextBody(request);
  if (text.trim().length === 0) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function buildSystemPromptResourceUri(): string {
  return "app://agent/system/prompt";
}

function buildToolResourceUri(entry: AgenticCatalogEntry): string {
  return `app://agent/tools/${entry.publishedName}/semantic`;
}

function stripEntry(entry: AgenticCatalogEntry) {
  return {
    ref: entry.ref,
    publishedName: entry.publishedName,
    isMcpEnabled: entry.isMcpEnabled,
    requiresConfirmation: entry.requiresConfirmation,
    executionMode: entry.executionMode,
    definition: {
      discovery: entry.definition.discovery,
      context: entry.definition.context,
      prompt: entry.definition.prompt,
      mcp: entry.definition.mcp,
      rag: entry.definition.rag,
      policy: entry.definition.policy,
      examples: entry.definition.examples,
      tool: {
        name: entry.definition.tool.name,
        description: entry.definition.tool.description,
        inputSchema: entry.definition.tool.inputSchema,
        outputSchema: entry.definition.tool.outputSchema,
        isMutating: entry.definition.tool.isMutating ?? false,
        requiresConfirmation: entry.definition.tool.requiresConfirmation ?? false,
      },
    },
  };
}

function toCatalogDocument(entry: AgenticCatalogEntry) {
  return {
    ref: entry.ref,
    publishedName: entry.publishedName,
    isMcpEnabled: entry.isMcpEnabled,
    requiresConfirmation: entry.requiresConfirmation,
    executionMode: entry.executionMode,
    semanticSummary: buildToolSummary(entry),
    promptFragment: buildToolPromptFragment(entry),
    resources: {
      semantic: buildToolResourceUri(entry),
    },
    definition: stripEntry(entry).definition,
  };
}

function buildToolSummary(entry: AgenticCatalogEntry): string {
  const { discovery, context, prompt, policy } = entry.definition;
  const parts = [
    prompt.purpose,
    joinLabel("Use when", [...(prompt.whenToUse ?? []), ...(discovery.intents ?? [])]),
    joinLabel("Do not use when", prompt.whenNotToUse),
    joinLabel("Preconditions", context.preconditions),
    joinLabel("Constraints", [
      ...(context.constraints ?? []),
      ...(prompt.constraints ?? []),
      ...(policy?.limits ?? []),
    ]),
    prompt.expectedOutcome
      ? `Expected outcome: ${prompt.expectedOutcome}.`
      : undefined,
  ];

  return parts.filter(Boolean).join(" ");
}

function buildToolPromptFragment(entry: AgenticCatalogEntry): string {
  const { discovery, context, prompt, rag, policy } = entry.definition;
  return [
    `Tool ${entry.publishedName}: ${prompt.purpose}`,
    joinLabel("Use when", [...(prompt.whenToUse ?? []), ...(discovery.intents ?? [])]),
    joinLabel("Do not use when", prompt.whenNotToUse),
    joinLabel("Aliases", discovery.aliases),
    joinLabel("Capabilities", discovery.capabilities),
    joinLabel("Dependencies", context.dependencies),
    joinLabel("Preconditions", context.preconditions),
    joinLabel("Constraints", [
      ...(context.constraints ?? []),
      ...(prompt.constraints ?? []),
      ...(policy?.limits ?? []),
    ]),
    joinLabel("Reasoning hints", prompt.reasoningHints),
    joinLabel("RAG topics", rag?.topics),
    joinLabel(
      "RAG resources",
      rag?.resources?.map((resource) =>
        resource.description
          ? `${resource.kind}:${resource.ref} (${resource.description})`
          : `${resource.kind}:${resource.ref}`
      )
    ),
    joinLabel("RAG hints", rag?.hints),
    `Execution mode: ${entry.executionMode}.`,
    `Requires confirmation: ${entry.requiresConfirmation ? "yes" : "no"}.`,
    prompt.expectedOutcome
      ? `Expected outcome: ${prompt.expectedOutcome}.`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function toMcpSemanticAnnotations(entry: AgenticCatalogEntry) {
  return {
    readOnlyHint: !(entry.definition.tool.isMutating ?? false),
    destructiveHint: entry.definition.tool.isMutating ?? false,
    requiresConfirmation: entry.requiresConfirmation,
    executionMode: entry.executionMode,
    appSemantic: {
      summary: buildToolSummary(entry),
      discovery: entry.definition.discovery,
      context: entry.definition.context,
      prompt: entry.definition.prompt,
      policy: entry.definition.policy,
      rag: entry.definition.rag,
      exampleNames:
        entry.definition.examples?.map((example) => example.name) ?? [],
      resourceUri: buildToolResourceUri(entry),
    },
  };
}

function toMcpToolDescriptor(entry: AgenticCatalogEntry): AppMcpToolDescriptor {
  const summary = buildToolSummary(entry);

  return {
    name: entry.publishedName,
    title: entry.definition.mcp?.title ?? humanize(entry.publishedName),
    description:
      entry.definition.mcp?.description
        ? `${entry.definition.mcp.description} ${summary}`
        : summary,
    inputSchema: entry.definition.tool.inputSchema,
    outputSchema: entry.definition.tool.outputSchema,
    annotations: toMcpSemanticAnnotations(entry),
  };
}

function toMcpToolResource(entry: AgenticCatalogEntry): AppMcpResourceDescriptor {
  return {
    uri: buildToolResourceUri(entry),
    name: `${entry.publishedName}_semantic`,
    title: `${humanize(entry.publishedName)} Semantic Contract`,
    description: `Complete APP agentic definition projected automatically from the registry for ${entry.publishedName}.`,
    mimeType: "application/json",
    annotations: {
      toolName: entry.publishedName,
      executionMode: entry.executionMode,
      requiresConfirmation: entry.requiresConfirmation,
    },
  };
}

function toMcpSystemPromptResource(): AppMcpResourceDescriptor {
  return {
    uri: buildSystemPromptResourceUri(),
    name: "typescript_agent_system_prompt",
    title: "TypeScript Agent System Prompt",
    description: "Host-level system prompt derived from registered tool fragments.",
    mimeType: "text/markdown",
    annotations: {
      kind: "system-prompt",
    },
  };
}

export function bootstrap(config: AgentConfig = {}) {
  const registry = createRegistry(config);
  const providers = registry._providers as {
    port: number;
    mcpAdapters: {
      http: {
        handle(
          exchange: AppMcpHttpExchange,
          server: AppMcpServer
        ): Promise<{
          statusCode: number;
          headers?: Record<string, string>;
          bodyText?: string;
        } | undefined>;
      };
      stdio: {
        serve(server: AppMcpServer): Promise<void>;
      };
    };
  };

  function createCasesMap(parent: ParentExecutionContext): CasesMap {
    const cases: CasesMap = {};

    for (const [domain, domainCases] of Object.entries(registry._cases)) {
      cases[domain] = {};

      for (const [caseName, entry] of Object.entries(domainCases)) {
        const surfaces = entry as AppCaseSurfaces;
        const instanceMap: Record<string, unknown> = {};

        if (surfaces.api) {
          const ApiClass = surfaces.api;
          instanceMap.api = {
            handler: async (input: unknown) => {
              const api = new ApiClass(createApiContext(parent)) as {
                handler(payload: unknown): Promise<ApiResponse<unknown>>;
              };
              return api.handler(input);
            },
          };
        }

        cases[domain][caseName] = instanceMap;
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
      extra: parent?.extra,
      packages: registry._packages,
      cases: {},
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
      extra: parent?.extra,
      packages: registry._packages,
      cases: {},
      mcp: parent?.mcp,
    };

    ctx.cases = createCasesMap({
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      config: ctx.config,
      extra: ctx.extra,
    });

    return ctx;
  }

  function buildAgentCatalog(
    parent?: Partial<ParentExecutionContext>
  ): AgenticCatalogEntry[] {
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
      "You are operating the TypeScript APP agent host.",
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

  function mcpServerInfo(parent?: Partial<ParentExecutionContext>): AppMcpServerInfo {
    return {
      name: "app-typescript-agent",
      version: APP_VERSION,
      protocolVersion: DEFAULT_MCP_PROTOCOL_VERSION,
      instructions: buildSystemPrompt(parent),
    };
  }

  function resolveTool(
    toolName: string,
    parent?: Partial<ParentExecutionContext>
  ): AgenticCatalogEntry | undefined {
    return registry.resolveTool(toolName, createAgenticContext(parent));
  }

  async function executeTool(
    toolName: string,
    input: unknown,
    parent?: Partial<ParentExecutionContext>
  ): Promise<unknown> {
    const entry = resolveTool(toolName, parent);
    if (!entry) {
      throw new AppCaseError("NOT_FOUND", `Tool ${toolName} is not registered`);
    }

    if (entry.executionMode === "suggest-only") {
      throw new AppCaseError(
        "EXECUTION_MODE_RESTRICTED",
        `Tool ${entry.publishedName} is restricted to suggest-only mode`
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

  async function initializeMcp(
    params?: AppMcpInitializeParams,
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpInitializeResult> {
    const requestedVersion = params?.protocolVersion ?? DEFAULT_MCP_PROTOCOL_VERSION;
    if (!SUPPORTED_MCP_PROTOCOL_VERSIONS.includes(requestedVersion as never)) {
      throw new AppMcpProtocolError(
        -32001,
        `Unsupported MCP protocol version ${requestedVersion}`,
        {
          supportedVersions: [...SUPPORTED_MCP_PROTOCOL_VERSIONS],
        }
      );
    }

    const info = mcpServerInfo({
      mcp: parent,
    });

    return {
      protocolVersion: requestedVersion,
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
      },
      serverInfo: {
        name: info.name,
        version: info.version,
      },
      instructions: info.instructions,
    };
  }

  async function listMcpTools(
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpToolDescriptor[]> {
    return buildAgentCatalog({
      mcp: parent,
    })
      .filter((entry) => entry.isMcpEnabled)
      .map((entry) => toMcpToolDescriptor(entry));
  }

  async function listMcpResources(
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpResourceDescriptor[]> {
    return [
      toMcpSystemPromptResource(),
      ...buildAgentCatalog({
        mcp: parent,
      })
        .filter((entry) => entry.isMcpEnabled)
        .map((entry) => toMcpToolResource(entry)),
    ];
  }

  async function readMcpResource(
    uri: string,
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpReadResourceResult> {
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

    const entry = buildAgentCatalog({
      mcp: parent,
    }).find(
      (candidate) => buildToolResourceUri(candidate) === uri
    );

    if (!entry) {
      throw new AppMcpProtocolError(-32004, `MCP resource ${uri} was not found`);
    }

    const payload = {
      app: "typescript-example-agent",
      ref: entry.ref,
      publishedName: entry.publishedName,
      isMcpEnabled: entry.isMcpEnabled,
      requiresConfirmation: entry.requiresConfirmation,
      executionMode: entry.executionMode,
      semanticSummary: buildToolSummary(entry),
      promptFragment: buildToolPromptFragment(entry),
      definition: stripEntry(entry).definition,
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
    input: unknown,
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpCallResult> {
    const envelope = toExecutionEnvelope(input);

    try {
      const result = await executeTool(name, envelope.input, {
        confirmed: envelope.confirmed,
        mcp: parent,
      });
      return {
        content: [
          toMcpTextContent(`Tool ${name} executed successfully.`),
        ],
        structuredContent: result,
        isError: false,
      };
    } catch (error) {
      const appError =
        error instanceof AppCaseError
          ? error
          : new AppCaseError(
              "INTERNAL",
              error instanceof Error ? error.message : "Unexpected tool failure"
            );

      return {
        content: [toMcpTextContent(appError.message)],
        structuredContent: {
          success: false,
          error: appError.toAppError(),
        },
        isError: true,
      };
    }
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
    await validateAgenticRuntime();
    await providers.mcpAdapters.stdio.serve(createMcpServer());
  }

  async function validateAgenticRuntime(): Promise<{
    tools: number;
    mcpEnabled: number;
    requireConfirmation: number;
  }> {
    const ctx = createAgenticContext({
      correlationId: "agent-runtime-validation",
    });
    const entries = registry.buildCatalog(ctx);

    if (entries.length === 0) {
      throw new Error("apps/agent must register at least one agentic tool");
    }

    if (!providers.mcpAdapters.stdio) {
      throw new Error(
        "apps/agent must register a concrete stdio MCP adapter in _providers.mcpAdapters"
      );
    }

    if (!providers.mcpAdapters.http) {
      throw new Error(
        "apps/agent must register a concrete remote HTTP MCP adapter in _providers.mcpAdapters"
      );
    }

    const publishedNames = new Set<string>();
    for (const entry of entries) {
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

    await initializeMcp(
      {
        protocolVersion: DEFAULT_MCP_PROTOCOL_VERSION,
      },
      {
        transport: "validation",
      }
    );
    await listMcpTools({
      transport: "validation",
    });
    const resources = await listMcpResources({
      transport: "validation",
    });
    await readMcpResource(buildSystemPromptResourceUri(), {
      transport: "validation",
    });

    if (resources.length < entries.filter((entry) => entry.isMcpEnabled).length + 1) {
      throw new Error(
        "apps/agent must publish a system prompt resource and one semantic resource per MCP-enabled tool"
      );
    }

    return {
      tools: entries.length,
      mcpEnabled: entries.filter((entry) => entry.isMcpEnabled).length,
      requireConfirmation: entries.filter((entry) => entry.requiresConfirmation).length,
    };
  }

  const mcpServer = createMcpServer();

  async function handleMcpHttp(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<boolean> {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (path !== "/mcp") {
      return false;
    }

    const httpAdapter = providers.mcpAdapters.http;
    const exchange: AppMcpHttpExchange = {
      method: request.method ?? "GET",
      path,
      headers: Object.fromEntries(
        Object.entries(request.headers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join(", ") : value,
        ])
      ),
      bodyText:
        request.method === "POST" ? await readTextBody(request) : undefined,
    };

    const result = await httpAdapter.handle(exchange, mcpServer);
    if (!result) {
      return false;
    }

    response.writeHead(result.statusCode, result.headers);
    response.end(result.bodyText);
    return true;
  }

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", "http://localhost");

    try {
      if (await handleMcpHttp(request, response)) {
        return;
      }

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
          ok: true,
          host: "agent",
          port: providers.port,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/manifest") {
        sendJson(response, 200, {
          host: "agent",
          routes: [
            "GET /health",
            "GET /manifest",
            "GET /catalog",
            "POST /tools/:toolName/execute",
            "POST /mcp",
          ],
          mcp: mcpServerInfo(),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/catalog") {
        const entries = buildAgentCatalog();
        sendJson(response, 200, {
          success: true,
          data: {
            systemPrompt: buildSystemPrompt(),
            resources: await listMcpResources({
              transport: "http",
            }),
            tools: entries.map(toCatalogDocument),
          },
        });
        return;
      }

      if (
        request.method === "POST" &&
        /^\/tools\/[^/]+\/execute$/.test(url.pathname)
      ) {
        const [, , toolName] = url.pathname.split("/");
        const envelope = toExecutionEnvelope(await readJsonBody(request));
        const output = await executeTool(toolName, envelope.input, {
          correlationId: request.headers["x-correlation-id"]?.toString() ?? generateId(),
          confirmed: envelope.confirmed,
        });

        sendJson(response, 200, {
          success: true,
          data: output,
        });
        return;
      }

      sendJson(response, 404, {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `No agent route matched ${request.method} ${url.pathname}`,
        },
      });
    } catch (error) {
      const appError =
        error instanceof AppCaseError
          ? error
          : new AppCaseError(
              "INTERNAL",
              error instanceof Error ? error.message : "Unexpected agent error"
            );

      logger.error("agent request failed", {
        path: request.url,
        code: appError.code,
        message: appError.message,
      });

      sendJson(response, toHttpStatus(appError.code), {
        success: false,
        error: appError.toAppError(),
      });
    }
  }

  function start() {
    const server = createServer((request, response) => {
      void handle(request, response);
    });

    return new Promise<typeof server>((resolve) => {
      server.listen(providers.port, () => {
        logger.info("agent listening", {
          port: providers.port,
        });
        resolve(server);
      });
    });
  }

  return {
    registry,
    createAgenticContext,
    buildAgentCatalog,
    buildSystemPrompt,
    resolveTool,
    executeTool,
    initializeMcp,
    listMcpTools,
    listMcpResources,
    readMcpResource,
    callMcpTool,
    publishMcp,
    validateAgenticRuntime,
    server: mcpServer,
    handle,
    start,
  };
}
