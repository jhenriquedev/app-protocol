# Development Plan — Go Task Board

Status: complete and validated on `2026-03-18`

## Product scope

Recreate the React APP task board reference in Go with the same functional and
agentic behavior:

- create task cards
- list board cards grouped by `todo`, `doing`, and `done`
- move tasks across columns
- expose the same capabilities through `apps/agent`
- expose the same capabilities through MCP stdio and remote MCP HTTP

## Architectural decisions

- APP topology: `packages/ -> core/ -> cases/ -> apps/`
- hosts:
  - `apps/backend` for HTTP execution
  - `apps/portal` for server-rendered Go UI execution
  - `apps/agent` for agentic catalog and tool execution
- persistence: local JSON file under `packages/data`
- shared UI components: `packages/design_system`
- implemented APP surfaces:
  - `domain`
  - `api`
  - `ui`
  - `agentic`

## Implementation phases

### Phase 1. Specification and topology

- create the canonical APP folder layout in `examples/go`
- create `PLAN.md`, `README.md`, and the three `*.us.md` artifacts
- define the Go runtime approach without changing APP semantics

### Phase 2. Protocol core

- implement `core/` surface contracts in Go
- implement `core/shared/` structural, host, infra, and MCP contracts
- define the context and registry model used by the hosts

### Phase 3. Shared packages

- implement `packages/data` with safe JSON persistence and cross-process locking
- implement `packages/design_system` with shared portal rendering helpers

### Phase 4. Cases

- implement `task_create`, `task_list`, and `task_move`
- include `domain`, `api`, `ui`, and `agentic` surfaces for each Case
- include `test()` on every created surface

### Phase 5. Hosts

- implement `apps/backend` with registry and HTTP bootstrap
- implement `apps/portal` with registry and UI bootstrap
- implement `apps/agent` with formal `AgenticRegistry`, HTTP execution, MCP
  stdio, and remote MCP HTTP

### Phase 6. Validation

- implement smoke validation for backend, agentic HTTP, MCP stdio, and remote
  MCP HTTP
- run `go test ./...`
- review the result against the `/app` validation checklist

Completed validations:

- `go test ./...`
- `go run ./scripts/smoke`
- `go run ./scripts/agentic_smoke`
- `go run ./scripts/agent_mcp_http_smoke`
- `go run ./scripts/agent_mcp_smoke`
