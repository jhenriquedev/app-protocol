# Development Plan — Kotlin Task Board

## Product scope

Build the same task board implemented in `examples/react/`, preserving the same
capabilities, Case names, host roles, APP surfaces, and agentic publication
model.

Users can:

- create a task
- load the board
- move a task between columns

## Architectural decisions

- APP topology: `packages/ -> core/ -> cases/ -> apps/`
- runtimes:
  - `apps/backend` on Kotlin/JVM
  - `apps/agent` on Kotlin/JVM
  - `apps/portal` on Kotlin/JS
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

### Phase 1. Specify

- create the APP topology for `examples/kotlin`
- create `README.md`, `PLAN.md`, and the three `*.us.md` artifacts
- freeze the semantic equivalence target against `examples/react`

Status:

- completed

### Phase 2. Bootstrap

- initialize the Kotlin build and wrapper
- map APP folders into the Kotlin build without losing the canonical topology
- prepare host entrypoints and package folders

Status:

- completed

### Phase 3. Core

- port the APP contracts from `examples/react/core`
- preserve the host registry contracts and MCP abstractions
- keep `core/` free of business logic

Status:

- completed

### Phase 4. Packages

- implement the local file store provider in `packages/data`
- implement shared UI components in `packages/design_system`

Status:

- completed

### Phase 5. Cases

- implement `task_create`, `task_list`, and `task_move`
- keep all Cases atomic in v1
- add `test()` to every created surface
- preserve `ctx.packages` and `ctx.cases` usage rules

Status:

- completed

### Phase 6. Hosts

- implement `apps/backend`
- implement `apps/portal`
- implement `apps/agent` with a complete formal `AgenticRegistry`
- publish HTTP, MCP stdio, and remote MCP HTTP from the same agent runtime

Status:

- completed

### Phase 7. Validation And Review

- add validation flows equivalent to `typecheck`, build, and smoke
- validate APP grammar and runtime semantics
- review against the `/app` skill and correct remaining drift

Status:

- completed
