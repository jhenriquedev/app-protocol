# US: task_list

## Capability

List all tasks ordered by `createdAt` descending. No filters, no pagination.

## Context

Part of a task board application with three capabilities: create, list, and move.
This capability provides the read view of the board — all tasks in all statuses.
The UI groups tasks into columns (todo, doing, done) for display.

Python reference implementation — validates APP protocol in a non-TypeScript host model.

## Input Requirements

- Empty object `{}` — no filters or parameters accepted
- Any extra keys in input must be rejected

## Output Requirements

- `tasks`: list of `Task` records
- Ordered by `createdAt` descending (newest first)
- Every record must have all required fields: `id`, `title`, `status`, `createdAt`, `updatedAt`
- Corrupted records must not be silently coerced — they must cause a structured failure

## Validation Rules

- Input must not contain any filter keys
- Output validation: every task record must pass structural assertion
- Corrupted data returns structured error, never silent coercion

## Business Invariants

- Read-only — no mutations
- Order is always `createdAt` descending
- All persisted tasks are returned (no filtering, no pagination)
- Corrupted records are never silently dropped or coerced

## Surfaces Involved

| Surface | File | Role |
| --- | --- | --- |
| domain | `task_list_domain_case.py` | Schema, validation, output assertion, examples |
| api | `task_list_api_case.py` | HTTP handler, route `GET /tasks`, read from store |
| ui | `task_list_ui_case.py` | tkinter board with 3 columns grouped by status |
| agentic | `task_list_agentic_case.py` | Tool contract (read-only), MCP exposure |

## Composition

Atomic — no cross-case dependencies. Uses `_service` as execution center.

## Integrations

### Backend host (`apps/backend/`)

- Route: `GET /tasks`
- Reads from `packages/data` JsonFileStore
- Response: `200` with task list on success, `500` on corrupted data

### Portal host (`apps/portal/`)

- tkinter `TaskBoard` widget with 3 columns (todo, doing, done)
- Each column shows `TaskCard` widgets with status badges
- Empty columns show `EmptyColumnState` message
- Loads on startup; refreshes after task creation or move
- `TaskMoveUi` is instantiated per card as action buttons

### Agent host (`apps/agent/`)

- Tool: `task_list` — read-only, direct-execution, low risk, no confirmation
- MCP: enabled, name `task_list`, title `List Tasks`

### Package integrations

- `packages/data`: JsonFileStore for reading tasks (backend + agent)
- `packages/design_system`: tkinter widgets for board display (portal)

## Events / Recovery / Policy

- No events emitted
- Policy: `direct-execution`, risk level `low`
- No confirmation required (read-only operation)

## Validation Scenarios

### Domain

- Empty input passes validation
- Input with filter keys raises `VALIDATION_FAILED`
- Output validation rejects records missing required fields
- Schema integrity: `inputSchema()` and `outputSchema()` return valid `AppSchema`

### API

- Returns all persisted tasks ordered by `createdAt` descending
- Returns empty list when no tasks exist
- Corrupted data returns `success: False` with structured error, not a throw

### UI

- `view()` returns a tkinter `Frame` widget
- Tasks are grouped into 3 columns by status
- Empty columns show placeholder message
- Board refreshes when `refresh_token` changes

### Agentic

- `discovery()`, `context()`, `prompt()`, `tool()` return valid contracts
- `tool.execute()` delegates to `api.handler()` — no shadow logic
- Read-only: `isMutating` is `False`

### Integration

- Backend reads from JSON file; reflects writes from any host
- Portal displays tasks fetched from backend API
- Agent reads tasks via tool; sees writes from backend and portal

## Open Questions

None — capability is fully specified.

## Status

Implemented and validated.
