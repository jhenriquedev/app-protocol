/* ========================================================================== *
 * APP v1.1.6
 * core/agentic.case.ts
 * ----------------------------------------------------------------------------
 * Base contract for the APP agentic surface.
 *
 * Role of this surface:
 * - make a Case understandable to agents
 * - expose discovery, context, prompt, tool, MCP, and RAG
 * - keep real execution pointing to canonical Case surfaces
 *
 * Fundamental rule:
 * - agentic.case.ts does NOT reimplement the main capability logic
 * - agentic.case.ts describes and operates the capability through structured contracts
 *
 * Integration with domain.case.ts:
 * - this base allows deriving schema, description, and examples from the domain
 * - this reduces semantic duplication and drift between domain and tool
 *
 * Context:
 * - AgenticContext extends AppBaseContext with agentic infrastructure
 * - it includes the Cases registry and MCP runtime information
 * ========================================================================== */

import { AppSchema, BaseDomainCase, Dict, DomainExample } from "./domain.case";

import { AppBaseContext } from "./shared/app_base_context";

/* ==========================================================================
 * AgenticContext
 * --------------------------------------------------------------------------
 * Agentic surface-specific context.
 *
 * Extends AppBaseContext with agentic operation infrastructure:
 * - cases: registry of Cases loaded by the runtime (for tool resolution)
 * - mcp: MCP runtime information, when available
 *
 * The cases field is essential so the agentic tool can
 * point to canonical execution through ctx.cases.
 * ========================================================================== */

export interface AgenticContext extends AppBaseContext {
  /**
   * Registry of Cases loaded by the runtime.
   *
   * Used by the tool to resolve the canonical execution of the Case.
   *
   * Access example:
   * ctx.cases?.users?.user_validate?.api?.handler(input)
   */
  cases?: Dict;

  /**
   * Library packages registered by the host.
   *
   * Exposed through registry._packages.
   * Pure libraries from packages/ that the app makes available.
   */
  packages?: Dict;

  /**
   * MCP runtime information, when available.
   *
   * Examples: MCP server instance, adapter config, transport info.
   */
  mcp?: unknown;

  /**
   * Free extension space for the project host.
   */
  extra?: Dict;
}

/* ==========================================================================
 * Discovery
 * ========================================================================== */

export interface AgenticDiscovery {
  /**
   * Canonical Case name.
   */
  name: string;

  /**
   * Short, clear description of the capability.
   */
  description: string;

  /**
   * Semantic category.
   * Example: "users", "billing"
   */
  category?: string;

  /**
   * Helper tags for indexing.
   */
  tags?: string[];

  /**
   * Alternative names or aliases.
   */
  aliases?: string[];

  /**
   * Capabilities represented by the Case.
   */
  capabilities?: string[];

  /**
   * Usage intents.
   */
  intents?: string[];
}

/* ==========================================================================
 * Execution context for agents
 * ========================================================================== */

export interface AgenticExecutionContext {
  /**
   * Indicates whether authentication is required.
   */
  requiresAuth?: boolean;

  /**
   * Indicates whether a tenant is required.
   */
  requiresTenant?: boolean;

  /**
   * Semantic dependencies or related surfaces.
   * Example: ["user_validate.api", "user_validate.domain"]
   */
  dependencies?: string[];

  /**
   * Preconditions for using the capability.
   */
  preconditions?: string[];

  /**
   * Usage constraints.
   */
  constraints?: string[];

  /**
   * Auxiliary notes.
   */
  notes?: string[];
}

/* ==========================================================================
 * Structured prompt
 * ========================================================================== */

export interface AgenticPrompt {
  /**
   * Main purpose of the capability.
   */
  purpose: string;

  /**
   * When to use it.
   */
  whenToUse?: string[];

  /**
   * When not to use it.
   */
  whenNotToUse?: string[];

  /**
   * Specific constraints.
   */
  constraints?: string[];

  /**
   * Reasoning hints for agents.
   */
  reasoningHints?: string[];

  /**
   * Expected outcome in natural language.
   */
  expectedOutcome?: string;
}

/* ==========================================================================
 * Tool contract
 * ========================================================================== */

export interface AgenticToolContract<TInput = unknown, TOutput = unknown> {
  /**
   * Canonical tool name.
   */
  name: string;

  /**
   * Short tool description.
   */
  description: string;

  /**
   * Input schema.
   */
  inputSchema: AppSchema;

  /**
   * Output schema.
   */
  outputSchema: AppSchema;

  /**
   * Indicates whether the tool causes side effects.
   */
  isMutating?: boolean;

  /**
   * Indicates whether execution requires explicit confirmation.
   */
  requiresConfirmation?: boolean;

  /**
   * Actual tool execution.
   *
   * Rule:
   * it must point to the canonical implementation of the Case.
   */
  execute(input: TInput, ctx: AgenticContext): Promise<TOutput>;
}

/* ==========================================================================
 * MCP
 * --------------------------------------------------------------------------
 * MCP exposure contract with normative fallback to tool.
 *
 * `tool` is the canonical contract for agent execution.
 * `mcp` is an optional exposure configuration for MCP publication.
 *
 * Fallback rules (normative — adapters must follow):
 * - name:        uses mcp.name if provided, otherwise falls back to tool.name
 * - description: uses mcp.description if provided, otherwise falls back to tool.description
 * - title:       uses mcp.title if provided; otherwise the adapter may derive
 *                a display title from tool.name (e.g. "user_validate" → "User Validate")
 * - inputSchema and outputSchema: always derived from tool
 * - execute:     always delegates to tool.execute()
 *
 * mcp controls presence and presentation.
 * It never redefines schemas or execution paths.
 *
 * Full MCP publication is still an app-host concern:
 * - `agentic.case.ts` declares Case-level MCP metadata
 * - `apps/agent/` publishes the concrete MCP boundary through its registry/app runtime
 * ========================================================================== */

export interface AgenticMcpContract {
  /**
   * Whether this Case should be exposed via MCP.
   *
   * Default: true when mcp() is defined.
   */
  enabled?: boolean;

  /**
   * MCP tool name.
   *
   * Falls back to tool().name if not provided.
   */
  name?: string;

  /**
   * MCP human-readable title.
   *
   * This is an MCP-native concept — tool does not define title.
   * If not provided, the adapter may derive a display title from tool().name.
   */
  title?: string;

  /**
   * MCP tool description.
   *
   * Falls back to tool().description if not provided.
   */
  description?: string;

  /**
   * Additional metadata for MCP adapters.
   */
  metadata?: Dict;
}

/* ==========================================================================
 * RAG
 * --------------------------------------------------------------------------
 * The APP RAG contract operates in two layers:
 *
 * 1. Semantic layer — topics, hints, scope, mode
 *    Defines retrieval intent: about what, with which guidance,
 *    within what scope, and with what level of dependency.
 *
 * 2. Concrete reference layer — resources
 *    Defines concrete references to APP-native or project-native artifacts.
 *    APP defines the addressing (kind + ref). The runtime defines resolution.
 *
 * APP does not define the RAG engine, retrieval mechanism, ranking,
 * embeddings, or search pipeline. Those responsibilities belong to the runtime.
 *
 * Extensibility:
 * New resource kinds (for example, "index") may only be standardized
 * after reference implementations demonstrate stable semantics.
 * ========================================================================== */

/**
 * Knowledge resource kinds recognized by APP.
 *
 * Each kind defines an artifact category that the protocol
 * can address in a stable way:
 *
 * - "case": reference to another Case in the APP project.
 *   ref is an identifier relative to the cases/ directory.
 *   Example: "users/user_validate"
 *
 * - "file": reference to a project file.
 *   ref is a path relative to the project root.
 *   Example: "docs/validation-rules.md"
 */
export type RagResourceKind = "case" | "file";

/**
 * Concrete reference to a knowledge artifact.
 *
 * APP defines the addressing (kind + ref).
 * The runtime defines how to resolve and access the content.
 */
export interface RagResource {
  /**
   * Resource kind.
   */
  kind: RagResourceKind;

  /**
   * Resource reference.
   *
   * Format by kind:
   * - "case": identifier relative to cases/ (e.g. "users/user_validate")
   * - "file": path relative to the project root (e.g. "docs/validation-rules.md")
   */
  ref: string;

  /**
   * Optional description of why this resource is relevant to the Case.
   */
  description?: string;
}

export interface AgenticRagContract {
  /**
   * Normalized semantic labels for the knowledge domain
   * relevant to this Case.
   *
   * Used for:
   * - semantic indexing and classification
   * - grouping Cases by knowledge area
   * - validation by tooling (lint, catalogs)
   * - integration with runtimes that maintain a knowledge catalog
   *
   * Example: ["validation_rules", "document_policy"]
   */
  topics?: string[];

  /**
   * Concrete references to APP-native
   * or project-native knowledge artifacts.
   *
   * APP does not define retrieval resolution. The runtime is responsible
   * for resolving and accessing the content of each resource.
   *
   * New resource kinds may only be standardized after
   * reference implementations demonstrate stable semantics.
   */
  resources?: RagResource[];

  /**
   * Free-form reasoning and preference guidance for the agent.
   *
   * Unlike topics (which are indexable and normalized),
   * hints are interpretive and non-structural.
   *
   * Example: ["Prefer official compliance material",
   *           "Use tenant-approved rules first"]
   */
  hints?: string[];

  /**
   * Maximum allowed scope for contextual retrieval.
   */
  scope?: "case-local" | "project" | "org-approved";

  /**
   * Degree of dependency of the Case on external context.
   */
  mode?: "disabled" | "optional" | "recommended" | "required";
}

/* ==========================================================================
 * Policy
 * ========================================================================== */

export interface AgenticPolicy {
  /**
   * Requires explicit confirmation before execution.
   */
  requireConfirmation?: boolean;

  /**
   * Requires authentication.
   */
  requireAuth?: boolean;

  /**
   * Requires tenant context.
   */
  requireTenant?: boolean;

  /**
   * Operational risk level.
   */
  riskLevel?: "low" | "medium" | "high";

  /**
   * Execution mode allowed for agents.
   */
  executionMode?: "suggest-only" | "manual-approval" | "direct-execution";

  /**
   * Additional textual limits.
   */
  limits?: string[];
}

/* ==========================================================================
 * Examples
 * ========================================================================== */

export interface AgenticExample<TInput = unknown, TOutput = unknown> {
  name: string;
  description?: string;
  input: TInput;
  output: TOutput;
  notes?: string[];
}

/* ==========================================================================
 * Consolidated definition
 * ========================================================================== */

export interface AgenticDefinition<TInput = unknown, TOutput = unknown> {
  discovery: AgenticDiscovery;
  context: AgenticExecutionContext;
  prompt: AgenticPrompt;
  tool: AgenticToolContract<TInput, TOutput>;
  mcp?: AgenticMcpContract;
  rag?: AgenticRagContract;
  policy?: AgenticPolicy;
  examples?: AgenticExample<TInput, TOutput>[];
}

/* ==========================================================================
 * Base class
 * ========================================================================== */

/**
 * Canonical base class for agentic.case.ts
 *
 * This class supports two modes:
 *
 * 1. Manual implementation
 *    The agentic surface defines everything explicitly.
 *
 * 2. Domain-derived implementation
 *    The agentic surface reuses description, schemas, and examples from domain.case.ts.
 */
export abstract class BaseAgenticCase<TInput = unknown, TOutput = unknown> {
  protected readonly ctx: AgenticContext;

  constructor(ctx: AgenticContext) {
    this.ctx = ctx;
  }

  /* ========================================================================
   * Optional connection to the domain
   * ====================================================================== */

  /**
   * Returns the local domain instance of the Case, when it exists.
   *
   * This connection allows:
   * - deriving description
   * - deriving inputSchema/outputSchema
   * - deriving examples
   *
   * Note:
   * The concrete implementation decides whether to use the domain as its base.
   */
  protected domain():
    | BaseDomainCase<TInput, TOutput>
    | undefined {
    return undefined;
  }

  /* ========================================================================
   * Required sections
   * ====================================================================== */

  /**
   * Discovery metadata.
   */
  public abstract discovery(): AgenticDiscovery;

  /**
   * Minimum context required for correct Case operation.
   */
  public abstract context(): AgenticExecutionContext;

  /**
   * Structured prompt for agents.
   */
  public abstract prompt(): AgenticPrompt;

  /**
   * Tool contract.
   *
   * Most important rule:
   * the tool must point to the canonical execution of the Case.
   */
  public abstract tool(): AgenticToolContract<TInput, TOutput>;

  /**
   * Tests the Case agentic surface.
   *
   * Recommended APP practice:
   * surfaces ideally expose test() for self-contained contract validation.
   *
   * The test must verify, at minimum:
   * - definition() returns a valid contract (validateDefinition)
   * - discovery, context, prompt, and tool are consistent with each other
   * - tool.execute() produces the expected result for known inputs
   */
  public async test(): Promise<void> {}

  /* ========================================================================
   * Optional sections
   * ====================================================================== */

  public mcp(): AgenticMcpContract | undefined {
    return undefined;
  }

  public rag(): AgenticRagContract | undefined {
    return undefined;
  }

  public policy(): AgenticPolicy | undefined {
    return undefined;
  }

  public examples(): AgenticExample<TInput, TOutput>[] {
    const domainExamples = this.domainExamples();
    return domainExamples ?? [];
  }

  /* ========================================================================
   * Domain-derived helpers
   * ====================================================================== */

  /**
   * Derives the description from the domain, when available.
   */
  protected domainDescription(): string | undefined {
    return this.domain()?.description();
  }

  /**
   * Derives the canonical name from the domain, when available.
   */
  protected domainCaseName(): string | undefined {
    return this.domain()?.caseName();
  }

  /**
   * Derives the input schema from the domain, when available.
   */
  protected domainInputSchema(): AppSchema | undefined {
    return this.domain()?.inputSchema();
  }

  /**
   * Derives the output schema from the domain, when available.
   */
  protected domainOutputSchema(): AppSchema | undefined {
    return this.domain()?.outputSchema();
  }

  /**
   * Derives examples from the domain and converts them to agentic examples.
   */
  protected domainExamples():
    | AgenticExample<TInput, TOutput>[]
    | undefined {
    const examples = this.domain()?.examples?.();
    if (!examples || examples.length === 0) return undefined;

    return examples
      .filter(
        (item): item is DomainExample<TInput, TOutput> & { output: TOutput } =>
          item.output !== undefined,
      )
      .map((item) => ({
        name: item.name,
        description: item.description,
        input: item.input,
        output: item.output,
        notes: item.notes,
      }));
  }

  /* ========================================================================
   * Public utility methods
   * ====================================================================== */

  /**
   * Returns the consolidated Agentic Protocol definition.
   */
  public definition(): AgenticDefinition<TInput, TOutput> {
    return {
      discovery: this.discovery(),
      context: this.context(),
      prompt: this.prompt(),
      tool: this.tool(),
      mcp: this.mcp(),
      rag: this.rag(),
      policy: this.policy(),
      examples: this.examples(),
    };
  }

  /**
   * Safe shortcut to execute the tool.
   */
  public async execute(input: TInput): Promise<TOutput> {
    return this.tool().execute(input, this.ctx);
  }

  /**
   * Indicates whether the agentic surface is ready for MCP exposure.
   */
  public isMcpEnabled(): boolean {
    const contract = this.mcp();
    return contract !== undefined && contract.enabled !== false;
  }

  /**
   * Indicates whether execution requires confirmation.
   *
   * This decision considers both policy and the tool contract.
   */
  public requiresConfirmation(): boolean {
    return Boolean(
      this.policy()?.requireConfirmation ||
        this.tool().requiresConfirmation,
    );
  }

  /**
   * Returns the canonical Case name.
   *
   * Priority:
   * 1. discovery.name
   * 2. domain, if available
   */
  public caseName(): string {
    return this.discovery().name || this.domainCaseName() || "unknown_case";
  }

  /* ========================================================================
   * Optional internal validation hook
   * ====================================================================== */

  /**
   * Validates internal consistency of the agentic definition.
   *
   * The base implementation verifies minimal structural invariants.
   * Subclasses may override it for additional validation
   * (e.g. prompt constraints vs tool inputSchema, examples coverage).
   *
   * Invoked by test() as the first validation phase.
   */
  protected validateDefinition(): void {
    const d = this.discovery();
    if (!d.name) throw new Error("validateDefinition: discovery.name is empty");
    if (!d.description) {
      throw new Error("validateDefinition: discovery.description is empty");
    }

    const t = this.tool();
    if (!t.name) throw new Error("validateDefinition: tool.name is empty");
    if (!t.execute) {
      throw new Error("validateDefinition: tool.execute is missing");
    }

    const p = this.prompt();
    if (!p.purpose) {
      throw new Error("validateDefinition: prompt.purpose is empty");
    }

    // MCP, if present, must have a name
    const m = this.mcp?.();
    if (m?.enabled && !m.name) {
      throw new Error("validateDefinition: mcp.enabled but mcp.name is empty");
    }
  }
}
