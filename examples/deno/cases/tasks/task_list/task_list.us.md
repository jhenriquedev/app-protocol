# US: task_list

## Capability

As a user, I want to load the board tasks so I can see all cards organized by
column.

## Context

- This Case is atomic.
- It belongs to the `tasks` domain.
- It is used on initial board load and after task mutations.
- The backend reads persisted tasks through `packages/data`.
- The portal groups the returned list into `todo`, `doing`, and `done`.

## Input Requirements

- no filters in v1
- no pagination in v1
- no search in v1

## Output Requirements

The Case returns a flat list of `Task` items.

Expected output rules:

- every returned task must contain `id`, `title`, `status`, `createdAt`, and
  `updatedAt`
- `description` remains optional
- the list is ordered by `createdAt` descending
- the portal is responsible for grouping the list into board columns

## Validation Rules

- the Case only returns tasks with valid status values: `todo`, `doing`, `done`
- corrupted persisted records must not be silently coerced into valid output
- an empty store returns an empty list, not an error

## Business Invariants

- listing tasks does not mutate the store
- task order must be deterministic for the same persisted dataset
- the Case reflects the current persisted source of truth
- `task_list` does not compose with other Cases in v1

## Surfaces Involved

- `task_list.domain.case.ts`
  - defines the output contract for the task collection
  - defines valid status semantics for listed tasks
- `task_list.api.case.ts`
  - exposes `GET /tasks`
  - loads tasks from the local data package
- `task_list.ui.case.ts`
  - drives board loading and refresh behavior
  - maps the returned list to the board presentation model
- `task_list.agentic.case.ts`
  - exposes board listing as a read-only tool for `apps/agent`
  - acts as the grounding capability before ambiguous task mutations

## Composition

- no cross-case composition in v1
- the board refresh flow may call the list endpoint after create or move, but
  the Case itself remains atomic

## Integrations

### Host integrations

- `apps/backend`
  - route: `GET /tasks`
  - context: `ApiContext`
- `apps/portal`
  - entry points: initial board load, refresh after create, refresh after move
  - context: `UiContext`

### Package integrations

- `packages/data`
  - reads the persisted task collection from `tasks.json`
  - provides cross-host file coordination so agent and backend reads do not
    observe partial writes
- `packages/design_system`
  - `TaskBoard`
  - `TaskColumn`
  - `TaskCard`
  - `TaskStatusBadge`
  - `EmptyColumnState`

## Events / recovery / policy

- no `stream` surface in v1
- no retries or dead-letter policy in v1
- `task_list.agentic` is exposed as tool `task_list`
- the same read-only tool is published through HTTP and MCP by `apps/agent`
- agentic execution mode: `direct-execution`
- confirmation is not required because the capability is read-only

## Validation Scenarios

### Domain

1. Given a valid task collection, the domain accepts the output contract.
2. Given a task with invalid status, the domain rejects the output contract.

### API

1. Given an empty local store, `GET /tasks` returns success with an empty list.
2. Given persisted tasks, `GET /tasks` returns success with the full collection
   ordered by `createdAt` descending.
3. Given corrupted persisted data with invalid task shape, the API returns a
   structured internal failure instead of silently masking corruption.

### UI

1. Given the board page loads, the UI requests the task list and renders three
   columns.
2. Given returned tasks in multiple statuses, the UI groups them into `todo`,
   `doing`, and `done`.
3. Given an empty list, the UI renders empty states for all columns.

### Agentic

1. The agentic surface exposes task listing as a read-only tool.
2. Tool execution delegates to `task_list.api` through `ctx.cases`.
3. The agent host can use this capability for grounding before a mutating task
   operation.
4. Structured API failures propagate to the host instead of collapsing into
   generic `500 INTERNAL` responses.
5. MCP `tools/list` and `tools/call` expose the same published capability name
   and canonical execution path as the HTTP host.

### Integration

1. Portal board load -> backend `GET /tasks` -> `packages/data` read -> grouped
   board render.
2. After create or move succeeds, reloading `GET /tasks` reflects the latest
   persisted state.

## Open Questions

- none for v1

## Status

- specified
- implemented and validated
