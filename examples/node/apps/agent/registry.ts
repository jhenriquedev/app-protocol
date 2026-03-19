import {
  BaseAgenticCase,
  type AgenticContext,
} from "../../core/agentic.case";
import {
  type AgenticCatalogEntry,
  type AgenticCaseRef,
  type AgenticRegistry,
  type AppCaseSurfaces,
} from "../../core/shared/app_host_contracts";
import { createDataPackage, createJsonFileStore } from "../../packages/data/index";
import { type Task } from "../../cases/tasks/task_create/task_create.domain.case";
import { TaskCreateApi } from "../../cases/tasks/task_create/task_create.api.case";
import { TaskCreateAgentic } from "../../cases/tasks/task_create/task_create.agentic.case";
import { TaskListApi } from "../../cases/tasks/task_list/task_list.api.case";
import { TaskListAgentic } from "../../cases/tasks/task_list/task_list.agentic.case";
import { TaskMoveApi } from "../../cases/tasks/task_move/task_move.api.case";
import { TaskMoveAgentic } from "../../cases/tasks/task_move/task_move.agentic.case";
import { StreamableHttpAppMcpAdapter } from "./mcp_http";
import { StdioAppMcpAdapter } from "./mcp_stdio";

export interface AgentConfig {
  port?: number;
  dataDirectory?: string;
}

function toPublishedToolName(entry: AgenticCatalogEntry): string {
  if (entry.isMcpEnabled) {
    return entry.definition.mcp?.name ?? entry.definition.tool.name;
  }

  return entry.definition.tool.name;
}

export function createRegistry(config: AgentConfig = {}) {
  const data = createDataPackage(config.dataDirectory);
  const taskStore = createJsonFileStore<Task[]>({
    filePath: data.defaultFiles.tasks,
    fallbackData: [],
  });

  const cases = {
    tasks: {
      task_create: {
        api: TaskCreateApi,
        agentic: TaskCreateAgentic,
      },
      task_list: {
        api: TaskListApi,
        agentic: TaskListAgentic,
      },
      task_move: {
        api: TaskMoveApi,
        agentic: TaskMoveAgentic,
      },
    },
  } satisfies Record<string, Record<string, AppCaseSurfaces>>;

  const providers = {
    port: config.port ?? 3001,
    taskStore,
    mcpAdapters: {
      stdio: new StdioAppMcpAdapter(),
      http: new StreamableHttpAppMcpAdapter(),
    },
  };

  const packages = {
    data,
  };

  const registeredCases = cases as Record<string, Record<string, AppCaseSurfaces>>;

  const listAgenticCases = (): AgenticCaseRef[] =>
    Object.entries(cases).flatMap(([domain, domainCases]) =>
      Object.entries(domainCases)
        .filter(([, surfaces]) => Boolean(surfaces.agentic))
        .map(([caseName]) => ({ domain, caseName }))
    );

  const getAgenticSurface = (ref: AgenticCaseRef) =>
    registeredCases[ref.domain]?.[ref.caseName]?.agentic;

  const instantiateAgentic = (
    ref: AgenticCaseRef,
    ctx: AgenticContext
  ): BaseAgenticCase => {
    const AgenticSurface = getAgenticSurface(ref);

    if (!AgenticSurface) {
      throw new Error(
        `Agentic surface not found for ${ref.domain}/${ref.caseName}`
      );
    }

    return new AgenticSurface(ctx) as BaseAgenticCase;
  };

  const buildCatalog = (ctx: AgenticContext): AgenticCatalogEntry[] =>
    listAgenticCases().map((ref) => {
      const instance = instantiateAgentic(ref, ctx);
      const definition = instance.definition();
      const requiresConfirmation = instance.requiresConfirmation();

      const entry: AgenticCatalogEntry = {
        ref,
        publishedName: "",
        definition,
        isMcpEnabled: instance.isMcpEnabled(),
        requiresConfirmation,
        executionMode:
          definition.policy?.executionMode ??
          (requiresConfirmation ? "manual-approval" : "direct-execution"),
      };

      entry.publishedName = toPublishedToolName(entry);
      return entry;
    });

  const resolveTool = (toolName: string, ctx: AgenticContext) => {
    const normalized = toolName.trim();

    return buildCatalog(ctx).find(
      (entry) =>
        entry.publishedName === normalized ||
        entry.definition.tool.name === normalized
    );
  };

  const listMcpEnabledTools = (ctx: AgenticContext) =>
    buildCatalog(ctx).filter((entry) => entry.isMcpEnabled);

  return {
    _cases: cases,
    _providers: providers,
    _packages: packages,
    listAgenticCases,
    getAgenticSurface,
    instantiateAgentic,
    buildCatalog,
    resolveTool,
    listMcpEnabledTools,
  } satisfies AgenticRegistry;
}

export type AgentRegistry = ReturnType<typeof createRegistry>;
export type AgentCases = AgentRegistry["_cases"];
export type AgentProviders = AgentRegistry["_providers"];
export type AgentPackages = AgentRegistry["_packages"];
