# US: task_create

## Capability

Create a new task with a title and initial status `todo`.

## Context

Part of a task board application with three capabilities: create, list, and move.
This is the entry point for new tasks. Every task starts as `todo` and can later
be moved through `doing` and `done` via `task_move`.

Python reference implementation — validates APP protocol in a non-TypeScript host model.

## Input Requirements

- `title`: non-empty string (mandatory)
- No other fields accepted at creation time
- `id`, `status`, `createdAt`, `updatedAt` are system-generated

## Output Requirements

- Complete `Task` record with all fields populated
- `status` must be `todo`
- `id` must be a UUID v4
- `createdAt` and `updatedAt` must be ISO 8601 timestamps
- `createdAt` equals `updatedAt` at creation time

## Validation Rules

- Title must not be blank (empty or whitespace-only)
- Input must not contain `id`, `status`, `createdAt`, or `updatedAt`
- Validation is pure — no I/O, no side effects

## Business Invariants

- Every task starts with status `todo`
- Task IDs are unique (UUID v4)
- Timestamps are always ISO 8601
- `createdAt` is immutable after creation
- Blank titles are rejected before persistence

## Surfaces Involved

| Surface | File | Role |
| --- | --- | --- |
| domain | `task_create_domain_case.py` | Schema, validation, invariants, examples |
| api | `task_create_api_case.py` | HTTP handler, route `POST /tasks`, persistence |
| ui | `task_create_ui_case.py` | tkinter form dialog for task creation |
| agentic | `task_create_agentic_case.py` | Tool contract, MCP exposure, policy |

## Composition

Atomic — no cross-case dependencies. Uses `_service` as execution center.

## Integrations

### Backend host (`apps/backend/`)

- Route: `POST /tasks`
- Persistence: `packages/data` JsonFileStore (JSON file with file locking)
- Response: `201` with created task on success, `400` on validation failure

### Portal host (`apps/portal/`)

- tkinter modal dialog with title input field
- Calls backend API via `urllib.request`
- On success: closes dialog, triggers task list refresh
- On error: displays error feedback in dialog

### Agent host (`apps/agent/`)

- Tool: `task_create` — direct-execution, low risk, no confirmation required
- MCP: enabled, name `task_create`, title `Create Task`

### Package integrations

- `packages/data`: JsonFileStore for task persistence (backend + agent)
- `packages/design_system`: tkinter widgets for form dialog (portal)

## Events / Recovery / Policy

- No events emitted (no stream surface in this example)
- Policy: `direct-execution`, risk level `low`
- No confirmation required

## Validation Scenarios

### Domain

- Blank title raises `VALIDATION_FAILED`
- Input with forbidden fields (`id`, `status`) raises `VALIDATION_FAILED`
- Valid input passes without error
- Schema integrity: `inputSchema()` and `outputSchema()` return valid `AppSchema`

### API

- Valid create returns `success: True` with status `todo` and UUID id
- Concurrent creates produce distinct IDs and all persist
- Blank title returns `success: False` with code `VALIDATION_FAILED`

### UI

- `view()` returns a tkinter `Frame` widget
- Form submission with valid title triggers `_repository()` call
- Form submission with blank title shows error feedback

### Agentic

- `discovery()`, `context()`, `prompt()`, `tool()` return valid contracts
- `tool.execute()` delegates to `api.handler()` — no shadow logic
- Error propagation: domain errors surface through tool result

### Integration

- Backend persists task to JSON file; task survives server restart
- Portal creates task via HTTP; task appears in list after refresh
- Agent creates task via tool; backend observes the write

## Open Questions

None — capability is fully specified.

## Status

Implemented and validated.
