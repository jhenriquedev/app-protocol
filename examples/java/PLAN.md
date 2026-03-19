# Development Plan — Java Task Board

## Product scope

Recreate the same functional project implemented in `examples/react/`:

- create task cards
- list cards in `todo`, `doing`, and `done`
- move cards across columns
- expose the same board capabilities through an HTTP agent catalog
- expose the same board capabilities through MCP stdio and remote MCP HTTP
- persist tasks locally in `packages/data/tasks.json`
- preserve state across backend and agent restarts

## Architectural decisions

| Decision | Choice |
| --- | --- |
| APP topology | `packages/ -> core/ -> cases/ -> apps/` |
| Language | Java 17 (matches available local toolchain for validation) |
| Build tool | Maven wrapper |
| Backend host | JDK `HttpServer` |
| Portal host | JDK `HttpServer` with server-rendered HTML |
| Agent host | JDK `HttpServer` + MCP stdio + remote MCP HTTP |
| Persistence | local JSON file via `packages/data` |
| UI package | HTML/CSS component helpers in `packages/design_system` |
| JSON | Jackson |
| Implemented surfaces | `domain`, `api`, `ui`, `agentic` |
| Out of scope | `stream`, auth, drag-and-drop, labels, comments |

## APP protocol adaptation for Java

- preserve canonical Case naming and folder structure
- preserve semantic APP surfaces and host responsibilities exactly
- adapt only Java file/class naming where the JVM compiler requires it
- keep `ctx.packages` and `ctx.cases` materialized by the host per execution
- keep all cross-case orchestration through registries rather than direct imports

## Planned structure

```text
examples/java/
├── apps/
│   ├── backend/
│   ├── portal/
│   └── agent/
├── cases/
│   └── tasks/
│       ├── task_create/
│       ├── task_list/
│       └── task_move/
├── core/
│   └── shared/
├── packages/
│   ├── data/
│   └── design_system/
└── scripts/
```

## Development phases

### Phase 1. Specify + bootstrap

- create `examples/java/` topology
- create `README.md`
- create `PLAN.md`
- create all `*.us.md`
- create Maven wrapper and root `pom.xml`

Status:

- complete

### Phase 2. Core contracts

- implement `core/shared/` contracts
- implement `BaseDomainCase`
- implement `BaseApiCase`
- implement `BaseUiCase`
- implement `BaseStreamCase`
- implement `BaseAgenticCase`

Status:

- complete

### Phase 3. Packages

- implement `packages/data` with JSON file store, file locking, and atomic writes
- implement `packages/design_system` with reusable HTML/CSS rendering helpers

Status:

- complete

### Phase 4. Cases — domain

- implement `TaskCreateDomainCase`
- implement `TaskListDomainCase`
- implement `TaskMoveDomainCase`
- preserve schemas, invariants, examples, and `test()`

Status:

- complete

### Phase 5. Cases — api

- implement `TaskCreateApiCase`
- implement `TaskListApiCase`
- implement `TaskMoveApiCase`
- preserve routes, status codes, and structured APP errors

Status:

- complete

### Phase 6. Cases — ui

- implement `TaskCreateUiCase`
- implement `TaskListUiCase`
- implement `TaskMoveUiCase`
- preserve create, list, move flows through the portal host

Status:

- complete

### Phase 7. Backend host

- implement `apps/backend/registry`
- implement `apps/backend/app`
- implement `apps/backend/server`
- materialize per-request `ApiContext`

Status:

- complete

### Phase 8. Portal host

- implement `apps/portal/registry`
- implement `apps/portal/app`
- implement `apps/portal/server`
- compose the page shell from registered UI Cases

Status:

- complete

### Phase 9. Cases — agentic

- implement `TaskCreateAgenticCase`
- implement `TaskListAgenticCase`
- implement `TaskMoveAgenticCase`
- preserve prompt, discovery, policy, MCP, and RAG contracts

Status:

- complete

### Phase 10. Agent host

- implement `apps/agent/registry`
- implement `apps/agent/app`
- implement `apps/agent/server`
- implement `apps/agent/mcp_server`
- implement `apps/agent/mcp_stdio`
- implement `apps/agent/mcp_http`

Status:

- complete

### Phase 11. Validation

- implement validation runners in `scripts/`
- compile the project
- validate backend flows
- validate portal rendering flow
- validate HTTP agentic flow
- validate MCP stdio
- validate remote MCP HTTP

Status:

- complete

### Phase 12. Review loop

- reread `/app`
- review APP grammar compliance
- correct drift
- rerun validation until the project is complete

Status:

- complete

## Acceptance criteria

- backend serves `POST /tasks`, `GET /tasks`, and `PATCH /tasks/:taskId/status`
- portal renders the board and supports create/list/move
- agent exposes `/catalog` and `/tools/:name/execute`
- MCP stdio supports `initialize`, `tools/list`, `resources/list`, `resources/read`, and `tools/call`
- remote MCP HTTP works through `/mcp`
- `task_move` requires confirmation in the agent host runtime
- all created APP surfaces expose `test()`
- `ctx.cases` and `ctx.packages` are materialized per execution
- concurrent writes between backend and agent preserve all tasks
