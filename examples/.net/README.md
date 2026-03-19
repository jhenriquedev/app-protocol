# .NET Example

Status: executable reference

This example recreates the React APP task board reference in .NET and C# while
keeping the same APP topology, capability set, host split, persistence model,
and agentic/MCP semantics.

Scope:

- hosts:
  - `apps/backend`
  - `apps/portal`
  - `apps/agent`
- cases:
  - `tasks/task_create`
  - `tasks/task_list`
  - `tasks/task_move`
- packages:
  - `packages/data`
  - `packages/design_system`
- surfaces:
  - `domain`
  - `api`
  - `ui`
  - `agentic`

Objectives:

- preserve strict APP protocol fidelity in C#
- preserve the same board behavior as `examples/react`
- preserve HTTP, MCP stdio, and remote MCP publication from `apps/agent`
- preserve local JSON durability and cross-host coordination

Requirements:

- .NET SDK `8.0+`

## Runtime defaults

- backend: `http://localhost:3000`
- agent: `http://localhost:3001`
- portal: `http://localhost:3002`
- shared local data file: `packages/data/tasks.json` unless `APP_DOTNET_DATA_DIR` is set

The three hosts should share the same `APP_DOTNET_DATA_DIR` when you want the
portal, backend, and agent to observe the same persisted board state.

Run the full validation flow:

```bash
dotnet build ./app-protocol-example-dotnet.sln
dotnet run --project ./scripts/SmokeRunner/AppProtocol.Example.DotNet.SmokeRunner.csproj
```

Run each host separately:

```bash
APP_DOTNET_DATA_DIR="$(pwd)/.data" API_PORT=3000 dotnet run --no-launch-profile --project ./apps/backend/AppProtocol.Example.DotNet.Apps.Backend.csproj
APP_DOTNET_DATA_DIR="$(pwd)/.data" AGENT_PORT=3001 dotnet run --no-launch-profile --project ./apps/agent/AppProtocol.Example.DotNet.Apps.Agent.csproj
APP_DOTNET_DATA_DIR="$(pwd)/.data" PORTAL_PORT=3002 API_BASE_URL=http://localhost:3000 dotnet run --no-launch-profile --project ./apps/portal/AppProtocol.Example.DotNet.Apps.Portal.csproj
```

Run MCP stdio as a dedicated process:

```bash
APP_DOTNET_DATA_DIR="$(pwd)/.data" dotnet run --no-launch-profile --project ./apps/agent/AppProtocol.Example.DotNet.Apps.Agent.csproj -- stdio
```

Available default URLs:

- portal: `http://localhost:3002`
- backend: `http://localhost:3000`
- agent: `http://localhost:3001`
- backend health: `http://localhost:3000/health`
- backend manifest: `http://localhost:3000/manifest`
- portal health: `http://localhost:3002/health`
- portal manifest: `http://localhost:3002/manifest`
- agent health: `http://localhost:3001/health`
- agent manifest: `http://localhost:3001/manifest`
- agent catalog: `http://localhost:3001/catalog`
- agent remote MCP endpoint: `http://localhost:3001/mcp`

## Usage examples

Create a task through the backend:

```bash
curl -sS http://localhost:3000/tasks \
  -H 'content-type: application/json' \
  -d '{
    "title": "Ship the .NET APP example",
    "description": "Validate parity with examples/react"
  }'
```

List tasks through the backend:

```bash
curl -sS http://localhost:3000/tasks
```

Move a task through the backend:

```bash
curl -sS -X PATCH http://localhost:3000/tasks/<task-id>/status \
  -H 'content-type: application/json' \
  -d '{
    "targetStatus": "doing"
  }'
```

Create a task through the agent HTTP tool catalog:

```bash
curl -sS http://localhost:3001/tools/task_create/execute \
  -H 'content-type: application/json' \
  -d '{
    "input": {
      "title": "Agent-created task",
      "description": "Created through apps/agent"
    }
  }'
```

List tasks through the agent HTTP tool catalog:

```bash
curl -sS http://localhost:3001/tools/task_list/execute \
  -H 'content-type: application/json' \
  -d '{}'
```

Move a task through the agent HTTP tool catalog. This tool requires explicit confirmation:

```bash
curl -sS http://localhost:3001/tools/task_move/execute \
  -H 'content-type: application/json' \
  -d '{
    "input": {
      "taskId": "<task-id>",
      "targetStatus": "done"
    },
    "confirmed": true
  }'
```

Initialize the remote MCP endpoint:

```bash
curl -sS http://localhost:3001/mcp \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
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

Call the MCP `task_list` tool:

```bash
curl -sS http://localhost:3001/mcp \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "task_list",
      "arguments": {}
    }
  }'
```

What is validated:

- backend HTTP create, list, move, persistence, and structured errors
- portal host runtime health, prerendered board output, and canonical UI-case composition
- agent host catalog publication, runtime policy enforcement, and system prompt assembly
- MCP remote HTTP lifecycle: `initialize`, `tools/list`, `resources/list`, `resources/read`, and `tools/call`
- MCP stdio lifecycle: `initialize`, `tools/list`, `resources/list`, `resources/read`, and `tools/call`
- concurrent backend + agent access to the same `packages/data/tasks.json`

APP notes:

- each Case remains self-contained in its own folder
- shared runtime and infrastructure stay in `packages/` and `core/`
- host registration happens in `apps/backend/registry.cs` and `apps/portal/registry.cs`
- `apps/agent/registry.cs` extends the host layer with the formal `AgenticRegistry` contract
- runtime bootstrap happens in `apps/backend/app.cs` and `apps/portal/app.cs`
- agentic runtime bootstrap happens in `apps/agent/app.cs`
- `apps/agent/` publishes the same catalog through HTTP, MCP stdio, and remote MCP HTTP
- `packages/data` coordinates shared access so `apps/backend` and `apps/agent` can operate on the same `tasks.json`
