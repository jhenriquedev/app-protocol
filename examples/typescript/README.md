# TypeScript Example — Task Manager with Notifications

Status: functional (scenario + 18 tests passing)

## What this demonstrates

- 2 domains (tasks, notifications), 4 Cases, all 5 surfaces
- Cross-domain composition via `ctx.cases` (stream → notification API)
- Unified `AppRegistry` with `_cases`, `_providers`, `_packages`
- Shared packages via `ctx.packages` (`design-system`, `date-utils`)
- Infrastructure injection via `ctx.db` (in-memory store mounted by the host)
- Per-execution Case instantiation with inherited `correlationId` across composition
- 3 apps: backend (api + stream), portal (ui), chatbot (agentic)
- Registry with `satisfies` pattern for typed `InferCasesMap`
- `test()` on every surface (18 total)

## How to run

```bash
npm install
npx tsx run.ts
```

## Structure

```text
core/           — protocol contracts (copied from src/core/)
packages/       — shared libraries exposed via ctx.packages
cases/
  tasks/        — task_create, task_complete, task_list
  notifications/ — notification_send
apps/
  backend/      — API routes + stream subscriptions
  portal/       — UI views
  chatbot/      — agentic tools + discovery
run.ts          — boots backend, runs scenario, runs all tests
```
