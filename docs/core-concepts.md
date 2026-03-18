# APP Core Concepts

This document explains the core mechanics of APP without restating the entire specification.

## Layers and dependency direction

Canonical direction:

```text
packages/ -> core/ -> cases/ -> apps/
```

Practical implications:

- `cases/` may depend on `core/`
- `cases/` must not import `apps/`
- `cases/` must not import other Cases directly
- `cases/` must not import `packages/` directly
- hosts expose other Cases through `ctx.cases`
- hosts expose shared packages through `ctx.packages`

## Cases

A Case is one cohesive capability.

Recommended layout:

```text
cases/<domain>/<case>/
```

Typical files:

- `<case>.domain.case.ts`
- `<case>.api.case.ts`
- `<case>.ui.case.ts`
- `<case>.stream.case.ts`
- `<case>.agentic.case.ts`
- `<case>.us.md`

## Surfaces

### `domain`

Purpose:

- schemas
- examples
- validation semantics
- invariants
- value objects and enums

Critical rule:

- `domain` is pure and manually consumed by other surfaces
- there is no automatic wiring of `domain.validate()`

### `api`

Purpose:

- backend execution
- authorization and transport binding
- orchestration of other Cases when needed

Critical rule:

- `handler()` stays thin
- execution center is `_service()` or `_composition()`

### `ui`

Purpose:

- visual or interaction surface
- local viewmodel/service/repository chain

Critical rule:

- UI should not perform direct cross-case composition

### `stream`

Purpose:

- consume events
- declare `subscribe()`
- declare deterministic `recoveryPolicy()`

Critical rule:

- subscription and recovery remain declarative

### `agentic`

Purpose:

- tool discovery
- prompt and context shaping
- optional MCP/RAG/policy integration

Critical rule:

- `tool.execute()` delegates to a canonical surface
- no business-logic shadow implementation

## `_service()` vs `_composition()`

Atomic Cases:

- use `_service()` for local capability logic

Composed Cases:

- use `_composition()` when orchestrating other Cases through `ctx.cases`

These are mutually exclusive as the main execution center of a surface.

## `ctx.cases`

`ctx.cases` is the canonical composition boundary.

Use it when:

- one Case needs to invoke another Case
- the surface is orchestrating other capabilities

Do not:

- import another Case directly
- instantiate another Case directly inside `cases/`

## `ctx.packages`

`ctx.packages` is how Cases consume host-selected shared project code.

Use it when:

- a Case needs a shared client, helper, or package chosen by the host

Do not:

- import project packages directly from `cases/`

## Host runtime

Hosts own runtime materialization.

Critical rules:

- `_cases` exports constructors
- the host instantiates surfaces per execution with current context
- hosts must not reuse boot-time runtime instances for cross-case execution
- route and subscription definitions remain declarative

## `<case>.us.md`

`<case>.us.md` is a support artifact used by operational profiles such as `/app`.

In baseline APP:

- it is optional

In `/app`:

- it is required for new Cases, new surfaces, and semantic changes

## Recommended next reading

- [`protocol-overview.md`](./protocol-overview.md)
- [`using-app-skill.md`](./using-app-skill.md)
- [`../spec.md`](../spec.md)
