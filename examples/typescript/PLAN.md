# Development Plan — TypeScript APP Task Studio

## Product scope

Build a task studio with three columns:

- `backlog`
- `active`
- `complete`

Users can:

- create a work item
- load the studio board
- move a work item between columns

## Architectural decisions

- APP topology: `packages/ -> core/ -> cases/ -> apps/`
- hosts:
  - `apps/backend` for canonical HTTP execution
  - `apps/portal` for server-rendered TypeScript UI execution
  - `apps/agent` for agentic catalog, HTTP execution, and MCP publication
- persistence: local JSON file under `packages/data/`
- implemented surfaces:
  - `domain`
  - `api`
  - `ui`
  - `agentic`
- v1 packages:
  - `data`
  - `design_system`

## Acceptance criteria

- backend, portal, and agent run locally without external services
- created items persist to a local JSON file
- the portal renders the three board columns in server-rendered HTML
- agent execution exposes the same capabilities through `/catalog`, MCP stdio,
  and remote MCP HTTP
- the host enforces `requireConfirmation` and `executionMode`
- every touched surface includes `test()`
- every Case includes `<case>.us.md`
