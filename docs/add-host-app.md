# Add a Host App

This guide explains how to add a new host under `apps/` without confusing protocol role and runtime implementation.

## Core idea

All APP host apps have the same protocol responsibilities:

- bootstrap the runtime
- create per-surface contexts
- declare a `registry.ts`
- select `_cases`, `_providers`, and `_packages`

What changes by host type is the runtime wiring, not the host role.

## Required files

Every host app should provide:

```text
apps/<app>/
├── app.ts
└── registry.ts
```

`registry.ts` declares what the host loads.

`app.ts` turns that declaration into real runtime behavior.

## Canonical host types

Typical examples:

- `backend`
- `portal`
- `agent`
- `worker`
- `lambdas`

`agent` is the canonical generic host name for app-level agentic runtimes.
Names such as `chatbot` may still be used when the host is explicitly a
conversational specialization, but the same APP semantics still apply.

## Step-by-step

### 1. Inspect what the host actually needs

Before creating the app:

- identify which Cases and surfaces it should load
- identify which providers it needs
- identify which shared packages it should expose

Do not copy another host registry blindly.

### 2. Create `registry.ts`

Canonical responsibilities:

- `_cases` imports Case surfaces from `cases/`
- `_providers` binds runtime implementations
- `_packages` imports project shared code from `packages/`

Rules:

- only load the surfaces this host actually needs
- do not register visual surfaces (`ui`, `web`, `mobile`) in a backend-only host unless that host really renders them
- do not expose packages globally by habit; keep host exposure explicit

### 3. Create `app.ts`

`app.ts` is the host bootstrap.

Its responsibilities are always the same:

- consume the registry
- create contexts
- instantiate Cases per execution
- collect declarative bindings such as `router()` or `subscribe()`
- adapt to the runtime

## How host types differ

### `backend`

Typical work:

- collect `router()` bindings
- mount HTTP or RPC handlers
- create API and stream contexts as needed

### `portal`

Typical work:

- mount visual composition
- expose `ui` and/or `web` surfaces depending on the runtime
- expose design or frontend packages
- keep app-specific rendering and navigation inside the host/runtime

### `agent`

Typical work:

- discover agentic surfaces
- expose HTTP and MCP boundaries from the same host catalog
- ensure `tool.execute()` reaches canonical execution
- enforce confirmation and execution policy at runtime
- separate plain host HTTP routes from any remote MCP boundary

When the host is agentic, formalize two things explicitly:

- `registry.ts` should satisfy `AppRegistry` plus the formal `AgenticRegistry` extension
- `registry.ts` should bind the concrete MCP transport adapter in `_providers`
- if more than one MCP transport exists, bind them explicitly as named providers such as `_providers.mcpAdapters.stdio` and `_providers.mcpAdapters.http`
- `app.ts` should expose or clearly implement the runtime responsibilities of an agent host

Required `registry.ts` methods for agentic hosts:

- `listAgenticCases()`
- `getAgenticSurface(ref)`
- `instantiateAgentic(ref, ctx)`
- `buildCatalog(ctx)`
- `resolveTool(toolName, ctx)`
- `listMcpEnabledTools(ctx)`

Required `app.ts` responsibilities for agentic hosts:

- `bootstrap(config)`
- `createAgenticContext(parent?)`
- `buildAgentCatalog(parent?)`
- `buildSystemPrompt(parent?)`
- `resolveTool(toolName, parent?)`
- `executeTool(toolName, input, parent?)`
- `initializeMcp(params?, parent?)`
- `listMcpTools(parent?)`
- `listMcpResources(parent?)`
- `readMcpResource(uri, parent?)`
- `callMcpTool(name, input, parent?)`
- `publishMcp()`
- `validateAgenticRuntime()`

Additional host rules for complete agentic publication:

- project the complete `AgenticDefinition` automatically from `AgenticRegistry`; do not hand-curate semantic fields per tool in the host
- assemble the global host prompt automatically from the registered tool prompt fragments and runtime policy
- expose a concise semantic summary in MCP tool descriptors
- expose the richer semantic projection through MCP resources and/or the host catalog mirror

Recommended optional responsibilities:

- `buildSystemPrompt(parent?)`
- `startAgentHost()`
- `startMcpTransport()`

### `worker`

Typical work:

- consume scheduled jobs, queue records, or background triggers
- dispatch into canonical stream or API flows depending on runtime design

### `lambdas`

Typical work:

- build route tables or subscription maps during cold start
- dispatch by feature or by Case depending on deployment model

## Important rule

Do not assume `apps/backend/app.ts`, `apps/agent/app.ts`, and `apps/portal/app.ts` should look the same.

They share protocol duties, but:

- their runtime adapters differ
- their deployment models differ
- their transport bindings differ

The protocol standardizes the role, not identical boot code.

## Validation checklist

- host folder contains `app.ts` and `registry.ts`
- `registry.ts` uses `_cases`, `_providers`, `_packages`
- only required Cases and surfaces are loaded
- contexts are created per execution, not as global boot-time shared instances
- `ctx.cases` is built from registry constructors
- `apps/agent/` uses the same catalog and execution semantics for HTTP and MCP
- the MCP transport implementation is selected in `_providers`, while protocol-level MCP contracts live in `core/shared/`
- if remote MCP is in scope, the host exposes a dedicated MCP endpoint rather than treating ordinary REST routes as MCP
- `ctx.packages` contains only host-selected packages

Additional checks for `apps/agent/`:

- published tools are derived from registered `agentic` surfaces, not from parallel metadata
- tool names are unique after MCP fallback resolution
- `requireConfirmation` and `executionMode` are enforced by the host/runtime
- `AgenticContext` is created per execution

## Read next

- [`create-app-project.md`](./create-app-project.md)
- [`using-packages.md`](./using-packages.md)
- [`../spec.md`](../spec.md)
