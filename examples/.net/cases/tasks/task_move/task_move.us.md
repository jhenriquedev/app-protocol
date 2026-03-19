# US: task_move

## Capability

As a user, I want to move a task card between board columns so I can reflect work progress.

## Context

- This Case is atomic.
- It belongs to the `tasks` domain.
- It is triggered from an action exposed on each task card.
- The backend updates the persisted task through `packages/data`.
- The portal refreshes the board after the move completes.
- This .NET implementation must preserve the same semantics already validated in `examples/react/`.

## Input Requirements

- `taskId`: required string
- `targetStatus`: required string with one allowed value

Allowed `targetStatus` values:

- `todo`
- `doing`
- `done`

## Output Requirements

The Case returns the updated `Task`.

Expected output rules:

- `id`, `title`, and `description` remain the same task identity
- `status` reflects the requested target status
- `updatedAt` changes when the status actually changes

Idempotency rule:

- if the requested `targetStatus` is equal to the current task status, the Case returns success with the unchanged task

## Validation Rules

- `taskId` is required
- `targetStatus` must be one of `todo`, `doing`, or `done`
- the task must exist before update

## Business Invariants

- move only changes task status and, when applicable, `updatedAt`
- the task identity does not change
- move does not create new tasks
- move does not compose with other Cases in v1

## Surfaces Involved

- `task_move.domain.case.cs`
- `task_move.api.case.cs`
- `task_move.ui.case.cs`
- `task_move.agentic.case.cs`

## Composition

- no cross-case composition in v1
- board refresh after a successful move is a portal flow concern, not direct Case composition

## Integrations

### Host integrations

- `apps/backend`
  - route: `PATCH /tasks/{taskId}/status`
  - context: `ApiContext`
- `apps/portal`
  - entry point: move action on a task card
  - context: `UiContext`
- `apps/agent`
  - tool: `task_move`
  - canonical execution: `task_move.api`

### Package integrations

- `packages/data`
  - reads the persisted task collection
  - updates the matching task
  - writes the updated collection to `tasks.json`
  - coordinates shared writes across backend and agent
- `packages/design_system`
  - `TaskCard`
  - `TaskStatusBadge`
  - `MoveTaskAction`

## Events / recovery / policy

- no `stream` surface in v1
- no retries or dead-letter policy in v1
- `task_move.agentic` is exposed as tool `task_move`
- the same mutating tool is published through HTTP, MCP stdio, and remote MCP HTTP by `apps/agent`
- agentic execution mode: `manual-approval`
- confirmation is required before mutating task status

## Validation Scenarios

1. Given a valid `taskId` and valid `targetStatus`, the domain accepts the input.
2. Given an invalid `targetStatus`, the domain rejects the input.
3. Given an existing task, moving to another column returns success and persists the new status.
4. Given a nonexistent `taskId`, the API returns a structured `NOT_FOUND` error.
5. Given the portal move action, the backend request updates the board and the refresh flow renders the card in the target column.
6. Tool execution delegates to `task_move.api` through `ctx.cases`.
7. The host runtime rejects execution without confirmation.
8. MCP `tools/call` preserves the same confirmation and structured error semantics as the HTTP agent host.

## Open Questions

- none for v1

## Status

- specified
