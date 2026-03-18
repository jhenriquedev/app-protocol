# React + Node Example — Task Board

Status: complete APP example with backend, portal, and agent hosts

This example demonstrates a complete APP setup in `examples/react/` with a React portal, a Node backend, a dedicated `apps/agent` host, local JSON persistence, and three implemented Cases:

- `tasks/task_create`
- `tasks/task_list`
- `tasks/task_move`

## Goal

- demonstrate APP with real `apps/`, `cases/`, `packages/`, and `core/`
- keep the example small enough to read end to end
- persist data locally without external services

## Functional scope

- create task cards
- list cards in `todo`, `doing`, and `done`
- move cards across columns
- expose the same board capabilities through an agentic tool catalog
- expose the same board capabilities through a real MCP server boundary
- persist tasks locally in `packages/data/tasks.json`
- reload state after backend restart

## Fixed decisions

- frontend host: `apps/portal` using React + Vite
- backend host: `apps/backend` using Node.js HTTP
- agent host: `apps/agent` using Node.js HTTP + MCP stdio + remote MCP over HTTP
- persistence: local JSON file via `packages/data`
- shared UI components: `packages/design_system`
- implemented APP surfaces: `domain`, `api`, `ui`, `agentic`
- v1 out of scope: `stream`, auth, drag-and-drop, labels, comments

## Project topology

```text
examples/react/
├── apps/
│   ├── backend/
│   ├── agent/
│   └── portal/
├── cases/
│   └── tasks/
│       ├── task_create/
│       ├── task_list/
│       └── task_move/
├── core/
├── packages/
│   ├── data/
│   └── design_system/
└── scripts/
```

## Requirements

- Node.js `>= 20`
- npm

## Running locally

Install dependencies:

```bash
npm install
```

Run backend, portal, and the HTTP agent host together:

```bash
npm run dev
```

This aggregated `dev` flow already exposes the remote MCP endpoint at
`/mcp` on the agent host. It does not start the MCP `stdio` transport.
MCP `stdio` must run in its own dedicated process because the client needs
direct ownership of the server's stdin/stdout.

Available URLs:

- portal: `http://localhost:5173`
- backend: `http://localhost:3000`
- agent: `http://localhost:3001`
- backend health: `http://localhost:3000/health`
- backend manifest: `http://localhost:3000/manifest`
- agent health: `http://localhost:3001/health`
- agent manifest: `http://localhost:3001/manifest`
- agent catalog: `http://localhost:3001/catalog`
- agent remote MCP endpoint: `http://localhost:3001/mcp`
- MCP stdio entrypoint: `npm run start:agent:mcp`

The agent host now projects the complete `AgenticDefinition` automatically from
the registry. In practice this means:

- `GET /catalog` returns the tool catalog, the host global prompt, and the published semantic resources
- `tools/list` returns concise semantic summaries derived from the Case contracts
- `resources/list` and `resources/read` expose the full semantic payload per tool plus the host system prompt

For web MCP clients, publish the remote MCP endpoint through HTTPS instead of
using the local `http://localhost:3001/mcp` address directly.

You can also run each host separately:

```bash
npm run dev:api
npm run dev:front
npm run dev:agent
```

Run MCP `stdio` separately when connecting a local MCP client:

```bash
npm run dev:agent:mcp
```

## Validation

Typecheck:

```bash
npm run typecheck
```

Build the portal:

```bash
npm run build:portal
```

Run the official smoke test:

```bash
npm run smoke
```

The smoke suite boots the real backend and agent hosts, validates the canonical API flow, validates structured agentic errors and confirmation rules, verifies that shared local persistence survives concurrent backend + agent access, and exercises the MCP stdio transport end-to-end.
It also exercises the remote MCP HTTP endpoint end-to-end.

## APP notes

- each Case remains self-contained in its own folder
- shared runtime and infrastructure stay in `packages/` and `core/`
- host registration happens in `apps/backend/registry.ts` and `apps/portal/registry.ts`
- `apps/agent/registry.ts` extends the host layer with the formal `AgenticRegistry` contract
- runtime bootstrap happens in `apps/backend/app.ts` and `apps/portal/app.ts`
- agentic runtime bootstrap happens in `apps/agent/app.ts`
- portal visual composition happens in `apps/portal/root.tsx`
- `root.tsx` is not a second registry; it consumes the portal registry and composes UI Cases into the page shell
- `apps/agent/` publishes tools from registered `agentic` surfaces and delegates execution to canonical `api` surfaces through `ctx.cases`
- agentic tool execution preserves structured `AppCaseError` codes from canonical `api` surfaces
- `apps/agent/` publishes the same catalog through HTTP, MCP stdio, and remote MCP HTTP
- the host global prompt is assembled automatically from the registered tool prompt fragments
- MCP resources expose the full projected semantic payload for each tool and the host system prompt
- the concrete MCP transport implementations are selected in `_providers.mcpAdapters`
- `packages/data` coordinates shared access so `apps/backend` and `apps/agent` can operate on the same `tasks.json`
