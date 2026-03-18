# Using `packages/` in APP

This guide explains when to introduce `packages/`, what belongs there, and how hosts expose packages correctly.

## What `packages/` is for

`packages/` is the shared project code layer.

Use it for code that is:

- shared across multiple Cases or hosts
- project-specific rather than protocol-level
- selected and exposed by hosts

Examples:

- design systems
- shared HTTP clients or wrappers
- project-level SDK adapters
- reusable formatting or date helpers

## What does not belong there

Do not use `packages/` for:

- protocol contracts or canonical contexts
- base surface classes
- business logic that belongs to one Case
- hidden direct dependencies from `cases/`

Those belong in:

- `core/` or `core/shared/` for protocol contracts
- `cases/` for capability-local semantics

## When to introduce `packages/`

Introduce a package when:

- the code is reused across hosts or Cases
- the host should choose whether to expose it
- the code is too project-specific for `core/shared/`

Do not introduce a package just because a utility exists once.

## Canonical flow

1. Create the package under `packages/<name>/`.
2. Import it into `apps/<app>/registry.ts` under `_packages`.
3. Expose it only from the hosts that should provide it.
4. Consume it from contextual surfaces through `ctx.packages`.

## Host-side exposure

The registry is the selection point.

Example shape:

```text
_packages: {
  designSystem,
  dateUtils,
  httpClientLib,
}
```

Rules:

- `_packages` imports only from `packages/`
- each host may expose a different subset
- `ctx.packages` is host-scoped, not global to the whole repo

## Case-side consumption

Contextual surfaces may consume host-selected packages through `ctx.packages`.

Rules:

- do not import from `packages/` directly inside `cases/`
- consume packages explicitly through context
- keep package use visible and host-mediated

## `packages/` vs `core/shared/`

Choose `core/shared/` only when the artifact is a protocol-level contract or structural shape with cross-project meaning.

Choose `packages/` when the artifact is:

- shared by the project
- selected by hosts
- not part of APP grammar itself

## Validation checklist

- the package lives under `packages/`
- hosts expose it through `_packages`
- Cases consume it through `ctx.packages`
- no contextual surface imports it directly
- the package is not carrying capability-specific business semantics that should stay inside a Case

## Read next

- [`create-app-project.md`](./create-app-project.md)
- [`add-host-app.md`](./add-host-app.md)
- [`migrating-existing-projects.md`](./migrating-existing-projects.md)
