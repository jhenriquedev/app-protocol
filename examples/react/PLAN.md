# Development Plan — React + Node Task Board

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
  - `apps/backend` for Node HTTP execution
  - `apps/portal` for React UI execution
- persistence: local JSON file under `packages/data/`
- v1 surfaces:
  - `domain`
  - `api`
  - `ui`
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
- surfaces: `domain`, `api`, `ui`
- input: `title`, optional `description`
- output: created `Task`

### `tasks/task_list`

- purpose: load tasks for the board
- surfaces: `domain`, `api`, `ui`
- input: no filters in v1
- output: all tasks for rendering

### `tasks/task_move`

- purpose: move a task between board columns
- surfaces: `domain`, `api`, `ui`
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

- provider scaffold completed
- task routes pending

### Phase 3. Portal

- implement shared UI components in `packages/design_system`
- render the board page
- implement the create-task modal
- connect move actions to the backend API
- expose the design system package through portal `_packages`

Status:

- host bootstrap and design-system scaffold completed
- case-driven board flow pending

### Phase 4. Validation

- add `test()` to each created surface
- run a local scenario: create task, list task, move task
- verify persistence across backend restart

## Acceptance criteria

- backend and portal run locally without external services
- created tasks persist to a local file
- board shows the three columns
- new tasks appear in `todo`
- moved tasks appear in the target column
- all created APP surfaces include `test()`
