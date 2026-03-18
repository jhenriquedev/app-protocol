# Using the `/app` Skill

This guide explains what the `/app` skill is for, when to trigger it, and how it behaves.

## What `/app` is

`/app` is the canonical operational profile for APP projects.

It is stricter than baseline APP in some areas:

- it requires `test()` on touched surfaces
- it requires `<case>.us.md` for new Cases, new surfaces, and semantic changes
- it enforces the `inspect -> specify -> create/implement -> validate -> review` workflow

The source of the skill lives in [`../skills/app/`](../skills/app/).

## When to use it

Use `/app` when you want the agent to:

- inspect the topology of an APP project
- explain Cases and surfaces
- create or update a Case
- implement or revise `domain`, `api`, `ui`, `stream`, or `agentic` surfaces
- validate APP grammar
- review structural drift
- maintain `<case>.us.md`

## How to trigger it

Explicit trigger:

```text
Use /app to inspect this repository.
```

Intent-based trigger examples:

```text
Create a new Case for user registration following APP.
```

```text
Review whether this stream surface still follows APP.
```

```text
Update this Case and keep the <case>.us.md aligned.
```

## Expected workflow

The `/app` skill works in this order:

```text
inspect -> specify -> create/implement -> validate -> review
```

What this means in practice:

1. inspect current topology and constraints
2. create or update `<case>.us.md` when required
3. implement only the surfaces the task needs
4. validate structure, semantics, and runtime-facing rules
5. review drift before task closure

## Operational rules the skill enforces

- `handler()` stays thin
- business logic belongs in `_service()` or `_composition()`
- Cases do not import each other directly
- cross-case orchestration happens through `ctx.cases`
- Cases do not import `packages/` directly; they use `ctx.packages`
- `domain` remains pure
- hosts instantiate Cases per execution, not as global shared runtime instances

## Expected artifacts

The skill may create or update:

- `<case>.domain.case.ts`
- `<case>.api.case.ts`
- `<case>.ui.case.ts`
- `<case>.stream.case.ts`
- `<case>.agentic.case.ts`
- `<case>.us.md`

## What the skill does not change

- baseline APP protocol semantics in `spec.md`
- host-specific infrastructure modeling decisions outside protocol scope
- non-APP projects unless you explicitly ask it to adapt or migrate them

## Examples of good requests

```text
Use /app to inspect the current Cases and explain where composition is happening.
```

```text
Use /app to add an API surface for notifications_send and create the corresponding notifications_send.us.md.
```

```text
Use /app to review whether the host is materializing ctx.cases per request.
```

## Relationship to APP itself

APP is the protocol.
`/app` is the canonical agent workflow for operating inside APP projects.

If you need the protocol concepts first, read:

- [`protocol-overview.md`](./protocol-overview.md)
- [`core-concepts.md`](./core-concepts.md)
- [`../spec.md`](../spec.md)
