# Kotlin Example — Task Board

Status: complete APP example with backend, portal, and agent hosts

This example recreates the complete APP reference from `examples/react/` in
Kotlin while preserving the same capability scope, Case names, host roles,
agentic semantics, MCP publication model, and local persistence behavior.

Implemented target topology:

- `apps/backend`
- `apps/portal`
- `apps/agent`
- `cases/tasks/task_create`
- `cases/tasks/task_list`
- `cases/tasks/task_move`
- `packages/data`
- `packages/design_system`
- `core/`

## Goal

- recreate the current full APP reference example in Kotlin
- preserve the APP topology `packages/ -> core/ -> cases/ -> apps/`
- preserve the same board capabilities and agentic publication semantics
- keep the example small enough to inspect end to end

## Functional scope

- create task cards
- list cards in `todo`, `doing`, and `done`
- move cards across columns
- expose the same board capabilities through an agentic tool catalog
- expose the same board capabilities through a real MCP server boundary
- persist tasks locally in `packages/data/tasks.json`
- reload state after backend restart

## Fixed decisions

- runtime: Kotlin Multiplatform with JVM hosts and a Kotlin/JS portal
- frontend host: `apps/portal`
- backend host: `apps/backend`
- agent host: `apps/agent`
- persistence: local JSON file via `packages/data`
- shared UI components: `packages/design_system`
- implemented APP surfaces: `domain`, `api`, `ui`, `agentic`
- v1 out of scope: `stream`, auth, drag-and-drop, labels, comments

## Project topology

```text
examples/kotlin/
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

## APP notes

- each Case remains self-contained in its own folder
- shared runtime and infrastructure stay in `packages/` and `core/`
- host registration happens in `apps/backend/registry.kt`, `apps/portal/registry.kt`, and `apps/agent/registry.kt`
- runtime bootstrap happens in `apps/backend/app.kt`, `apps/portal/app.kt`, and `apps/agent/app.kt`
- `apps/portal/root.kt` is not a second registry; it composes UI Cases into the page shell
- `apps/agent/registry.kt` extends the host layer with the formal `AgenticRegistry` contract
- `apps/agent/` publishes the same registry-derived catalog through HTTP, MCP stdio, and remote MCP HTTP
- UI Cases must consume reusable UI components through `ctx.packages`
- `packages/data` must coordinate shared access so `apps/backend` and `apps/agent` can operate on the same `tasks.json`

## Requirements

- JDK `17+`
- Gradle wrapper
- Python `3` for the smoke scripts

## Running locally

Run backend, portal, and the HTTP agent host together:

```bash
bash scripts/dev.sh
```

This aggregated flow exposes the remote MCP endpoint at `/mcp` on the agent
host, but it does not start MCP `stdio`. MCP `stdio` must run in its own
dedicated process because the client needs direct ownership of stdin/stdout.

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
- MCP stdio entrypoint: `./gradlew runAgentMcpServer`

Run each host separately:

```bash
./gradlew runBackendServer
./gradlew runAgentServer
./gradlew runPortalDev
```

Run MCP `stdio` in its own dedicated process:

```bash
./gradlew runAgentMcpServer
```

## Usage examples

List the board through the canonical backend API:

```bash
curl -s http://localhost:3000/tasks
```

Create a task through the canonical backend API:

```bash
curl -s \
  -X POST http://localhost:3000/tasks \
  -H 'content-type: application/json' \
  -d '{
    "title": "Review Kotlin APP example",
    "description": "Validate topology, docs, and agent runtime"
  }'
```

Move a persisted task to `doing`:

```bash
curl -s \
  -X PATCH http://localhost:3000/tasks/<task-id>/status \
  -H 'content-type: application/json' \
  -d '{
    "targetStatus": "doing"
  }'
```

Inspect the agent host semantic catalog:

```bash
curl -s http://localhost:3001/catalog
```

Execute an agentic list through the HTTP agent host:

```bash
curl -s \
  -X POST http://localhost:3001/tools/task_list/execute \
  -H 'content-type: application/json' \
  -d '{}'
```

Execute an agentic move with explicit runtime confirmation:

```bash
curl -s \
  -X POST http://localhost:3001/tools/task_move/execute \
  -H 'content-type: application/json' \
  -d '{
    "input": {
      "taskId": "<task-id>",
      "targetStatus": "done"
    },
    "confirmed": true
  }'
```

Initialize remote MCP over HTTP:

```bash
curl -s \
  -X POST http://localhost:3001/mcp \
  -H 'accept: application/json, text/event-stream' \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {
        "tools": {}
      },
      "clientInfo": {
        "name": "readme-example",
        "version": "1.0.0"
      }
    }
  }'
```

List MCP tools after initialization:

```bash
curl -s \
  -X POST http://localhost:3001/mcp \
  -H 'accept: application/json, text/event-stream' \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

Optional environment variables:

- `APP_KOTLIN_DATA_DIR`
- `API_PORT`
- `AGENT_PORT`
- `PORT`

## Validation

Typecheck both targets:

```bash
./gradlew typecheck
```

Build the portal:

```bash
./gradlew buildPortal
```

Run the official smoke suite:

```bash
python3 scripts/smoke.py
python3 scripts/agentic_smoke.py
python3 scripts/agent_mcp_smoke.py
python3 scripts/agent_mcp_http_smoke.py
```

The validated APP semantics match the active React reference:

- host materialization of `ctx.cases` and `ctx.packages`
- canonical API flow for create, list, and move
- structured APP errors
- complete agentic host semantics
- MCP stdio and remote MCP HTTP parity
- durable shared persistence across backend and agent access
