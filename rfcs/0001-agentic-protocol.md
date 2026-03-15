# RFC 0001: Agentic Protocol for APP Cases

Status: Draft

## Summary

This RFC formalizes the **Agentic Protocol** as a canonical surface in the AI-First Programming Protocol (APP).

The Agentic Protocol enables Cases to be **discoverable, understandable, and operable by AI agents** while preserving the APP principle that a Case remains a **self-contained unit of capability**.

The proposal centers on the file:

```text
<case>.agentic.case.ts
```

This surface consolidates structured definitions for discovery, context, prompt guidance, tool exposure, MCP interoperability, retrieval hints, policies, and deterministic examples.

The goal is to let APP systems remain both human-operable and agent-operable without fragmenting architecture into separate AI-only artifacts.

## Motivation

Modern software architectures were designed primarily for human developers and runtime execution, not for AI agents that must reason over codebases and execute capabilities safely.

As AI-assisted development grows, several problems emerge:

- **High context cost**: agents must read many files to understand a single capability.
- **Implicit architecture**: important semantics are scattered across controllers, services, schemas, and docs.
- **Fragmented AI integration**: prompts, tool schemas, and MCP adapters are typically implemented ad hoc and outside the main architecture.
- **Lack of agent discovery**: systems rarely expose explicit descriptions of capabilities that agents can navigate.

APP already organizes systems into **Cases**, which represent self-contained capabilities with predictable surfaces such as `domain`, `api`, `ui`, and `stream`.

However, the protocol still needs a stronger formal definition of how Cases become **operable by AI agents** without introducing shadow architectures or duplicating business logic.

This RFC proposes a canonical **agentic surface** that allows a Case to expose structured semantics for AI interaction while preserving the APP goal of **low context cost through self-contained capability units**.

## Proposal

Introduce or ratify the following canonical Case surface:

```text
<case>.agentic.case.ts
```

This file defines the **Agentic Protocol** for a Case.

The Agentic surface does not implement business logic. Instead, it **describes and exposes the Case capability** in a structured format suitable for AI agents and agent runtimes.

The Agentic surface is canonical but optional. A Case remains valid without it unless a future APP version explicitly requires agentic operability for a given class of Cases or runtime.

### Canonical Structure

Conceptual example:

```ts
export const userValidateAgenticCase = {
  discovery: {
    name: "user_validate",
    description: "Validate a user document and classify its status.",
    tags: ["user", "validation"],
    capabilities: ["validation"],
    aliases: ["validate_user_document"]
  },

  context: {
    requiresAuth: true,
    tenantScoped: true,
    dependencies: ["user_validate.api"]
  },

  prompt: {
    purpose: "Validate a user document and determine its status.",
    whenToUse: [
      "When a document must be verified before creating a user"
    ],
    constraints: [
      "Use only the defined tool for execution",
      "Do not infer validation rules beyond domain logic"
    ]
  },

  tool: {
    name: "user_validate",
    description: "Validate a user document",
    inputSchema: {
      document: "string"
    },
    outputSchema: {
      status: "string",
      reasons: "string[]"
    },
    execute: async (input, ctx) => {
      return ctx.cases.users.user_validate.api.handler(input)
    }
  },

  mcp: {
    tool: "user_validate",
    title: "User Validate",
    description: "Validate user documents via APP Case capability."
  },

  rag: {
    sources: ["validation_rules"],
    hints: [
      "Prefer official document validation sources"
    ]
  },

  policy: {
    requireConfirmation: false,
    rateLimit: "standard"
  },

  examples: [
    {
      input: { document: "123456789" },
      output: { status: "invalid", reasons: ["invalid_format"] }
    }
  ]
}
```

### Agentic Sections

The Agentic Protocol may include the following sections:

| Section | Purpose |
| --- | --- |
| `discovery` | Metadata for capability discovery |
| `context` | Execution requirements and constraints |
| `prompt` | Structured guidance for agent reasoning |
| `tool` | Contract for executable capability |
| `mcp` | Integration adapter for MCP runtimes |
| `rag` | Retrieval hints for contextual knowledge |
| `policy` | Guardrails and operational limits |
| `examples` | Deterministic usage examples |

### Execution Model

The source of truth for execution remains the canonical Case surfaces such as `api` and `stream`.

The `tool` section must reference canonical execution logic and must not duplicate business rules.

### Architectural Rule

The Agentic surface may:

- describe the capability
- expose it for AI interaction
- integrate it with tool ecosystems

The Agentic surface must not:

- re-implement the capability logic
- become a parallel source of truth
- bypass Case policies or canonical execution paths

### Updated Case Structure

```text
cases/
└── users/
    └── user_validate/
        ├── user_validate.domain.case.ts
        ├── user_validate.api.case.ts
        ├── user_validate.ui.case.ts
        ├── user_validate.stream.case.ts
        └── user_validate.agentic.case.ts
```

This preserves the self-contained Case principle while enabling AI interaction.

## Alternatives Considered

### Separate AI Artifacts

An alternative approach is to create independent files such as:

```text
prompt.ts
tool.ts
mcp.ts
skill.ts
```

These artifacts would live outside the Case structure.

This approach was rejected because it:

- breaks Case encapsulation
- increases architectural fragmentation
- increases context cost for agents
- creates multiple sources of truth

### Framework-Specific AI Integrations

Another option is to rely entirely on external frameworks such as:

- LangChain tools
- Semantic Kernel plugins
- OpenAI function definitions

This approach was rejected because it:

- couples the architecture to specific ecosystems
- reduces portability
- hides agent semantics outside the codebase

### Global Agent Registry

Some systems maintain a global registry of capabilities instead of embedding agent semantics inside the Case itself.

This approach was rejected because it:

- separates capability definition from implementation
- introduces synchronization issues
- increases cognitive overhead

Embedding agent semantics directly in the Case better preserves the APP goal of low context cost.

## Drawbacks

Introducing an Agentic surface increases architectural complexity.

Potential drawbacks include:

- an additional file per Case
- the need to maintain structured metadata
- potential duplication between documentation and discovery metadata
- the requirement for discipline when defining prompts and policies

If poorly maintained, the Agentic surface could become outdated relative to actual execution behavior.

Tooling support such as linters or generators may be required to ensure consistency.

## Migration Impact

Existing APP implementations without an Agentic surface remain valid.

Migration path:

1. Existing Cases remain valid.
2. Agentic support can be added incrementally.
3. Systems can adopt the Agentic surface only for Cases intended to be operated by agents.

This RFC is intended to remain compatible with the `v0.0.1` Case model by treating `agentic` as an additive optional surface.

## Open Questions

Several questions remain open for future RFCs:

- Should the Agentic Protocol support versioned prompts?
- Should the tool schema follow a standardized format such as JSON Schema?
- Should Cases automatically register their Agentic metadata in a discovery registry?
- How should RAG sources be defined across multiple Cases?
- Should agentic policies support capability-level authorization models?
- What tooling should validate that `tool.execute` references canonical Case logic?

Future RFCs may also define:

- APP Agent Specification
- APP Skill Specification
- capability graph semantics for Cases
- agent navigation over Case discovery metadata
