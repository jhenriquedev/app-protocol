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
- `chatbot`
- `worker`
- `lambdas`

You may use other names if they clearly express a host role, but the same APP semantics still apply.

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
- do not register UI surfaces in a backend-only host unless that host really renders UI
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

- mount UI composition
- expose design or frontend packages
- keep app-specific rendering and navigation inside the host/runtime

### `chatbot`

Typical work:

- discover agentic surfaces
- expose tools or MCP bindings
- ensure `tool.execute()` reaches canonical execution

### `worker`

Typical work:

- consume scheduled jobs, queue records, or background triggers
- dispatch into canonical stream or API flows depending on runtime design

### `lambdas`

Typical work:

- build route tables or subscription maps during cold start
- dispatch by feature or by Case depending on deployment model

## Important rule

Do not assume `apps/backend/app.ts`, `apps/chatbot/app.ts`, and `apps/portal/app.ts` should look the same.

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
- `ctx.packages` contains only host-selected packages

## Read next

- [`create-app-project.md`](./create-app-project.md)
- [`using-packages.md`](./using-packages.md)
- [`../spec.md`](../spec.md)
