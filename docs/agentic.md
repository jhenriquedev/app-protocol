# Agentic Surface

The `agentic.case.ts` surface is the main addition introduced in APP `v0.0.2`.

It exists to make a Case discoverable, understandable, and executable by AI agents without breaking the core APP rule that execution must remain tied to the canonical implementation.

## Goals

- expose a Case as a tool
- make agent intent resolution less ambiguous
- define minimum execution context
- attach policy and safety constraints close to the capability
- improve retrieval quality for agentic runtimes

## Proposed Shape

The current shape is conceptual, not frozen:

```ts
export const userValidateAgenticCase = {
  discovery: {},
  context: {},
  prompt: {},
  tool: {},
  mcp: {},
  rag: {},
  policy: {},
  examples: []
}
```

## Invariants

The following rules should remain stable even if the schema changes:

1. `tool` must map to the canonical runtime implementation.
2. `prompt` should be structured metadata, not arbitrary hidden prose.
3. `policy` must be evaluated before execution.
4. `context` should declare the minimum information required for safe execution.
5. `examples` should be deterministic and minimal.

## Recommended Sections

### discovery

Describes how an agent finds the Case:

- `name`
- `description`
- `aliases`
- `tags`
- `capabilities`
- `category`

### context

Describes execution prerequisites:

- auth requirements
- tenant or workspace scope
- dependencies
- preconditions
- limitations

### prompt

Describes how an agent should reason about the Case:

- goal
- when to use
- when not to use
- required input shape
- expected output shape

### tool

Describes tool exposure:

- canonical name
- description
- input schema
- output schema
- execution mapping

### mcp

Describes how the Case is exported into an MCP-compatible runtime.

### rag

Describes allowed or preferred retrieval sources and semantic hints.

### policy

Describes guardrails:

- confirmation requirements
- scope restrictions
- safety constraints
- rate or cost limits

## Open Questions

- Should `agentic.case.ts` be purely declarative?
- Which schema format should be canonical: TypeScript types, JSON Schema, or both?
- How much of MCP registration belongs in the Case versus in runtime adapters?
- How should conformance be validated automatically?
