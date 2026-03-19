# Development Plan — Flutter + Dart Task Board

## Product scope

Build the same small task board implemented in `examples/react/`, preserving the
same APP semantics and runtime contracts:

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
  - `apps/backend` for Dart HTTP execution
  - `apps/portal` for Flutter UI execution
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

### 2. Create task dialog

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
- `TaskFormDialog`
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

### Phase 1. Specify

- define the APP scope and the exact parity target with `examples/react/`
- create or update the three `*.us.md` artifacts
- record the canonical Flutter/Dart adaptation decisions

Status:

- completed

### Phase 2. Bootstrap

- scaffold the Flutter/Dart package and the APP layer layout
- port the APP `core/` contracts to Dart
- prepare `apps/backend`, `apps/portal`, and `apps/agent`

Status:

- completed

### Phase 3. Shared packages

- implement the local file store provider in `packages/data`
- implement the shared widget library in `packages/design_system`

Status:

- completed

### Phase 4. Cases

- implement `task_create`, `task_list`, and `task_move`
- keep `domain` pure, `api` thin, `ui` self-contained, and `agentic` delegated
- add `test()` to each created surface

Status:

- completed

### Phase 5. Hosts

- materialize per-execution API and agentic contexts
- expose backend HTTP routes
- expose agent HTTP catalog and tool execution
- expose MCP stdio and remote MCP HTTP using the same catalog and execution path
- compose the Flutter portal using the registered UI Cases

Status:

- completed

### Phase 6. Validation

- run `dart format --set-exit-if-changed .`
- run `dart analyze`
- run `flutter analyze`
- run the official smoke scripts for backend, agentic, MCP stdio, and MCP HTTP

Status:

- completed

### Phase 7. Review

- re-read the `/app` skill
- check structural, semantic, and operational conformance
- correct any drift until the example is complete

Status:

- completed

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
- shared `tasks.json` access remains valid under concurrent backend + agent writes
