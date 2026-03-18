---
name: app
description: >
  Canonical operational skill for the AI-First Programming Protocol (APP).
  Self-sufficient document for agents working against the current protocol version.
  Consolidates grammar, workflow, <case>.us.md support, the /app operational
  profile, and in-document operational memory.
version: 0.0.5-hml
protocol: app@v0.0.5
status: hml
triggers:
  - /app
  - create case
  - implement surface
  - validate project
  - review code
  - inspect structure
---

# /app — Canonical Operational Skill for APP

## §1 Identity

This is the HML version of the canonical `/app` skill.

It operationalizes APP for agents without requiring external files to be read at
runtime. The protocol still exists as a repository artifact, but the agent must
be able to operate using this document alone.

### Scope

- this skill is self-sufficient for agent operation
- it consolidates the current protocol version in operational form
- it may be stricter than baseline APP conformance
- it MUST NOT contradict the canonical grammar of the protocol

### Authority Rule

- for the agent: this document is the operational source of truth
- for project maintenance: future protocol changes must be reflected here
- if the agent detects drift between this document and the current implementation,
  it must report the drift and follow this document's grammar until a human
  corrects it

## §2 `/app` Operational Profile

APP defines the baseline protocol grammar.
`/app` defines a stricter operational profile for agents working on APP projects.

### Baseline Protocol vs `/app` Profile

| Topic | APP baseline | `/app` profile |
|------|--------------|----------------|
| `test()` | strongly recommended | required on every surface created or edited by the agent |
| `<case>.us.md` | optional support artifact | required when creating a Case, adding a surface, or changing semantics |
| workflow | free | inspect → specify → create/implement → validate → review |
| validation | may be partial | must always happen before task closure |
| subagents | outside protocol scope | required when the platform supports them and useful parallel work exists |

### Operational Rules

- the agent must start with `inspect` in unknown contexts
- the agent must keep `handler()` thin and free of business logic
- the agent must create or update `<case>.us.md` when capability semantics change
- the agent must add or update `test()` on every surface it touches
- the agent must validate and review its work before closing the task

## §3 APP Architecture

### Layers

```text
packages/  →  core/  →  cases/  →  apps/
```

### Responsibilities

| Layer | Role |
|--------|------|
| `packages/` | shared libraries and project code exposed by the host through `ctx.packages` |
| `core/` | protocol contracts, base classes, types, and integration interfaces |
| `cases/` | capabilities; all shareable business logic lives here |
| `apps/` | hosts; select Cases, providers, packages, runtime, and deployment model |

### Allowed and Forbidden Imports

| Relationship | Rule |
|--------|------|
| `cases/` → `core/` | allowed |
| `apps/` → `cases/` | allowed through registry |
| `apps/` → `packages/` | allowed |
| `cases/` → `packages/` direct import | forbidden; use `ctx.packages` |
| Case A → Case B through direct import | forbidden; use `ctx.cases` |
| `cases/` → `apps/` | forbidden |

## §4 Case — Canonical Unit

A Case is a cohesive capability organized inside its own folder.

### Rules

- canonical name: `<entity>_<verb>`
- folder: `cases/<domain>/<case>/`
- files: `<case>.<surface>.case.<ext>`
- a Case should be understandable with minimal navigation
- a Case must not mix unrelated capabilities

### Case Support Artifact

The canonical support artifact is:

```text
<case>.us.md
```

It lives inside the Case folder and records the operational specification used by
the skill.

`<case>.us.md` is required in the `/app` profile when:

- a new Case is created
- a new surface is added
- the Case semantics change
- cross-case composition is introduced
- recovery, policy, or agentic contract changes materially

`<case>.us.md` may remain optional when:

- the change is purely editorial
- the change is purely technical and does not alter semantics, contracts, or behavior

## §5 Surfaces — Operational Grammar

Not every Case needs every surface.
Implement only the relevant ones.

### 5.1 domain

**File:** `<case>.domain.case.ts`

**Goal:** pure semantics, invariants, validation, schemas, examples.

**Required in `/app` profile:**

- `caseName()`
- `description()`
- `inputSchema()`
- `outputSchema()`
- `test()`

**Optional:**

- `validate(input)`
- `invariants()`
- `valueObjects()`
- `enums()`
- `examples()`
- `definition()`

**Integration:**

- `domain` is consumed manually by other surfaces
- there is no automatic wiring of `domain.validate()` into `api`, `ui`, or `stream`
- each surface decides explicitly whether and how to consume domain artifacts

**Forbidden:**

- I/O
- HTTP
- persistence
- logging
- rendering
- arbitrary side effects

### 5.2 api

**File:** `<case>.api.case.ts`

**Goal:** backend execution, authorization, orchestration, response.

**Required in `/app` profile:**

- `handler(input)`
- `test()`
- one execution center: `_service(input)` or `_composition(input)`

**Optional:**

- `router()`
- `_validate(input)`
- `_authorize(input)`
- `_repository()`

**Rules:**

- `handler()` receives business input, not raw HTTP requests
- `router()` is transport binding and only delegates
- `_service` and `_composition` are mutually exclusive as the main execution center
- if `_composition` exists, cross-case orchestration happens through `ctx.cases`

### 5.3 ui

**File:** `<case>.ui.case.ts`

**Goal:** self-contained visual unit.

**Required in `/app` profile:**

- `view()`
- `test()`

**Optional:**

- `_viewmodel()`
- `_service()`
- `_repository()`
- `setState(partial)`

**Grammar:**

```text
view ↔ _viewmodel ↔ _service ↔ _repository
```

**Rule:** UI must not perform direct cross-case composition.

### 5.4 stream

**File:** `<case>.stream.case.ts`

**Goal:** event consumption, publication, and declarative recovery.

**Required in `/app` profile:**

- `handler(event)`
- `test()`
- one execution center: `_service(input)` or `_composition(event)`

**Optional:**

- `subscribe()`
- `recoveryPolicy()`
- `_consume(event)`
- `_repository()`
- `_publish(output)`

**Rules:**

- `subscribe()` is a declarative binding
- `recoveryPolicy()` is declarative, deterministic, serializable, and free of I/O
- `_service` and `_composition` are mutually exclusive as the main execution center
- `_publish()` does not replace `subscribe()` or the runtime

### 5.5 agentic

**File:** `<case>.agentic.case.ts`

**Goal:** agent discovery, tool contract, policy, and MCP integration.

**Required in `/app` profile when the surface exists:**

- `discovery()`
- `context()`
- `prompt()`
- `tool()`
- `test()`

**Optional:**

- `mcp()`
- `rag()`
- `policy()`
- `examples()`

**Rules:**

- `tool.execute()` must delegate to the canonical surface
- agentic must not implement shadow business logic
- `mcp()` controls exposure and presentation; it does not redefine execution
- `agentic.case.ts` remains optional in baseline APP

## §6 Composition

### Atomic Case

- uses `_service()`
- concentrates local capability logic
- does not orchestrate other Cases

### Composed Case

- uses `_composition()`
- orchestrates other Cases through `ctx.cases`
- does not import other Cases directly

### Core Rule

`handler()` must never carry business logic.
It delegates to the canonical surface pipeline.

## §7 `<case>.us.md` — Operational Specification Contract

`<case>.us.md` is the agent support artifact for specifying, reviewing, and
validating a capability.

It does not replace `domain.case.ts`.
It documents the operational intent that the agent must preserve.

### Minimum Content

```markdown
# US: <case_name>

## Capability
## Context
## Input Requirements
## Output Requirements
## Validation Rules
## Business Invariants
## Surfaces Involved
## Composition
## Events / recovery / policy
## Validation Scenarios
## Open Questions
## Status
```

### Usage Rules

- create it before implementation when the capability is new or semantically uncertain
- update it whenever semantics, contract, or expected behavior changes
- use it as a final validation checklist
- do not use it as an excuse to duplicate semantics that contradict the domain

### Approval Rule

The agent must ask for human approval before implementation when:

- business-rule questions remain open
- the Case introduces new semantics that are not already explicit
- the work includes an architectural tradeoff with relevant consequences
- the composition depends on Cases that are not yet validated

If the task is clear, localized, and semantically already defined, the agent may:

- create or update `<case>.us.md`
- implement immediately afterward
- present `<case>.us.md` and the implementation result together at closure

## §8 Canonical Skill Workflow

```text
inspect → specify → create/implement → validate → review
```

### 8.1 inspect

**Goal:** understand current topology before acting.

**Minimum output:**

- existing Cases
- surfaces per Case
- relevant apps and registries
- conformance or drift signals

**Invariant:** `inspect` does not modify code.

### 8.2 specify

**Goal:** materialize or update `<case>.us.md`.

**Invariant:** every relevant semantic change must be reflected in `<case>.us.md`.

### 8.3 create

**Goal:** scaffold a new Case or new surface.

**Rules:**

- create `domain` first when the Case is new
- scaffold only surfaces that are actually needed
- include `test()` from the first scaffold
- create `<case>.us.md` together with the Case

### 8.4 implement

**Goal:** write or adjust the surface inside canonical grammar.

**Rules:**

- respect project language and conventions
- do not invent slots outside the grammar
- keep semantics local to the Case
- update `test()` to cover the changed contract

### 8.5 validate

**Goal:** check structural, behavioral, and operational conformance.

**Preferred mode:**

- use automated tooling when it exists

**Required fallback:**

- manual grammar checklist
- `test()` review
- execution of available project validations
- cross-check against `<case>.us.md`

### 8.6 review

**Goal:** review the final result before closing the task.

**Focus:**

- grammar violations
- drift between implementation and `<case>.us.md`
- inconsistencies between surfaces of the same Case
- composition, recovery, or agentic delegation risk

## §9 Validation Rules

### 9.1 Structural

- file names follow `<case>.<surface>.case.<ext>`
- folders follow `cases/<domain>/<case>/`
- forbidden imports do not exist
- `_service` and `_composition` do not compete for the same execution center
- `handler()` delegates
- `domain` remains pure
- every surface created or edited by the agent has `test()`
- `<case>.us.md` exists when required by the `/app` profile

### 9.2 Semantic

- `domain` reflects the correct capability
- `api`, `ui`, `stream`, and `agentic` do not contradict the domain
- declared invariants are enforced at some canonical point
- composition uses `ctx.cases`
- agentic delegates to a canonical surface

### 9.3 Operational

- routes and subscriptions remain declarative
- recovery remains host-compatible
- error contracts remain structured
- the host still materializes `ctx.cases` and `ctx.packages` correctly
- `_cases` exposes constructors, not shared runtime instances
- the host instantiates surfaces per execution with current context, not at global boot
- cross-case composition inherits the current operation context

## §10 `test()` Model in `/app` Profile

In baseline APP, `test()` is strongly recommended.
In `/app`, `test()` is required for every surface the agent creates or edits.

### Rules

- canonical signature: `test(): Promise<void>`
- the Case validates itself
- the test lives inside the surface, not in a mandatory parallel file
- local substitutes and internal data are allowed
- failures must raise by `throw`

### Minimum Expected Phases

**domain**

1. `definition()` integrity
2. `validate()` behavior when present
3. `examples()` consistency when present

**api**

1. availability of `_service` or `_composition`
2. validation/authorization when present
3. integrated execution through `handler()`

**ui**

1. `view()` returns a valid visual unit
2. local slots function
3. the basic integrated flow closes

**stream**

1. `subscribe()` shape when present
2. pipeline slots function
3. `handler()` processes a valid synthetic event

**agentic**

1. definition integrity
2. schema and policy consistency
3. `tool.execute()` delegates and returns the expected shape

## §11 Subagents

### Conditional Rule

If the agent platform supports subagents, delegation, or parallel work:

- the agent must use that capability when independent subtasks exist
- each subagent must operate under this same skill
- decomposition must respect write boundaries and avoid overlap

If the platform does not support it:

- ignore this section
- follow the workflow as a single agent

### When to Use

- multiple independent files
- parallel validation while other implementation advances
- reading and classifying independent contexts

### When Not to Use

- immediate blocking work
- tightly coupled changes in the same file
- small tasks that only increase coordination cost

## §12 Drift, Legacy, and Partial Adoption

Not every project will be 100% aligned with APP.

### Operational Levels

| Level | Interpretation |
|------|----------------|
| `structural-only` | recognizable structure, without explicit APP |
| `partial` | partial APP or APP mixed with local conventions |
| `full` | explicit and consistent APP |

### Rules

- do not force migration unless requested
- respect local conventions when editing legacy code
- create new code in APP when that is compatible with the task
- record relevant drift in this document's dynamic sections

## §13 NEVER Rules

- never import a Case directly from another Case folder
- never place business logic in `handler()`
- never perform I/O in `domain`
- never treat `router()` or `subscribe()` as business slots
- never skip `test()` when creating or editing a surface
- never forget to create or update `<case>.us.md` when semantics change
- never invent grammar outside canonical surfaces
- never use agentic as a shadow implementation

## §14 IF → THEN Rules

| IF... | THEN... |
|-------|---------|
| new capability | create `<case>.us.md` and `domain` first |
| new surface | update `<case>.us.md` before or during implementation |
| technical bug without semantic change | may fix directly, but must still review `test()` |
| contract change | update `<case>.us.md` and `test()` |
| composition doubt | prefer atomic; promote to composed only if necessary |
| platform supports subagents | use them when useful parallelism exists |
| platform does not support subagents | ignore that capability |
| automated tooling does not exist | validate manually with the skill checklist |

## §15 Dynamic Sections Inside the Skill

These sections concentrate operational memory.
They replace `knowledge.md`, `learned.md`, and external state files.

### 15.1 Project Inventory

Update when project topology changes materially.

```markdown
- Last inspection:
- Domains found:
- Cases per domain:
- Host apps:
- Current operational level:
- Structural observations:
```

### 15.2 Conventions and Decisions

Record only what is already stable.

```markdown
- [CONV-001] Confirmed convention.
- [DEC-001] Confirmed decision.
```

### 15.3 Learnings

Record corrections, surprises, and useful patterns.

```markdown
- [LEARN-001] Correction or observed pattern.
```

## §16 Task Closure

Before closing, the agent must confirm:

- APP grammar was preserved
- `<case>.us.md` was created or updated when required
- `test()` was created or updated on touched surfaces
- available validations were executed, or a justified reason was given when they were not
- final review found no remaining inconsistencies
