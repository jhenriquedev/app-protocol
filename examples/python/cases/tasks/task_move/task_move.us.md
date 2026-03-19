# US: task_move

## Capability

Move a task to a different status column (todo, doing, or done).

## Context

Part of a task board application with three capabilities: create, list, and move.
This is the only mutation capability after creation. It changes a task's status
and updates `updatedAt`. Supports idempotent moves (same status = no-op success).

Python reference implementation — validates APP protocol in a non-TypeScript host model.

## Input Requirements

- `taskId`: non-empty string (mandatory) — UUID of the task to move
- `targetStatus`: one of `todo`, `doing`, `done` (mandatory)
- No other fields accepted

## Output Requirements

- Complete `Task` record with updated `status` and `updatedAt`
- If the task already has the target status (idempotent move), return the task unchanged
- `createdAt` is never modified

## Validation Rules

- `taskId` must not be empty
- `targetStatus` must be one of the three valid statuses
- Validation is pure — no I/O, no side effects
- Task existence is checked at execution time (NOT in domain validation)

## Business Invariants

- Only valid status values are accepted: `todo`, `doing`, `done`
- `createdAt` is immutable — never changes on move
- `updatedAt` is refreshed on every non-idempotent move
- Idempotent: moving to the same status succeeds without mutation
- Task must exist — `NOT_FOUND` error if task ID is unknown
- Corrupted persisted data returns structured error, never silent coercion

## Surfaces Involved

| Surface | File | Role |
| --- | --- | --- |
| domain | `task_move_domain_case.py` | Schema, validation, invariants (including idempotency), examples |
| api | `task_move_api_case.py` | HTTP handler, route `PATCH /tasks/:taskId/status`, persistence |
| ui | `task_move_ui_case.py` | tkinter move action buttons on task cards |
| agentic | `task_move_agentic_case.py` | Tool contract (mutating), MCP exposure, confirmation required |

## Composition

Atomic — no cross-case dependencies for execution.
Agentic surface declares `task_list.agentic` as a semantic dependency
(agent should ground via task_list when task is ambiguous).

## Integrations

### Backend host (`apps/backend/`)

- Route: `PATCH /tasks/:taskId/status`
- Reads and updates via `packages/data` JsonFileStore
- Response: `200` with updated task, `404` if not found, `400` on validation failure, `500` on corrupted data

### Portal host (`apps/portal/`)

- Move action buttons rendered on each `TaskCard`
- Each button triggers `PATCH` to backend API via `urllib.request`
- On success: triggers task list refresh
- Submission lock prevents double-click

### Agent host (`apps/agent/`)

- Tool: `task_move` — mutating, manual-approval, medium risk
- `requiresConfirmation: True` — agent must confirm before executing
- Without confirmation header: returns `409 CONFIRMATION_REQUIRED`
- With confirmation: executes and returns updated task
- MCP: enabled, name `task_move`, title `Move Task`

### Package integrations

- `packages/data`: JsonFileStore for task read + update (backend + agent)
- `packages/design_system`: tkinter widgets for move buttons (portal)

## Events / Recovery / Policy

- No events emitted
- Policy: `manual-approval`, risk level `medium`
- Confirmation required for agentic execution
- `executionMode`: `manual-approval`

## Validation Scenarios

### Domain

- Empty `taskId` raises `VALIDATION_FAILED`
- Invalid `targetStatus` raises `VALIDATION_FAILED`
- Valid input passes without error
- Schema integrity: `inputSchema()` and `outputSchema()` return valid `AppSchema`

### API

- Valid move returns `success: True` with updated task
- Idempotent move (same status) succeeds without changing `updatedAt`
- Non-existent task returns `success: False` with code `NOT_FOUND`
- Corrupted data returns `success: False` with code `INTERNAL`, not a throw

### UI

- `view()` returns a tkinter `Frame` with move buttons
- Button click triggers `_repository()` call
- Submission lock prevents concurrent moves on same card

### Agentic

- `discovery()`, `context()`, `prompt()`, `tool()` return valid contracts
- `tool.execute()` delegates to `api.handler()` — no shadow logic
- `requiresConfirmation` is `True` in both `tool()` and `policy()`
- `context()` lists `task_list.agentic` as dependency
- Error propagation: `NOT_FOUND` errors surface through tool result

### Integration

- Backend persists move to JSON file; task survives server restart
- Portal moves task via HTTP; board reflects change after refresh
- Agent moves task via tool with confirmation; backend observes the write
- Agent without confirmation receives `CONFIRMATION_REQUIRED` error

## Open Questions

None — capability is fully specified.

## Status

Implemented and validated.
