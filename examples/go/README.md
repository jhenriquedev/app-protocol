# Go Example

Status: complete APP example with backend, portal, and agent hosts

This example recreates the React APP task board reference in Go while keeping
the same APP topology, capability set, host split, persistence model, and
agentic/MCP semantics.

Implemented Cases:

- `tasks/task_create`
- `tasks/task_list`
- `tasks/task_move`

## Goal

- preserve strict APP protocol fidelity in Go
- preserve the same board behavior as `examples/react`
- preserve HTTP, MCP stdio, and remote MCP publication from `apps/agent`
- preserve local JSON durability and cross-host coordination

## Functional scope

- create task cards
- list cards in `todo`, `doing`, and `done`
- move cards across columns
- expose the same board capabilities through the `apps/agent` catalog
- expose the same board capabilities through MCP stdio and MCP over HTTP
- persist tasks locally in `packages/data/tasks.json`
- reload state after backend restart

## Fixed decisions

- backend host: `apps/backend`
- portal host: `apps/portal`
- agent host: `apps/agent`
- persistence: local JSON file via `packages/data`
- shared UI package: `packages/design_system`
- implemented APP surfaces: `domain`, `api`, `ui`, `agentic`
- out of scope: `stream`, auth, drag-and-drop, labels, comments

## Project topology

```text
examples/go/
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

- Go `1.25`

## Running locally

Run backend, portal, and the HTTP agent host together:

```bash
go run ./scripts/dev
```

Available URLs:

- portal: `http://127.0.0.1:5173`
- backend: `http://127.0.0.1:3000`
- backend health: `http://127.0.0.1:3000/health`
- backend manifest: `http://127.0.0.1:3000/manifest`
- agent: `http://127.0.0.1:3001`
- agent health: `http://127.0.0.1:3001/health`
- agent manifest: `http://127.0.0.1:3001/manifest`
- agent catalog: `http://127.0.0.1:3001/catalog`
- agent remote MCP endpoint: `http://127.0.0.1:3001/mcp`

Run MCP stdio as a dedicated process:

```bash
go run ./scripts/agent_mcp_stdio
```

Like the React reference, MCP stdio is not folded into the aggregated `dev`
runner because the MCP client must own stdin/stdout directly.

## Usage examples

Create a task through the canonical backend API:

```bash
curl -s http://127.0.0.1:3000/tasks \
  -H 'content-type: application/json' \
  -d '{
    "title": "Ship the Go example",
    "description": "Close the APP parity review"
  }'
```

List the current board:

```bash
curl -s http://127.0.0.1:3000/tasks
```

Move a task to `doing`:

```bash
curl -s -X PATCH http://127.0.0.1:3000/tasks/<task-id>/status \
  -H 'content-type: application/json' \
  -d '{
    "targetStatus": "doing"
  }'
```

Inspect the projected agent catalog:

```bash
curl -s http://127.0.0.1:3001/catalog
```

Execute a tool through the HTTP agent host:

```bash
curl -s http://127.0.0.1:3001/tools/task_create/execute \
  -H 'content-type: application/json' \
  -d '{
    "title": "Create through apps/agent"
  }'
```

The HTTP tool response includes both `data` and `meta`:

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "task_123",
      "title": "Create through apps/agent",
      "status": "todo"
    }
  },
  "meta": {
    "toolName": "task_create",
    "requiresConfirmation": false,
    "executionMode": "direct-execution"
  }
}
```

Execute a confirmation-gated tool through the HTTP agent host:

```bash
curl -s http://127.0.0.1:3001/tools/task_move/execute \
  -H 'content-type: application/json' \
  -d '{
    "input": {
      "taskId": "<task-id>",
      "targetStatus": "doing"
    },
    "confirmed": true
  }'
```

Initialize the remote MCP endpoint:

```bash
curl -s http://127.0.0.1:3001/mcp \
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
        "name": "curl-example",
        "version": "1.0.0"
      }
    }
  }'
```

List MCP tools:

```bash
curl -s http://127.0.0.1:3001/mcp \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

Read the assembled host prompt through MCP resources:

```bash
curl -s http://127.0.0.1:3001/mcp \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "resources/read",
    "params": {
      "uri": "app://agent/system/prompt"
    }
  }'
```

Call a tool through remote MCP:

```bash
curl -s http://127.0.0.1:3001/mcp \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "task_create",
      "arguments": {
        "title": "Create through remote MCP"
      }
    }
  }'
```

## Validation

Run the validation suite:

```bash
go test ./...
go run ./scripts/smoke
go run ./scripts/agentic_smoke
go run ./scripts/agent_mcp_http_smoke
go run ./scripts/agent_mcp_smoke
```

What is validated:

- backend HTTP create, list, move, persistence, and restart durability
- portal host rendering plus form-driven task creation
- agent host catalog publication, runtime policy enforcement, and system prompt assembly
- MCP remote HTTP lifecycle: `initialize`, `tools/list`, `resources/list`, `resources/read`, and `tools/call`
- MCP stdio lifecycle: `initialize`, `tools/list`, `resources/list`, `resources/read`, and `tools/call`

## APP notes

- each Case remains self-contained in its own folder under `cases/tasks/`
- shared runtime and contracts live in `core/` and `core/shared/`
- shared project code is exposed through host registries in `packages/`
- `apps/backend` exposes canonical API surfaces through declarative routes
- `apps/portal` composes the board from canonical `ui` Cases rather than bypassing them
- `apps/agent` publishes tools automatically from registered `agentic` surfaces and delegates execution to canonical `api` surfaces through `ctx.cases`
- `apps/agent` enforces `requireConfirmation` and `executionMode` at runtime for both HTTP and MCP publication
- the same catalog, prompt fragments, and semantic resources are exposed consistently through HTTP, MCP stdio, and remote MCP HTTP
