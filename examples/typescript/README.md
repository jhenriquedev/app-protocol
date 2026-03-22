# TypeScript Example — APP Task Studio

Status: complete APP example with `backend`, `portal`, and `agent` hosts.

This example rebuilds the task-board capability in plain TypeScript without
React. It keeps the APP topology explicit inside `examples/typescript/` and
uses server-rendered HTML plus a formal `apps/agent/` runtime with HTTP, MCP
stdio, and remote MCP HTTP publication.

Goal:

- demonstrate APP in 100% TypeScript
- keep the project faithful to `app@v1.1.3` and `/app@1.1.3-prd`
- avoid framework-specific UI dependencies while preserving `ui.case.ts`
- show that the same Cases can power backend, portal, and agent hosts

Implemented capability set:

- `tasks/task_create`
- `tasks/task_list`
- `tasks/task_move`

Run locally:

```bash
npm install
npm run start
```

Validate end to end:

```bash
npm run typecheck
npm run smoke
```
