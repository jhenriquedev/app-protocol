# RFC 0002: Agent Host and MCP Contracts for APP

Status: Draft

## Summary

This RFC formalizes the app-level contract for agentic APP systems. It introduces
`AgenticRegistry` as the canonical extension of `AppRegistry`, establishes
`apps/agent/` as the formal generic host name for agentic apps, defines the
minimum `app.ts` responsibilities required when an APP host claims agentic
runtime conformance, and closes the gap between Case-level MCP metadata and a
real MCP transport boundary.

## Motivation

APP already formalizes agentic operability at the Case level through
`<case>.agentic.case.ts`. That is enough to describe a capability to an AI
runtime, but it is not enough to make an APP host fully agentic.

Today the protocol leaves several app-level responsibilities implicit:

- how an app discovers and catalogs agentic surfaces
- how external tool names are resolved
- how MCP publication is filtered and normalized
- where the abstract MCP contract belongs
- where the concrete MCP transport implementation belongs
- how local MCP and remote MCP should coexist without creating parallel runtime semantics
- where execution policy is enforced
- what an agentic `app.ts` must do beyond generic host bootstrap
- what the generic host name should be for a non-conversational agent runtime

Without an explicit host-level contract, projects can build incompatible local
agent runtimes while still claiming APP alignment. That weakens conformance,
toolability, and interoperability.

## Proposal

### 1. Canonical generic host name

The formal generic host name for an agentic app becomes:

```text
apps/agent/
```

`chatbot` may still exist as a project-specific specialization when the runtime
is explicitly a conversational product surface, but it is no longer the generic
normative name for an app-level agentic host.

### 2. `AgenticRegistry`

APP keeps `AppRegistry` as the baseline host registry contract.

For hosts that publish agentic capabilities, APP adds `AgenticRegistry` as the
canonical extension interface of `AppRegistry`.

Required methods:

- `listAgenticCases()`
- `getAgenticSurface(ref)`
- `instantiateAgentic(ref, ctx)`
- `buildCatalog(ctx)`
- `resolveTool(toolName, ctx)`
- `listMcpEnabledTools(ctx)`

Normative intent:

- the registry remains the single source of truth for what the host publishes
- `_cases` remains the source of truth for agentic publication
- tool catalogs are derived from registered `agentic` surfaces, not from
  parallel metadata files
- lookup and instantiation happen per execution with fresh context

### 3. Agent host `app.ts` responsibilities

When an APP host claims agentic conformance, its `apps/agent/app.ts` must expose
or clearly implement the following responsibilities:

- `bootstrap(config)`
- `createAgenticContext(parent?)`
- `buildAgentCatalog(parent?)`
- `resolveTool(toolName, parent?)`
- `executeTool(toolName, input, parent?)`
- `initializeMcp(params?, parent?)`
- `listMcpTools(parent?)`
- `callMcpTool(name, input, parent?)`
- `publishMcp()`
- `validateAgenticRuntime()`

Recommended optional methods:

- `buildSystemPrompt(parent?)`
- `startAgentHost()`
- `startMcpTransport()`

These are normative host responsibilities, not a required inheritance model.
APP still does not require a `BaseAgentApp` class.

### 4. MCP provider boundary

APP keeps MCP split in two layers:

- protocol-level MCP contracts may live in `core/shared/`
- concrete MCP transport implementations must be bound in `registry._providers`

When a host exposes more than one MCP transport, the preferred provider shape is
an explicit named binding such as:

- `_providers.mcpAdapters.stdio`
- `_providers.mcpAdapters.http`

This preserves APP semantics:

- `core/shared/` defines structural contracts with cross-project meaning
- `_providers` binds runtime-specific transport code
- `apps/agent/app.ts` bridges host catalog semantics into the chosen transport

APP still does not require a `BaseAgentApp` or a `BaseAgentRegistry`. The only
abstract class proposed here is the MCP adapter abstraction, because transport
binding is runtime-facing but structurally reusable across hosts.

### 5. Runtime rules

Agentic hosts must additionally enforce:

- fresh `AgenticContext` materialization per execution
- unique exposed tool names after MCP fallback resolution
- runtime enforcement of `requireConfirmation` and `executionMode`
- canonical execution delegation through `ctx.cases`
- rejection of tools whose declared semantics cannot be honored by the host
- plain host REST routes do not count as remote MCP publication
- local agentic conformance requires an HTTP boundary plus a local MCP transport such as `stdio`
- remote agentic conformance requires an HTTP boundary plus a remote MCP boundary over a network transport such as Streamable HTTP
- cross-client complete conformance requires HTTP, local MCP, and remote MCP from the same catalog and canonical execution path
- HTTP and MCP publication must derive from the same catalog and canonical execution path
- MCP lifecycle and core operations (`initialize`, `tools/list`, `tools/call`) must be supported by the chosen transport

### 6. Scope

This RFC does not change:

- the canonical Case-level `agentic.case.ts` grammar
- the optional status of `agentic.case.ts` in baseline APP
- host freedom to choose framework, transport, agent SDK, or MCP runtime

It closes only the missing app-level agentic contract.

## Alternatives Considered

### Keep app-level agentic behavior implicit

Rejected because it leaves incompatible agent hosts free to invent local
contracts while still claiming protocol alignment.

### Keep `chatbot` as the generic host name

Rejected because it conflates conversational UX with the broader concept of an
agentic runtime. APP needs a generic host name that also fits MCP servers,
workflow agents, capability gateways, and non-chat agent runtimes.

### Introduce a mandatory `BaseAgentApp` class

Rejected because APP defines host responsibilities structurally, not through a
single inheritance model. Different runtimes may implement the same semantics
without sharing boot code or class hierarchies.

### Put concrete MCP transport code in `core/shared/`

Rejected because it would violate APP layer semantics. `core/shared/` may define
the abstract MCP contract, but concrete stdio/HTTP/SSE transport code is a host
runtime concern and must be selected in `_providers`.

### Put host-level agent metadata in external adapter files

Rejected because it recreates the same fragmentation that `agentic.case.ts`
already solved at the Case level. The host should derive publication from the
registry and registered surfaces.

## Drawbacks

- the spec gains more host-level detail
- conformance tooling must eventually validate more runtime rules
- reference implementations and documentation will need a terminology migration
  from `chatbot` to `agent` where the intent is generic rather than explicitly
  conversational

## Migration Impact

- non-agentic apps are unaffected
- existing `agentic.case.ts` implementations remain valid
- hosts currently named `chatbot` may keep working, but generic documentation
  and future examples should move to `agent`
- future host-contract implementations in `core/shared/` and examples will need
  to add the MCP adapter abstraction, `AgenticRegistry`, and the app-level
  runtime methods described here

## Open Questions

- should baseline APP eventually require `AgenticRegistry` in code for reference
  implementations, or is spec-level formalization enough until the next release
  cycle?
- should APP standardize a canonical catalog entry structural type alongside
  `AgenticRegistry`, or leave catalog shape host-defined as long as resolution
  semantics are preserved?
