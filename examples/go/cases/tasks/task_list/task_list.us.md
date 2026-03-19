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

The Case returns a flat list of `Task` items ordered by `createdAt` descending.

## Validation Rules

- only `todo`, `doing`, and `done` are valid statuses
- corrupted persisted records must not be silently coerced
- an empty store returns an empty list

## Business Invariants

- listing tasks does not mutate the store
- the response order is deterministic for the same persisted dataset
- the Case reflects the persisted source of truth

## Surfaces Involved

- `task_list.domain.case.go`
- `task_list.api.case.go`
- `task_list.ui.case.go`
- `task_list.agentic.case.go`

## Composition

- no cross-case composition in v1

## Events / recovery / policy

- no `stream` surface in v1
- `task_list.agentic` is exposed as tool `task_list`
- the same read-only tool is published through HTTP and MCP by `apps/agent`
- execution mode: `direct-execution`
- confirmation is not required

## Validation Scenarios

1. Empty store returns an empty list.
2. Persisted tasks are returned sorted by `createdAt` descending.
3. Invalid persisted records return structured internal failure.
4. Agentic execution delegates to the canonical API surface.

## Open Questions

- none for v1

## Status

- specified
