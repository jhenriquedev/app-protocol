# APP Python Example — Development Plan

## Product Scope

Task board application with three columns (todo, doing, done) and three operations
(create, list, move). Validates that APP v1.1.3 remains language-agnostic by
implementing the full protocol in Python with zero external dependencies.

## Architectural Decisions

| Decision | Choice |
| --- | --- |
| Topology | `packages/ → core/ → cases/ → apps/` |
| Hosts | `backend` (HTTP stdlib), `portal` (tkinter), `agent` (HTTP + MCP) |
| Persistence | Local JSON file via `packages/data` JsonFileStore |
| Surfaces per Case | `domain`, `api`, `ui` (tkinter), `agentic` |
| Packages | `data` (JsonFileStore), `design_system` (tkinter widgets) |
| Python version | 3.12+ |
| External dependencies | None — stdlib only |
| Async model | Sync (proves APP doesn't mandate async) |
| Type checker | pyright strict |

## Domain Model

```text
Task:
  id:         str (UUID v4)
  title:      str (non-empty)
  status:     "todo" | "doing" | "done"
  created_at: str (ISO 8601)
  updated_at: str (ISO 8601)
```

## Cases

| Case | Domain | API | UI | Agentic |
| --- | --- | --- | --- | --- |
| `task_create` | validate title, reject forbidden fields | `POST /tasks` → 201 | tkinter form dialog | direct-execution, low risk |
| `task_list` | validate empty input, assert output | `GET /tasks` → 200 | tkinter board with 3 columns | read-only, low risk |
| `task_move` | validate taskId + targetStatus | `PATCH /tasks/:taskId/status` → 200 | tkinter move buttons | manual-approval, confirmation required |

## Development Phases

### Phase 1: Bootstrap + Core

- [x] Directory structure
- [x] `pyproject.toml`
- [x] All `__init__.py` files
- [x] `core/shared/` contracts (5 files)
- [x] `core/` base classes (5 files)

### Phase 2: Packages

- [x] `packages/data/` — JsonFileStore with file locking
- [x] `packages/design_system/` — tkinter widget library

### Phase 3: Cases — Domain

- [x] `task_create.us.md`
- [x] `task_list.us.md`
- [x] `task_move.us.md`
- [x] `task_create_domain_case.py`
- [x] `task_list_domain_case.py`
- [x] `task_move_domain_case.py`

### Phase 4: Cases — API

- [x] `task_create_api_case.py`
- [x] `task_list_api_case.py`
- [x] `task_move_api_case.py`

### Phase 5: Cases — UI (tkinter)

- [x] `task_create_ui_case.py`
- [x] `task_list_ui_case.py`
- [x] `task_move_ui_case.py`

### Phase 6: Backend Host

- [x] `apps/backend/registry.py`
- [x] `apps/backend/app.py`
- [x] `apps/backend/server.py`

### Phase 7: Portal Host (tkinter)

- [x] `apps/portal/registry.py`
- [x] `apps/portal/app.py`
- [x] `apps/portal/main.py`

### Phase 8: Cases — Agentic

- [x] `task_create_agentic_case.py`
- [x] `task_list_agentic_case.py`
- [x] `task_move_agentic_case.py`

### Phase 9: Agent Host + MCP

- [x] `apps/agent/registry.py`
- [x] `apps/agent/app.py`
- [x] `apps/agent/server.py`
- [x] `apps/agent/mcp_server.py`
- [x] `apps/agent/mcp_stdio.py`
- [x] `apps/agent/mcp_http.py`

### Phase 10: Validation + Documentation

- [x] `__main__.py` — test runner
- [ ] `README.md`

## Acceptance Criteria

- [ ] `pyright --strict` passes with zero errors
- [ ] `python __main__.py` runs all `test()` + `validate_runtime()` successfully
- [ ] Backend serves `POST /tasks`, `GET /tasks`, `PATCH /tasks/:taskId/status`
- [ ] Portal renders tkinter task board connected to backend
- [ ] Agent exposes 3 tools via `/catalog` and `/tools/:name/execute`
- [ ] MCP stdio transport works (`initialize`, `tools/list`, `resources/list`, `tools/call`)
- [ ] MCP HTTP transport works via `POST /mcp`
- [ ] `task_move` requires confirmation in agentic context
- [ ] Concurrent writes from multiple hosts preserve all data (shared JsonFileStore)
