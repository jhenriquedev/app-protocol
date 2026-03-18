# React + Node Example — Task Board

Status: functional MVP ready

This example demonstrates a complete APP setup in `examples/react/` with a React portal, a Node backend, local JSON persistence, and three implemented Cases:

- `tasks/task_create`
- `tasks/task_list`
- `tasks/task_move`

## Goal

- demonstrate APP with real `apps/`, `cases/`, `packages/`, and `core/`
- keep the example small enough to read end to end
- persist data locally without external services

## Functional scope

- create task cards
- list cards in `todo`, `doing`, and `done`
- move cards across columns
- persist tasks locally in `packages/data/tasks.json`
- reload state after backend restart

## Fixed decisions

- frontend host: `apps/portal` using React + Vite
- backend host: `apps/backend` using Node.js HTTP
- persistence: local JSON file via `packages/data`
- shared UI components: `packages/design_system`
- initial APP surfaces: `domain`, `api`, `ui`
- v1 out of scope: `stream`, `agentic`, auth, drag-and-drop, labels, comments

## Project topology

```text
examples/react/
├── apps/
│   ├── backend/
│   └── portal/
├── cases/
│   └── tasks/
│       ├── task_create/
│       ├── task_list/
│       └── task_move/
├── core/
├── packages/
│   ├── data/
│   └── design_system/
└── scripts/
```

## Requirements

- Node.js `>= 20`
- npm

## Running locally

Install dependencies:

```bash
npm install
```

Run backend and portal together:

```bash
npm run dev
```

Available URLs:

- portal: `http://localhost:5173`
- backend: `http://localhost:3000`
- backend health: `http://localhost:3000/health`
- backend manifest: `http://localhost:3000/manifest`

You can also run each host separately:

```bash
npm run dev:backend
npm run dev:portal
```

## Validation

Typecheck:

```bash
npm run typecheck
```

Build the portal:

```bash
npm run build:portal
```

Run the official smoke test:

```bash
npm run smoke
```

The smoke test boots the real backend, creates a task, moves it, lists it, restarts the backend, and verifies that local persistence survives the restart.

## APP notes

- each Case remains self-contained in its own folder
- shared runtime and infrastructure stay in `packages/` and `core/`
- host wiring happens only through `apps/backend/registry.ts` and `apps/portal/registry.ts`
