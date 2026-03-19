# Development Plan — .NET + C# Task Board

## Product scope

Build the same task board demonstrated in `examples/react/`:

- `todo`
- `doing`
- `done`

Users can:

- create a task
- load the board
- move a task between columns

The same capabilities must also be available through the `agent` host and MCP.

## Architectural decisions

- APP topology: `packages/ -> core/ -> cases/ -> apps/`
- target framework: `net8.0`
- hosts:
  - `apps/backend` for ASP.NET Core HTTP execution
  - `apps/portal` for Blazor portal execution
  - `apps/agent` for agentic catalog, HTTP execution, MCP stdio, and remote MCP HTTP
- persistence: local JSON file under `packages/data/`
- implemented surfaces:
  - `domain`
  - `api`
  - `ui`
  - `agentic`
- v1 packages:
  - `data`
  - `design_system`

## Planned cases

### `tasks/task_create`

- purpose: create a new task card
- surfaces: `domain`, `api`, `ui`, `agentic`
- input: `title`, optional `description`
- output: created `Task`

### `tasks/task_list`

- purpose: load tasks for the board
- surfaces: `domain`, `api`, `ui`, `agentic`
- input: no filters in v1
- output: all tasks for rendering

### `tasks/task_move`

- purpose: move a task between board columns
- surfaces: `domain`, `api`, `ui`, `agentic`
- input: `taskId`, `targetStatus`
- output: updated `Task`

## Development phases

### Phase 1. Bootstrap + Core

- scaffold the .NET solution and canonical APP directories
- port `core/` contracts from the executable reference
- preserve APP runtime concepts: `ctx.cases`, `ctx.packages`, structured errors, and full agentic host contracts

### Phase 2. Packages

- implement `packages/data` with atomic JSON persistence and cross-process locking
- implement `packages/design_system` with shared Blazor render fragments/components

### Phase 3. Cases

- create/update `*.us.md`
- implement `domain`, `api`, `ui`, and `agentic` for the three task Cases
- include `TestAsync()` in every surface

### Phase 4. Hosts

- implement `apps/backend` with per-request API context materialization
- implement `apps/portal` with a Blazor board connected to backend APIs
- implement `apps/agent` with HTTP execution, MCP stdio, and remote MCP HTTP from the same runtime

### Phase 5. Validation

- validate structural APP conformance
- run `dotnet build`
- run smoke validation for backend HTTP, agent HTTP, MCP stdio, and remote MCP HTTP
- review drift against `/app` and correct until complete

## Acceptance criteria

- `examples/.net/` reproduces the same observable behavior as `examples/react/`
- backend exposes `GET /health`, `GET /manifest`, `GET /tasks`, `POST /tasks`, and `PATCH /tasks/{taskId}/status`
- portal renders the three columns and supports create + move flows
- agent exposes `GET /catalog`, `POST /tools/{toolName}/execute`, and `POST /mcp`
- MCP stdio supports `initialize`, `tools/list`, `resources/list`, `resources/read`, and `tools/call`
- `task_move` requires confirmation in agentic execution
- concurrent backend + agent writes preserve all persisted tasks
- every touched surface includes `TestAsync()`
