# US: task_move

## Capability

As a user, I want to move a task card between board columns so I can reflect
work progress.

## Context

- This Case is atomic.
- It belongs to the `tasks` domain.
- It is triggered from an action exposed on each task card.
- The backend updates the persisted task through `packages/data`.
- The portal refreshes the board after the move completes.

## Input Requirements

- `taskId`: required string
- `targetStatus`: required string

Allowed `targetStatus` values:

- `todo`
- `doing`
- `done`

## Output Requirements

The Case returns the updated `Task`.

Idempotency rule:

- if `targetStatus` already matches the current status, the Case returns
  success with the unchanged task

## Validation Rules

- `taskId` is required
- `targetStatus` must be one of `todo`, `doing`, or `done`
- the task must exist before update

## Business Invariants

- move changes only task status and, when applicable, `updatedAt`
- task identity does not change
- move does not create new tasks

## Surfaces Involved

- `task_move.domain.case.go`
- `task_move.api.case.go`
- `task_move.ui.case.go`
- `task_move.agentic.case.go`

## Composition

- no cross-case composition in v1

## Events / recovery / policy

- no `stream` surface in v1
- `task_move.agentic` is exposed as tool `task_move`
- the same mutating tool is published through HTTP and MCP by `apps/agent`
- execution mode: `manual-approval`
- confirmation is required before execution

## Validation Scenarios

1. Moving an existing task persists the new status.
2. Missing task returns structured `NOT_FOUND`.
3. Invalid target status returns structured validation failure.
4. Idempotent move returns the unchanged task.
5. Agentic execution preserves structured API failures.

## Open Questions

- none for v1

## Status

- specified
