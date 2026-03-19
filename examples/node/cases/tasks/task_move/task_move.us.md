# US: task_move

## Capability

As a user, I want to move a task card between board columns so I can reflect work progress.

## Context

- This Case is atomic.
- It belongs to the `tasks` domain.
- It is triggered from an action exposed on each task card.
- The backend updates the persisted task through `packages/data`.
- The Node portal refreshes the board after the move completes.

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

- `task_move.domain.case.ts`
  - defines the move input contract and valid status transitions for v1
- `task_move.api.case.ts`
  - exposes `PATCH /tasks/:taskId/status`
  - loads the target task, applies the update, and persists the result
- `task_move.ui.case.ts`
  - drives the move action from the task card
  - triggers board refresh after success
- `task_move.agentic.case.ts`
  - exposes task movement as a confirmable tool for `apps/agent`
  - delegates execution to `task_move.api`

## Composition

- no cross-case composition in v1
- board refresh after a successful move is a portal flow concern, not direct Case composition

## Integrations

### Host integrations

- `apps/backend`
  - route: `PATCH /tasks/:taskId/status`
  - context: `ApiContext`
- `apps/portal`
  - entry point: server-rendered move action on a task card
  - context: `UiContext`

### Package integrations

- `packages/data`
  - reads the persisted task collection
  - updates the matching task
  - writes the updated collection to `tasks.json`
  - coordinates shared writes across `apps/backend` and `apps/agent`
- `packages/design_system`
  - `TaskCard`
  - `TaskStatusBadge`
  - `MoveTaskAction`

## Events / recovery / policy

- no `stream` surface in v1
- no retries or dead-letter policy in v1
- `task_move.agentic` is exposed as tool `task_move`
- the same mutating tool is published through HTTP and MCP by `apps/agent`
- agentic execution mode: `manual-approval`
- confirmation is required before mutating task status

## Validation Scenarios

### Domain

1. Given a valid `taskId` and valid `targetStatus`, the domain accepts the input.
2. Given an invalid `targetStatus`, the domain rejects the input.

### API

1. Given an existing task in `todo`, moving to `doing` returns success and persists the new status.
2. Given a nonexistent `taskId`, the API returns a structured `NOT_FOUND` error.
3. Given an invalid `targetStatus`, the API returns a structured validation error.
4. Given a request to move a task to its current status, the API returns success with the unchanged task and does not create duplicate records.
5. Given a persisted task record that violates the Case output contract, the API returns failure instead of emitting an invalid `Task` payload.

### UI

1. Given a task card, clicking a move action triggers the backend request.
2. Given a successful move, the board refresh flow renders the card in the target column.
3. Given an API failure, the UI keeps the previous board state and surfaces the failure state.

### Agentic

1. The agentic surface exposes discovery, context, prompt, tool, MCP, and policy metadata.
2. Tool execution delegates to `task_move.api` through `ctx.cases`.
3. The host runtime must reject execution without confirmation.
4. When task identification is ambiguous, the host should ground itself through `task_list` before executing the move.
5. Structured `NOT_FOUND` and validation failures from `task_move.api` propagate through the agent host without being rewritten to generic `500` errors.
6. MCP `tools/call` preserves the same confirmation and structured error semantics as the HTTP agent host.

### Integration

1. Portal move action -> backend `PATCH /tasks/:taskId/status` -> `packages/data` write -> board reload shows the card in the new column.
2. Restarting the backend after a successful move preserves the updated status because persistence is local and durable.

## Open Questions

- none for v1

## Status

- specified
- implemented and validated
