# Agentic Surface

The `agentic.case.ts` surface was introduced in APP `v0.0.2` and consolidated in `v0.0.3`.

It exists to make a Case discoverable, understandable, and executable by AI agents without breaking the core APP rule that execution must remain tied to the canonical implementation.

The agentic surface is optional. If a Case exposes this surface, it must follow the APP agentic protocol and must not diverge from canonical execution behavior.

## Goals

- expose a Case as a tool for AI agents
- make agent intent resolution less ambiguous
- define minimum execution context
- attach policy and safety constraints close to the capability
- improve retrieval quality for agentic runtimes
- provide MCP-compatible exposure

## Base Contract

All agentic surfaces extend `BaseAgenticCase<TInput, TOutput>`:

```ts
import { BaseAgenticCase } from "../../core/agentic.case";

export class UserValidateAgenticCase extends BaseAgenticCase<
  UserValidateInput,
  UserValidateOutput
> {
  // Required — 4 abstract methods
  public discovery(): AgenticDiscovery { ... }
  public context(): AgenticExecutionContext { ... }
  public prompt(): AgenticPrompt { ... }
  public tool(): AgenticToolContract<UserValidateInput, UserValidateOutput> { ... }

  // Recommended — self-contained conformance check
  public async test(): Promise<void> { ... }

  // Optional — have defaults in base class
  public mcp(): AgenticMcpContract | undefined { ... }
  public rag(): AgenticRagContract | undefined { ... }
  public policy(): AgenticPolicy | undefined { ... }
  public examples(): AgenticExample[] { ... }
}
```

### Required Members

| Method | Returns | Purpose |
| --- | --- | --- |
| `discovery()` | `AgenticDiscovery` | name, description, category, tags, aliases, capabilities, intents |
| `context()` | `AgenticExecutionContext` | auth, tenant, dependencies, preconditions, constraints |
| `prompt()` | `AgenticPrompt` | purpose, whenToUse, whenNotToUse, constraints, reasoningHints, expectedOutcome |
| `tool()` | `AgenticToolContract` | name, description, inputSchema, outputSchema, isMutating, requiresConfirmation, execute |

### Optional Members

| Method | Returns | Purpose |
| --- | --- | --- |
| `mcp()` | `AgenticMcpContract \| undefined` | MCP exposure config with normative fallback to `tool` |
| `rag()` | `AgenticRagContract \| undefined` | topics, resources, hints, scope, mode |
| `policy()` | `AgenticPolicy \| undefined` | requireConfirmation, requireAuth, requireTenant, riskLevel, executionMode, limits |
| `examples()` | `AgenticExample[]` | name, description, input, output, notes |

### Recommended Members

| Method | Returns | Purpose |
| --- | --- | --- |
| `test()` | `Promise<void>` | validates definition integrity, tool execution, contract consistency |

### Utility Methods (inherited from base)

| Method | Purpose |
| --- | --- |
| `definition()` | Returns the consolidated `AgenticDefinition` object |
| `execute(input)` | Shortcut for `tool().execute(input, ctx)` |
| `isMcpEnabled()` | Checks MCP readiness |
| `requiresConfirmation()` | Checks both policy and tool contract |
| `caseName()` | Resolved from discovery or domain fallback |
| `validateDefinition()` | Validates structural integrity of the definition |

## Domain Derivation

The agentic surface supports an optional connection to `domain.case.ts` via the protected `domain()` method. When provided, the following can be derived instead of being defined manually:

| Helper | Derives from |
| --- | --- |
| `domainDescription()` | `domain.description()` |
| `domainCaseName()` | `domain.caseName()` |
| `domainInputSchema()` | `domain.inputSchema()` |
| `domainOutputSchema()` | `domain.outputSchema()` |
| `domainExamples()` | `domain.examples()` (only those with defined output) |

This reduces semantic duplication and prevents drift between the domain source of truth and the agentic tool contract.

```ts
export class UserValidateAgenticCase extends BaseAgenticCase<
  UserValidateInput,
  UserValidateOutput
> {
  // Connect to the domain to derive schemas and examples
  protected domain() {
    return new UserValidateDomainCase();
  }

  public discovery(): AgenticDiscovery {
    return {
      name: this.domainCaseName() ?? "user_validate",
      description: this.domainDescription() ?? "Validates user data",
      category: "users",
    };
  }

  public tool(): AgenticToolContract<UserValidateInput, UserValidateOutput> {
    return {
      name: "user_validate",
      description: "Validates user input data",
      inputSchema: this.domainInputSchema()!,
      outputSchema: this.domainOutputSchema()!,
      execute: async (input, ctx) => {
        const result = await ctx.cases?.users?.user_validate?.api?.handler(input);

        if (!result?.success || !result.data) {
          throw new Error(
            result?.error?.message ??
              "user_validate API surface did not return data"
          );
        }

        return result.data;
      },
    };
  }

  // ...
}
```

## Invariants

The following rules are stable and normative:

1. `tool.execute()` must map to the canonical runtime implementation — never a shadow implementation.
2. `prompt` is structured metadata, not arbitrary hidden prose.
3. `policy` is declarative. Enforcement belongs to the runtime/adapter, not to agent cooperation alone.
4. `context` declares the minimum information required for safe execution.
5. `examples` should be deterministic and minimal.
6. The agentic surface has its own descriptive grammar (`discovery`, `context`, `prompt`, `tool`, `mcp`, `rag`, `policy`, `examples`). It does NOT carry execution slots (`_repository`, `_service`, `_composition`).
7. When domain derivation is used, the agentic surface consumes from the domain but never overrides canonical execution paths.

## MCP Exposure

`tool` is the canonical contract for agent execution. `mcp` is an optional exposure configuration for MCP publication.

Fallback rules (normative — adapters must follow):

| Field | Resolution |
| --- | --- |
| `name` | `mcp.name` if provided, otherwise `tool.name` |
| `description` | `mcp.description` if provided, otherwise `tool.description` |
| `title` | `mcp.title` if provided, otherwise adapter may derive from `tool.name` |
| `inputSchema` | Always from `tool` |
| `outputSchema` | Always from `tool` |
| `execute` | Always delegates to `tool.execute()` |

`mcp` controls presence and presentation. It never redefines schemas or execution paths.

## Execution Policy

`executionMode` is a declarative execution policy defined by the Case:

| Mode | Semantics |
| --- | --- |
| `suggest-only` | May be suggested or prepared, but execution must not proceed automatically |
| `manual-approval` | Requires explicit approval before proceeding |
| `direct-execution` | May proceed without additional approval, subject to other policies |

Policy precedence: when multiple policy fields apply, the more restrictive interpretation prevails.

## RAG Contract

The RAG contract operates in two layers:

1. **Semantic layer** — `topics`, `hints`, `scope`, `mode`: defines retrieval intent.
2. **Reference layer** — `resources` with `kind` + `ref`: concrete references to APP-native or project-native artifacts.

APP does not define a RAG engine, retrieval mechanism, ranking, embedding, or search pipeline. Those responsibilities belong to the runtime.

Recognized resource kinds: `"case"` (reference to another Case) and `"file"` (reference to a project file). New kinds may be standardized only after reference implementations demonstrate stable semantics.
