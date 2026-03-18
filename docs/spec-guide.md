# How to Read the APP Spec

This guide explains how the active documentation is divided and where the normative source of truth lives.

## Source of truth

The normative source of truth for APP is:

- [`../spec.md`](../spec.md)

Released snapshots live in:

- [`../versions/`](../versions/)

## What the spec contains

`spec.md` defines:

- protocol purpose and scope
- paradigm relationship
- canonical layers
- Case grammar
- surface contracts
- runtime expectations
- conformance model
- non-goals
- open work

## What the spec does not try to be

The spec is not:

- a tutorial
- a quickstart
- a host-specific installation guide
- a complete skill manual

Those belong in the supporting documentation under `docs/`.

## How the documentation set is divided

Use these pages by intent:

- [`getting-started.md`](./getting-started.md): shortest practical path
- [`create-app-project.md`](./create-app-project.md): bootstrap a new APP project
- [`add-host-app.md`](./add-host-app.md): add a new host app and wire `app.ts` + `registry.ts`
- [`using-packages.md`](./using-packages.md): introduce and expose shared project packages correctly
- [`migrating-existing-projects.md`](./migrating-existing-projects.md): adopt APP incrementally inside an existing codebase
- [`installing-app-skill.md`](./installing-app-skill.md): install the `/app` skill
- [`using-app-skill.md`](./using-app-skill.md): operate the canonical skill
- [`protocol-overview.md`](./protocol-overview.md): conceptual introduction
- [`core-concepts.md`](./core-concepts.md): protocol mechanics in compressed form
- [`publishing.md`](./publishing.md): release and publishing flow

## How to read the spec efficiently

Suggested order:

1. `README.md`
2. [`protocol-overview.md`](./protocol-overview.md)
3. [`core-concepts.md`](./core-concepts.md)
4. [`../spec.md`](../spec.md)
5. [`../versions/`](../versions/)

If you are using the skill rather than evolving the protocol:

1. [`getting-started.md`](./getting-started.md)
2. [`create-app-project.md`](./create-app-project.md) or [`migrating-existing-projects.md`](./migrating-existing-projects.md)
3. [`add-host-app.md`](./add-host-app.md) and [`using-packages.md`](./using-packages.md) when the task is structural
4. [`installing-app-skill.md`](./installing-app-skill.md)
5. [`using-app-skill.md`](./using-app-skill.md)

## Working draft vs released versions

- `spec.md` is the living draft
- files in `versions/` are released snapshots
- new clarifications should land in `spec.md` first
- released snapshots should not be rewritten unless there is a strong editorial reason

## Operational profiles

APP allows operational profiles that are stricter than baseline protocol conformance.

The main example in this repository is:

- `/app`, documented in [`skill_v5.md`](./skill_v5.md) and packaged through [`../skills/app/`](../skills/app/)

That profile does not replace the protocol.
It operationalizes it for agent workflows.
