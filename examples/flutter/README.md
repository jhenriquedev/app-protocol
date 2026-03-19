# Flutter + Dart Example — Task Board

Status: complete reference example

This example recreates the complete APP task board reference in
`examples/flutter/` using Flutter for the portal host and Dart for the backend
and agent hosts.

## Goal

- demonstrate APP with real `apps/`, `cases/`, `packages/`, and `core/`
- keep the same functional scope and semantic contracts from `examples/react/`
- validate APP in a Flutter + Dart runtime without deviating from protocol

## Functional scope

- create task cards
- list cards in `todo`, `doing`, and `done`
- move cards across columns
- expose the same board capabilities through an agentic tool catalog
- expose the same board capabilities through a real MCP server boundary
- persist tasks locally in `packages/data/tasks.json`
- reload state after backend restart

## Fixed decisions

- frontend host: `apps/portal` using Flutter
- backend host: `apps/backend` using Dart HTTP
- agent host: `apps/agent` using Dart HTTP + MCP stdio + remote MCP over HTTP
- persistence: local JSON file via `packages/data`
- shared UI components: `packages/design_system`
- implemented APP surfaces: `domain`, `api`, `ui`, `agentic`
- v1 out of scope: `stream`, auth, drag-and-drop, labels, comments

## Project topology

```text
examples/flutter/
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
- each host exposes only the Cases and packages it needs through `registry.dart`
- Cases consume shared project code only through `ctx.packages`
- `apps/agent/` extends the host layer with the formal `AgenticRegistry`
- the host global prompt is assembled automatically from the registered tool prompt fragments
- MCP resources expose the full projected semantic payload for each tool and the host system prompt
- `packages/data` exposes the persisted task store through `packages.data.taskStore`
- `packages/design_system` is consumed by UI Cases through `packages.designSystem`
- the concrete MCP transport implementations are selected in `_providers.mcpAdapters`

## Status

- `specify`: completed
- `create/implement`: completed
- `validate`: completed
- `review`: completed

## Run

Use one shared data directory when you want `backend` and `agent` to observe the
same board state:

```bash
export APP_FLUTTER_DATA_DIR="$(mktemp -d)"
```

Backend host:

```bash
dart run apps/backend/server.dart
```

Portal host:

```bash
flutter run -d chrome -t apps/portal/main.dart
```

Agent host over HTTP:

```bash
dart run apps/agent/server.dart
```

MCP stdio host:

```bash
dart run apps/agent/mcp_server.dart
```

Default ports:

- backend: `http://localhost:3000`
- agent: `http://localhost:3001`
- portal: connects to `http://localhost:3000` by default

Optional environment variables:

- `APP_FLUTTER_DATA_DIR`: overrides the directory that stores `packages/data/tasks.json`
- `API_PORT` or `PORT`: overrides backend port
- `AGENT_PORT` or `PORT`: overrides agent port

## Backend usage

Health and manifest:

```bash
curl -s http://localhost:3000/health | jq
curl -s http://localhost:3000/manifest | jq
```

Create a task:

```bash
curl -s http://localhost:3000/tasks \
  -X POST \
  -H 'content-type: application/json' \
  -d '{
    "title": "Ship the Flutter APP example",
    "description": "Port the React reference without drifting from APP"
  }' | jq
```

List tasks:

```bash
curl -s http://localhost:3000/tasks | jq
```

Move a task:

```bash
curl -s http://localhost:3000/tasks/<task-id>/status \
  -X PATCH \
  -H 'content-type: application/json' \
  -d '{"targetStatus":"doing"}' | jq
```

Successful task routes return the APP envelope:

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "task_...",
      "title": "Ship the Flutter APP example",
      "status": "todo"
    }
  }
}
```

Validation failures keep structured APP errors:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "task.title must be a non-empty string"
  }
}
```

## Agent HTTP usage

Read the published catalog:

```bash
curl -s http://localhost:3001/catalog | jq
```

Execute `task_create`:

```bash
curl -s http://localhost:3001/tools/task_create/execute \
  -X POST \
  -H 'content-type: application/json' \
  -d '{
    "title": "Create through apps/agent",
    "description": "Agent host delegates to the canonical api surface"
  }' | jq
```

Execute `task_list`:

```bash
curl -s http://localhost:3001/tools/task_list/execute \
  -X POST \
  -H 'content-type: application/json' \
  -d '{}' | jq
```

`task_move` requires explicit confirmation. Without confirmation the host
returns `409 CONFIRMATION_REQUIRED`:

```bash
curl -s http://localhost:3001/tools/task_move/execute \
  -X POST \
  -H 'content-type: application/json' \
  -d '{
    "taskId": "<task-id>",
    "targetStatus": "doing"
  }' | jq
```

Confirmed execution:

```bash
curl -s http://localhost:3001/tools/task_move/execute \
  -X POST \
  -H 'content-type: application/json' \
  -d '{
    "input": {
      "taskId": "<task-id>",
      "targetStatus": "doing"
    },
    "confirmed": true
  }' | jq
```

## MCP HTTP usage

Initialize the remote MCP transport:

```bash
curl -s http://localhost:3001/mcp \
  -X POST \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": { "tools": {} },
      "clientInfo": {
        "name": "readme-example",
        "version": "1.0.0"
      }
    }
  }' | jq
```

List tools:

```bash
curl -s http://localhost:3001/mcp \
  -X POST \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }' | jq
```

Read the semantic resource for `task_move`:

```bash
curl -s http://localhost:3001/mcp \
  -X POST \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "resources/read",
    "params": {
      "uri": "app://agent/tools/task_move/semantic"
    }
  }' | jq
```

Call `task_create` through MCP:

```bash
curl -s http://localhost:3001/mcp \
  -X POST \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "task_create",
      "arguments": {
        "title": "Create through MCP"
      }
    }
  }' | jq
```

Call `task_move` through MCP with confirmation:

```bash
curl -s http://localhost:3001/mcp \
  -X POST \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "task_move",
      "arguments": {
        "input": {
          "taskId": "<task-id>",
          "targetStatus": "done"
        },
        "confirmed": true
      }
    }
  }' | jq
```

For the stdio MCP transport, run the dedicated smoke validation:

```bash
dart run scripts/agent_mcp_smoke.dart
```

## Validate

Protocol surface validation:

```bash
flutter test test/protocol_validate_test.dart
```

Static validation:

```bash
dart analyze
flutter analyze
flutter build web -t apps/portal/main.dart
```

Runtime smoke validation:

```bash
dart run scripts/smoke.dart
dart run scripts/agentic_smoke.dart
dart run scripts/agent_mcp_smoke.dart
dart run scripts/agent_mcp_http_smoke.dart
```

## Notes

- `apps/agent/` publishes the same tool catalog through HTTP, MCP stdio, and remote MCP HTTP.
- `packages/data/json_file_store.dart` uses the same lockfile strategy as the React reference to preserve concurrent backend + agent writes.
- `apps/agent/mcp_server.dart` stays separate from aggregate dev flows so stdio remains reserved for MCP traffic.
