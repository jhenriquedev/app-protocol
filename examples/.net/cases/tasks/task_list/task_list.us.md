# US: task_list

## Capability

As a user, I want to load the board tasks so I can see all cards organized by column.

## Context

- This Case is atomic.
- It belongs to the `tasks` domain.
- It is used on initial board load and after task mutations.
- The backend reads persisted tasks through `packages/data`.
- The portal groups the returned list into `todo`, `doing`, and `done`.
- The portal may provide a host-owned `renderCardActions` callback through `ctx.extra`.
- That callback must receive the current task as an opaque item so the host can compose adjacent UI Cases without importing `task_list` types directly.
- This .NET implementation must preserve the same semantics already validated in `examples/react/`.

## Input Requirements

- no filters in v1
- no pagination in v1
- no search in v1

## Output Requirements

The Case returns a flat list of `Task` items.

Expected output rules:

- every returned task must contain `id`, `title`, `status`, `createdAt`, and `updatedAt`
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

- `task_list.domain.case.cs`
- `task_list.api.case.cs`
- `task_list.ui.case.cs`
- `task_list.agentic.case.cs`

## Composition

- no cross-case composition in v1
- the board refresh flow may call the list endpoint after create or move, but the Case itself remains atomic

## Integrations

### Host integrations

- `apps/backend`
  - route: `GET /tasks`
  - context: `ApiContext`
- `apps/portal`
  - entry points: initial board load, refresh after create, refresh after move
  - context: `UiContext`
  - optional host callback: `ctx.extra.renderCardActions`
- `apps/agent`
  - tool: `task_list`
  - canonical execution: `task_list.api`

### Package integrations

- `packages/data`
  - reads the persisted task collection from `tasks.json`
  - provides cross-host file coordination so agent and backend reads do not observe partial writes
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
- the same read-only tool is published through HTTP, MCP stdio, and remote MCP HTTP by `apps/agent`
- agentic execution mode: `direct-execution`
- confirmation is not required because the capability is read-only

## Validation Scenarios

1. Given a valid task collection, the domain accepts the output contract.
2. Given a task with invalid status, the domain rejects the output contract.
3. Given an empty local store, `GET /tasks` returns success with an empty list.
4. Given persisted tasks, `GET /tasks` returns success with the full collection ordered by `createdAt` descending.
5. Given the board page loads, the UI requests the task list and renders three columns.
6. Tool execution delegates to `task_list.api` through `ctx.cases`.
7. MCP `tools/list` and `tools/call` expose the same published capability name and canonical execution path as the HTTP host.

## Open Questions

- none for v1

## Status

- specified
