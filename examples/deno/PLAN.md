# Development Plan — Deno Task Board

## Product scope

Build a small task board with cards and three columns:

- `todo`
- `doing`
- `done`

Users can:

- create a task
- load the board
- move a task between columns

## Architectural decisions

- APP topology: `packages/ -> core/ -> cases/ -> apps/`
- hosts:
  - `apps/backend` for Deno HTTP execution
  - `apps/portal` for React UI execution on Deno + Vite
  - `apps/agent` for agentic catalog and tool execution
- persistence: local JSON file under `packages/data/`
- implemented surfaces:
  - `domain`
  - `api`
  - `ui`
  - `agentic`
- v1 packages:
  - `data`
  - `design_system`

## Planned screens

### 1. Board page

Responsibilities:

- load all tasks on initial render
- render three task columns
- expose create-task entry point
- expose move actions on each card

### 2. Create task modal

Responsibilities:

- capture `title`
- capture optional `description`
- submit to backend
- close and refresh the board on success

## Planned components

- `AppShell`
- `BoardHeader`
- `CreateTaskButton`
- `TaskBoard`
- `TaskColumn`
- `TaskCard`
- `TaskStatusBadge`
- `MoveTaskAction`
- `TaskFormModal`
- `EmptyColumnState`

These components belong in `packages/design_system/` and are exposed by the
portal host through `ctx.packages`.

## Planned domain model

### Task

Fields:

- `id`
- `title`
- `description?`
- `status`
- `createdAt`
- `updatedAt`

Allowed status values:

- `todo`
- `doing`
- `done`

Rules:

- tasks are created with status `todo`
- title is required
- `task_move` accepts only valid statuses

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

### Phase 1. Bootstrap

- copy or adapt the APP TypeScript `core/` contracts from the reference example
- prepare `apps/backend` and `apps/portal`
- scaffold `packages/data`
- scaffold `packages/design_system`

Status:

- completed

### Phase 2. Backend

- implement the local file store provider in `packages/data`
- define HTTP routes for create, list, and move
- materialize per-request API contexts
- expose the persistence package through backend `_packages`

Status:

- completed
- local file store implemented in `packages/data`
- create, list, and move routes mounted in `apps/backend`
- per-request API context materialized in the backend host
- persistence package exposed through backend `_packages`

### Phase 3. Portal

- implement shared UI components in `packages/design_system`
- render the board page
- implement the create-task modal
- connect move actions to the backend API
- expose the design system package through portal `_packages`

Status:

- completed
- host bootstrap implemented in `apps/portal`
- design-system package exposed through portal `_packages`
- board rendering implemented through `task_list.ui`
- create-task flow implemented through `task_create.ui`
- move-task flow implemented through `task_move.ui`

### Phase 4. Validation

- add `test()` to each created surface
- run a local scenario: create task, list task, move task
- verify persistence across backend restart

Status:

- completed
- all implemented surfaces expose `test()`
- `deno task typecheck`, `deno task build:portal`, and `deno task smoke` pass

### Phase 5. Agentic Layer

- add `*.agentic.case.ts` to the three task Cases
- create `apps/agent` with a formal `AgenticRegistry`
- publish the agent catalog and tool execution over HTTP, MCP stdio, and remote
  MCP HTTP
- enforce confirmation and execution mode in the host runtime
- validate the agent host with dedicated HTTP and MCP smoke paths

Status:

- completed
- `task_create`, `task_list`, and `task_move` expose complete `agentic` surfaces
- `apps/agent` exposes `/catalog` and `/tools/:toolName/execute`
- `apps/agent` also exposes a real MCP stdio transport with `initialize`,
  `tools/list`, and `tools/call`
- `apps/agent` exposes a remote MCP HTTP endpoint at `/mcp` using the same
  catalog and canonical execution path
- `deno task smoke` now covers backend and agent flows end-to-end
- agentic execution preserves structured API failures
- shared backend + agent writes are coordinated safely in `packages/data`

## Acceptance criteria

- backend and portal run locally without external services
- created tasks persist to a local file
- board shows the three columns
- new tasks appear in `todo`
- moved tasks appear in the target column
- all created APP surfaces include `test()`
- the same capabilities are discoverable and executable through `apps/agent`
- the same capabilities are discoverable and executable through MCP stdio
- the same capabilities are discoverable and executable through remote MCP HTTP
- agentic failures preserve canonical APP error codes
- shared `tasks.json` access remains valid under concurrent backend + agent
  writes

Status:

- satisfied by the current implementation
