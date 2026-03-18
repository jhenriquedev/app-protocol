/* ========================================================================== *
 * APP v1.0.1
 * core/shared/app_host_contracts.ts
 * ----------------------------------------------------------------------------
 * APP registry contracts.
 *
 * They define the minimum interface for:
 * - AppCaseSurfaces: the surfaces available for a Case inside a registry
 * - AppRegistry: the catalog of Cases and surfaces loaded by an app
 * - InferCasesMap: utility type for typing ctx.cases
 *
 * Each app in apps/ uses these contracts:
 * - registry.ts exports a registry (using `satisfies` to preserve types)
 * - app.ts consumes the registry to build the runtime
 *
 * The protocol defines the shape, not the content:
 * - which Cases and surfaces to load is each app's decision
 * - how to assemble the runtime (monolith, lambda, edge) is a project decision
 * - the framework (Hono, Express, React, etc.) is a project decision
 * ========================================================================== */

import { Dict } from "../domain.case";
import { ApiContext } from "../api.case";
import { UiContext } from "../ui.case";
import { StreamContext } from "../stream.case";
import {
  AgenticContext,
  BaseAgenticCase,
  type AgenticDefinition,
} from "../agentic.case";

/* ==========================================================================
 * AppCaseSurfaces
 * --------------------------------------------------------------------------
 * Describes the surfaces available for a Case inside a registry.
 *
 * Each key is a canonical surface and the value is the class constructor.
 * Only the surfaces needed by the app are registered.
 *
 * Each surface is typed with its specific context (ApiContext, UiContext,
 * etc.), not with a generic AppBaseContext. This removes the need for
 * casts in hosts when instantiating Cases from the registry.
 *
 * Example:
 *   { api: UserValidateApi }                    — backend only
 *   { ui: UserValidateUi }                      — frontend only
 *   { api: UserRegisterApi, stream: UserRegisterStream }  — backend + stream
 * ========================================================================== */

export interface AppCaseSurfaces {
  domain?: new (...args: unknown[]) => unknown;
  api?: new (ctx: ApiContext, ...args: unknown[]) => unknown;
  ui?: new (ctx: UiContext, ...args: unknown[]) => unknown;
  stream?: new (ctx: StreamContext, ...args: unknown[]) => unknown;
  agentic?: new (ctx: AgenticContext, ...args: unknown[]) => unknown;
}

/* ==========================================================================
 * AppRegistry
 * --------------------------------------------------------------------------
 * Unified app registry interface.
 *
 * Three canonical slots:
 *
 * - _cases:     Active Cases in this app (domain → case → surfaces).
 *               Each entry is a surface constructor imported from cases/.
 *
 * - _providers: Providers and adapters assembled by the host.
 *               Podem satisfazer contratos de core/shared/app_infra_contracts
 *               or expose project-specific providers.
 *
 * - _packages:  Shared pure libraries from packages/.
 *               Exposed to Cases through ctx.packages.
 *
 * No slot is required besides _cases.
 *
 * Uso:
 *   export function createRegistry(config) {
 *     return { _cases: {...}, _providers: {...}, _packages: {...} } as const;
 *   }
 *   export type MyAppRegistry = ReturnType<typeof createRegistry>;
 *
 * The registry centralizes everything the app needs to register in a single file.
 * ========================================================================== */

export interface AppRegistry {
  /**
   * Active Cases in this app.
   * Shape: domain → case → surfaces (constructors).
   */
  _cases: Dict<Dict<AppCaseSurfaces>>;

  /**
   * Providers and adapters assembled by the host.
   */
  _providers?: Dict;

  /**
   * Library packages.
   * Pure shared code exposed to Cases through ctx.packages.
   */
  _packages?: Dict;
}

/* ==========================================================================
 * AgenticRegistry
 * --------------------------------------------------------------------------
 * Formal extension of AppRegistry for agentic hosts.
 *
 * The host still uses `_cases`, `_providers`, and `_packages` as canonical
 * slots. The agentic specialization only adds catalog, lookup, and
 * instantiation capabilities for agentic surfaces.
 * ========================================================================== */

export interface AgenticCaseRef {
  domain: string;
  caseName: string;
}

export interface AgenticCatalogEntry<TInput = unknown, TOutput = unknown> {
  ref: AgenticCaseRef;
  publishedName: string;
  definition: AgenticDefinition<TInput, TOutput>;
  isMcpEnabled: boolean;
  requiresConfirmation: boolean;
  executionMode: "suggest-only" | "manual-approval" | "direct-execution";
}

export interface AgenticRegistry extends AppRegistry {
  listAgenticCases(): AgenticCaseRef[];
  getAgenticSurface(ref: AgenticCaseRef): AppCaseSurfaces["agentic"] | undefined;
  instantiateAgentic(
    ref: AgenticCaseRef,
    ctx: AgenticContext
  ): BaseAgenticCase;
  buildCatalog(ctx: AgenticContext): AgenticCatalogEntry[];
  resolveTool(
    toolName: string,
    ctx: AgenticContext
  ): AgenticCatalogEntry | undefined;
  listMcpEnabledTools(ctx: AgenticContext): AgenticCatalogEntry[];
}

/* ==========================================================================
 * InferCasesMap
 * --------------------------------------------------------------------------
 * Utility type that derives the instance map from a registry.
 *
 * Converts constructors into their instance types while preserving the
 * literal key structure (domain → case → surface → instance).
 *
 * Uso:
 *   const registry = { ... } satisfies Record<string, Record<string, AppCaseSurfaces>>;
 *   type MyCasesMap = InferCasesMap<typeof registry>;
 *
 * Inside _composition:
 *   const cases = this.ctx.cases as MyCasesMap | undefined;
 *   // autocomplete: cases?.users?.user_validate?.api?.handler(...)
 *
 * Important:
 * - the registry MUST NOT be annotated as `: AppRegistry` — that erases
 *   the literal structure. Use `satisfies` to validate without losing types.
 * - ctx.cases remains Dict in the base contracts (no generic cascade).
 * - the cast is safe because it is mechanically derived from the real registry.
 * ========================================================================== */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any[] is required
// for contravariant constructor matching with typed parameters (ApiContext, etc.)
type InferSurfaceInstances<S extends AppCaseSurfaces> = {
  [K in keyof S]: S[K] extends new (...args: any[]) => infer I ? I : never;
};

export type InferCasesMap<
  R extends Record<string, Record<string, AppCaseSurfaces>>
> = {
  [Domain in keyof R]: {
    [CaseName in keyof R[Domain]]: InferSurfaceInstances<R[Domain][CaseName]>;
  };
};
