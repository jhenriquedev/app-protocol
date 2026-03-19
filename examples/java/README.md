# Java Example — Task Board

Status: complete under `/app`

This example recreates the complete task-board reference from `examples/react/`
in Java while preserving the APP protocol topology:

- `packages/ -> core/ -> cases/ -> apps/`
- three Cases: `tasks/task_create`, `tasks/task_list`, `tasks/task_move`
- three hosts: `apps/backend`, `apps/portal`, `apps/agent`
- local JSON persistence through `packages/data`
- shared UI rendering helpers through `packages/design_system`
- full `agentic` host with HTTP catalog, MCP stdio, and remote MCP HTTP

## APP fidelity notes

- Case folders remain canonical: `cases/<domain>/<case>/`
- host folders remain canonical: `apps/<app>/`
- Java class files use Java-conformant names such as `TaskCreateDomainCase.java`
  instead of the literal TypeScript-style `<case>.<surface>.case.ts`
  filenames, while preserving the same APP surface semantics
- each created surface must expose `test()`
- each new Case keeps its own `<case>.us.md`

## Runtime targets

- backend: `http://localhost:3000`
- portal: `http://localhost:5173`
- agent: `http://localhost:3001`
- agent remote MCP: `http://localhost:3001/mcp`

## Commands

Compile:

- `./mvnw -q compile`

Run hosts:

- backend: `./mvnw -q exec:java -Dexec.mainClass=apps.backend.BackendServer`
- portal: `APP_JAVA_API_BASE_URL=http://localhost:3000 ./mvnw -q exec:java -Dexec.mainClass=apps.portal.PortalServer`
- agent HTTP + remote MCP: `./mvnw -q exec:java -Dexec.mainClass=apps.agent.AgentServer`
- agent MCP stdio: `./mvnw -q exec:java -Dexec.mainClass=apps.agent.AgentMcpServer`

Optional shared data directory:

- `APP_JAVA_DATA_DIR=packages/data`

Validation runners:

- backend smoke: `./mvnw -q exec:java -Dexec.mainClass=scripts.BackendSmoke`
- portal smoke: `./mvnw -q exec:java -Dexec.mainClass=scripts.PortalSmoke`
- agent HTTP smoke: `./mvnw -q exec:java -Dexec.mainClass=scripts.AgenticSmoke`
- agent MCP stdio smoke: `./mvnw -q exec:java -Dexec.mainClass=scripts.AgentMcpStdioSmoke`
- agent MCP HTTP smoke: `./mvnw -q exec:java -Dexec.mainClass=scripts.AgentMcpHttpSmoke`
- full smoke: `./mvnw -q exec:java -Dexec.mainClass=scripts.SmokeAll`

## Development status

- `specify` complete
- `create/implement` complete
- `validate` complete
- `review` complete

## What Is Implemented

- `apps/backend` exposes `GET /health`, `GET /manifest`, `POST /tasks`, `GET /tasks`, and `PATCH /tasks/:taskId/status`
- `apps/portal` renders the board and supports create/list/move through registered UI Cases
- `apps/agent` exposes `GET /catalog`, `POST /tools/:toolName/execute`, and remote MCP HTTP at `/mcp`
- `apps/agent/AgentMcpServer` exposes MCP stdio with `initialize`, `tools/list`, `resources/list`, `resources/read`, and `tools/call`
- `task_move` requires confirmation in both the HTTP agent host and MCP transports
- backend, portal, and agent share the same JSON persistence through `packages/data/tasks.json`

## Validation Summary

- `./mvnw -q compile`
- `./mvnw -q exec:java -Dexec.mainClass=scripts.SmokeAll`
