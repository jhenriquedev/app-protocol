# Getting Started with APP

This guide is the shortest path to understand APP, install the `/app` skill,
and run the reference implementation.

## Who this is for

- people evaluating APP for the first time
- maintainers who want to install the `/app` skill locally
- contributors who want a concrete starting point before reading the full spec

## What you will do

1. understand what APP is
2. install the `/app` skill
3. validate that the skill is available
4. run the TypeScript example
5. know how to start your own APP project or adopt APP incrementally
6. know where to go next

## What APP is

APP is a protocol for organizing software around self-contained capability units
called `Cases`.

Canonical layers:

```text
packages/ -> core/ -> cases/ -> apps/
```

Key ideas:

- a `Case` owns one capability
- each Case may expose one or more canonical surfaces
- hosts materialize runtime context and make other Cases available through `ctx.cases`
- shared project packages are exposed to Cases through `ctx.packages`

If you want the conceptual overview first, read
[`protocol-overview.md`](./protocol-overview.md).

## Install the `/app` skill

Project-local installation:

```bash
npx @app-protocol/skill-app install all --project .
```

Validate the package:

```bash
npx @app-protocol/skill-app validate
```

What this installs:

- `.codex/skills/app/`
- `.claude/skills/app/`
- `.github/skills/app/`
- `.windsurf/skills/app/`
- `.agents/skills/app/`

If you need more installation modes, read
[`installing-app-skill.md`](./installing-app-skill.md).

## Use the `/app` skill

Once installed, ask the agent to use `/app` when you want it to:

- inspect APP topology
- create or update Cases
- implement or revise surfaces
- validate APP grammar
- review drift between code and the protocol

Examples:

```text
Use /app to inspect this project and explain the current Cases.
```

```text
Use /app to create a new Case for user registration.
```

```text
Create case usuario_criar using /app.
```

```text
Use /app to review whether this API surface is still aligned with the protocol.
```

```text
Validate APP grammar in this repository using /app.
```

If you want the operational details, read [`using-app-skill.md`](./using-app-skill.md).

## Run the TypeScript example

The reference example is the fastest executable APP project in this repository.

Run it:

```bash
npm --prefix examples/typescript ci
npm --prefix examples/typescript run start
```

What it demonstrates:

- backend host bootstrapping
- chatbot host consuming agentic surfaces
- API, UI, stream, and agentic surfaces
- cross-case orchestration through `ctx.cases`
- scenario execution and surface-level tests

If you want the example map, read [`examples.md`](./examples.md).

## Start your own APP project

After the example, pick the path that matches your situation:

- new project: [`create-app-project.md`](./create-app-project.md)
- new host app: [`add-host-app.md`](./add-host-app.md)
- shared project code through `packages/`: [`using-packages.md`](./using-packages.md)
- incremental adoption in an existing codebase: [`migrating-existing-projects.md`](./migrating-existing-projects.md)

## Read next

- [`create-app-project.md`](./create-app-project.md)
- [`add-host-app.md`](./add-host-app.md)
- [`using-packages.md`](./using-packages.md)
- [`migrating-existing-projects.md`](./migrating-existing-projects.md)
- [`installing-app-skill.md`](./installing-app-skill.md)
- [`using-app-skill.md`](./using-app-skill.md)
- [`protocol-overview.md`](./protocol-overview.md)
- [`core-concepts.md`](./core-concepts.md)
- [`spec-guide.md`](./spec-guide.md)
- [`spec.md`](../spec.md)
