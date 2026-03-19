/* ========================================================================== *
 * Agent App — Registry
 * ----------------------------------------------------------------------------
 * Host canônico agentic do src/.
 *
 * O registry mantém `_cases`, `_providers` e `_packages` como fonte única
 * de verdade, e adiciona somente as capacidades formais exigidas por
 * AgenticRegistry para catálogo, resolução e publicação MCP.
 * ========================================================================== */

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
import { UserValidateApi } from "../../cases/users/user_validate/user_validate.api.case";
import { UserValidateAgentic } from "../../cases/users/user_validate/user_validate.agentic.case";
import { UserRegisterApi } from "../../cases/users/user_register/user_register.api.case";
import { UserRegisterStream } from "../../cases/users/user_register/user_register.stream.case";
import { UserRegisterAgentic } from "../../cases/users/user_register/user_register.agentic.case";
import { StreamableHttpAppMcpAdapter } from "./mcp_http";
import { StdioAppMcpAdapter } from "./mcp_stdio";

export interface AgentConfig {
  port?: number;
}

function toPublishedToolName(entry: AgenticCatalogEntry): string {
  if (entry.isMcpEnabled) {
    return entry.definition.mcp?.name ?? entry.definition.tool.name;
  }

  return entry.definition.tool.name;
}

export function createRegistry(config: AgentConfig = {}) {
  const cases = {
    users: {
      user_validate: {
        api: UserValidateApi,
        agentic: UserValidateAgentic,
      },
      user_register: {
        api: UserRegisterApi,
        stream: UserRegisterStream,
        agentic: UserRegisterAgentic,
      },
    },
  } satisfies Record<string, Record<string, AppCaseSurfaces>>;

  const providers = {
    port: config.port ?? 3001,
    mcpAdapters: {
      stdio: new StdioAppMcpAdapter(),
      http: new StreamableHttpAppMcpAdapter(),
    },
  };

  const packages = {};

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
