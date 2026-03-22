# Create a New APP Project

This guide explains how to start a new APP project without overbuilding the repository on day one.

## Goal

End with:

- canonical APP layers in place
- one host app under `apps/`
- one or more Cases under `cases/`
- an empty or intentionally small `packages/` layer
- enough structure to validate APP grammar early

## Minimum viable APP project

The smallest practical APP project has:

```text
project/
├── packages/
├── core/
├── cases/
└── apps/
```

Practical minimum:

- `core/` contains the protocol base classes and shared contracts for your language/runtime
- `cases/` contains at least one real capability
- `apps/` contains at least one host app with `app.ts` and `registry.ts`
- `packages/` may start empty if you do not yet have shared project code to expose

If you are working in TypeScript, start from the executable reference in
[`../examples/typescript/`](../examples/typescript/).

## Recommended bootstrap sequence

1. Create the canonical layer layout.
2. Bring in the current `core/` contracts for your language/runtime.
3. Create the first host app under `apps/<app>/`.
4. Create the first Case under `cases/<domain>/<case>/`.
5. Add only the surfaces you actually need.
6. Validate structure, imports, and host runtime rules.

## 1. Create the layer layout

Recommended initial tree:

```text
project/
├── packages/
├── core/
│   └── shared/
├── cases/
└── apps/
```

Rules:

- do not start by creating many empty host apps
- do not create `packages/` entries before there is real shared project code
- do not add project business logic to `core/`

## 2. Establish `core/`

`core/` is not an app-specific utility folder.

It contains:

- base classes for canonical surfaces
- shared contexts
- structural contracts
- host contracts
- minimal protocol-level infrastructure contracts

For a new project:

- keep `core/` as close as possible to the current APP reference for your language
- prefer adapting from an existing reference implementation over inventing a local grammar
- do not add new canonical surfaces as part of routine bootstrap

## 3. Create the first host app

Every host app needs:

- `apps/<app>/registry.ts`
- `apps/<app>/app.ts`

Start with one host that matches the first delivery need:

- `backend` for server/API execution
- `portal` for a web visual runtime using `ui` and/or `web`
- `agent` for agentic tool hosting
- `worker` for background processing
- `lambdas` for serverless routing or event handling

The host is the composition root. It selects:

- which Cases are visible
- which runtime providers are bound
- which shared packages are exposed

## 4. Create the first Case

Use a real capability, not a placeholder.

Recommended order:

1. create `<case>.us.md` if you are following the `/app` profile
2. create `<case>.domain.case.ts`
3. add only the surfaces actually needed by the task
4. add `test()` to each touched surface

Do not begin by creating every canonical surface automatically.

## 5. Decide whether you need `packages/`

Use `packages/` only when you have shared project code that:

- may be selected differently by different hosts
- should be exposed through `ctx.packages`
- is not protocol-level enough for `core/shared/`

Examples:

- design system
- shared HTTP wrapper
- date utility library
- project-level SDK adapter

If the project does not need any of that yet, leave `packages/` empty.

## 6. Validate early

Before adding more Cases or hosts, confirm:

- the repository follows canonical APP layers
- the first host has both `app.ts` and `registry.ts`
- the registry uses `_cases`, `_providers`, `_packages`
- Cases do not import `packages/` directly
- the first Case stays capability-cohesive

## What not to do

- do not invent a sixth surface during bootstrap
- do not place business logic in `core/`
- do not create a global runtime singleton of Case instances
- do not introduce `packages/` as a hidden dependency path for Cases
- do not scaffold hosts that the project does not need yet

## Read next

- [`add-host-app.md`](./add-host-app.md)
- [`using-packages.md`](./using-packages.md)
- [`migrating-existing-projects.md`](./migrating-existing-projects.md)
- [`../spec.md`](../spec.md)
