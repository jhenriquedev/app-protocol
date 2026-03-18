---
name: app
description: use when inspecting app architecture, creating or updating cases, implementing domain/api/ui/stream/agentic surfaces, maintaining <case>.us.md, validating app grammar, and reviewing structural drift with the canonical /app workflow
---

# /app — Canonical Operational Skill for APP

This is the active PRD revision of the canonical `/app` skill.
It keeps the operational content of the previous revision while reducing repetition
and improving scanability.

## Revision Metadata

- Version: `0.0.10-prd`
- Protocol: `app@v0.0.10`
- Status: `prd`

## What This Skill Does

- inspect an APP project and explain its topology
- create a new Case such as `usuario_criar`
- implement or revise `domain`, `api`, `ui`, `stream`, and `agentic` surfaces
- validate APP grammar and host runtime rules
- detect architectural drift in Cases and hosts
- create or update `<case>.us.md` when semantics, contracts, or composition change

If you do not know APP yet, this skill should guide you through the canonical workflow instead of assuming prior protocol knowledge.

APP is the protocol layer of the AI-First Programming Paradigm.
`/app` is the canonical skill for applying that protocol in real projects.

### Example Prompts

- `Use /app to inspect this repository.`
- `Create case usuario_criar using /app.`
- `Implement the api surface for usuario_criar using /app.`
- `Validate this repository with APP grammar.`
- `Review drift in this project using /app.`
- `Create usuario_criar with domain, api, and usuario_criar.us.md.`

## 1. Identity

### Positioning

- executable workflow for APP engineering
- architecture-aware implementation and review guide
- operational lint for APP grammar and runtime rules

### Scope

- self-sufficient for agent operation
- operationalizes the current APP protocol version
- may be stricter than baseline APP conformance
- must not contradict canonical APP grammar

### Authority

- for the agent: this document is the operational source of truth
- for project maintenance: protocol changes must be reflected here
- if implementation drifts from this document, report the drift and keep
  following this grammar until a human resolves it

## 2. `/app` Profile

APP defines baseline protocol grammar.
`/app` defines a stricter operational profile for agents working on APP projects.

| Topic | APP baseline | `/app` profile |
| --- | --- | --- |
| `test()` | strongly recommended | required on every surface created or edited by the agent |
| `<case>.us.md` | optional support artifact | required for new Cases, new surfaces, and semantic changes |
| workflow | free | `inspect → specify → create/implement → validate → review` |
| validation | may be partial | must happen before task closure |
| subagents | outside protocol scope | required when supported and parallel work is useful |

### Core Rules

- start unknown work with `inspect`
- keep `handler()` thin and free of business logic
- create or update `<case>.us.md` when semantics change
- add or update `test()` on every touched surface
- validate and review before closing the task

## 3. APP Model

### Canonical Layers

```text
packages/ → core/ → cases/ → apps/
```

| Layer | Role |
| --- | --- |
| `packages/` | shared project code exposed by the host through `ctx.packages` |
| `core/` | protocol contracts, base classes, types, integration interfaces |
| `cases/` | capabilities; shareable business logic lives here |
| `apps/` | hosts; select Cases, providers, packages, runtime, and deployment model |

### Import Rules

| Relationship | Rule |
| --- | --- |
| `cases/` → `core/` | allowed |
| `apps/` → `cases/` | allowed through registry |
| `apps/` → `packages/` | allowed |
| `cases/` → `packages/` direct import | forbidden; use `ctx.packages` |
| Case A → Case B direct import | forbidden; use `ctx.cases` |
| `cases/` → `apps/` | forbidden |

## 4. Case Model

A Case is one cohesive capability organized inside its own folder.

### Naming and Layout

- canonical name: `<entity>_<verb>`
- folder: `cases/<domain>/<case>/`
- surface file: `<case>.<surface>.case.<ext>`
- support artifact: `<case>.us.md`

### `<case>.us.md`

The canonical support artifact is `<case>.us.md`.
It records operational intent without replacing `domain.case.ts`.

Required in `/app` when:

- a new Case is created
- a new surface is added
- Case semantics change
- cross-case composition is introduced
- recovery, policy, or agentic contract changes materially

Optional only when:

- the change is purely editorial
- the change is purely technical and does not alter semantics, contracts, or behavior

## 5. Surface Grammar

Implement only the surfaces the task needs.

### 5.1 Summary Matrix

| Surface | File | Goal | Required in `/app` | Optional | Key Rules |
| --- | --- | --- | --- | --- | --- |
| `domain` | `<case>.domain.case.ts` | pure semantics, invariants, validation, schemas, examples | `caseName()`, `description()`, `inputSchema()`, `outputSchema()`, `test()` | `validate`, `invariants`, `valueObjects`, `enums`, `examples`, `definition` | no I/O; consumed manually by other surfaces; no auto-wiring of `domain.validate()` |
| `api` | `<case>.api.case.ts` | backend execution, auth, orchestration, response | `handler(input)`, `test()`, one execution center: `_service` or `_composition` | `router`, `_validate`, `_authorize`, `_repository` | `handler()` receives business input; `router()` only binds transport; `_composition` uses `ctx.cases` |
| `ui` | `<case>.ui.case.ts` | self-contained visual unit | `view()`, `test()` | `_viewmodel`, `_service`, `_repository`, `setState` | UI must not do direct cross-case composition |
| `stream` | `<case>.stream.case.ts` | event consumption, publication, declarative recovery | `handler(event)`, `test()`, one execution center: `_service` or `_composition` | `subscribe`, `recoveryPolicy`, `_consume`, `_repository`, `_publish` | `subscribe()` and `recoveryPolicy()` are declarative; `recoveryPolicy()` must be deterministic and free of I/O |
| `agentic` | `<case>.agentic.case.ts` | discovery, tool contract, policy, MCP integration | `discovery()`, `context()`, `prompt()`, `tool()`, `test()` when surface exists | `mcp`, `rag`, `policy`, `examples` | `tool.execute()` delegates to a canonical surface; no shadow business logic; `agentic` remains optional in baseline APP |

### 5.2 Critical Surface Rules

#### domain

- `domain` is consumed manually by other surfaces
- there is no automatic wiring of `domain.validate()` into `api`, `ui`, or `stream`
- each surface decides explicitly whether and how to consume domain artifacts
- forbidden in `domain`: I/O, HTTP, persistence, logging, rendering, arbitrary side effects

#### api

- `handler()` receives business input, not raw HTTP requests
- `_service` and `_composition` are mutually exclusive as the main execution center
- if `_composition` exists, cross-case orchestration happens through `ctx.cases`

#### ui

Grammar:

```text
view ↔ _viewmodel ↔ _service ↔ _repository
```

#### stream

- `subscribe()` is declarative binding
- `recoveryPolicy()` is declarative, deterministic, serializable, and free of I/O
- `_publish()` does not replace `subscribe()` or the runtime

#### agentic

- `mcp()` controls exposure and presentation; it does not redefine execution
- `tool.execute()` must delegate to a canonical surface

## 6. Composition and Runtime

### Atomic vs Composed Case

| Type | Center | Meaning |
| --- | --- | --- |
| atomic | `_service()` | local capability logic, no orchestration |
| composed | `_composition()` | orchestrates other Cases through `ctx.cases` |

### Non-Negotiable Runtime Rules

- `handler()` never carries business logic; it delegates to the canonical pipeline
- Cases do not import other Cases directly
- host apps materialize `ctx.cases` and `ctx.packages`
- `_cases` exposes constructors, not shared runtime instances
- hosts instantiate surfaces per execution with current context, not at global boot
- cross-case composition inherits the current operation context
- routes and subscriptions stay declarative
- error contracts remain structured

## 7. `<case>.us.md` Contract

### Purpose

`<case>.us.md` is the agent support artifact for specifying, reviewing, and
validating a capability. It documents operational intent and does not replace
`domain.case.ts`.

### Minimum Template

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
- do not duplicate semantics in a way that contradicts the domain

### Approval Rule

Ask for human approval before implementation when:

- business-rule questions remain open
- the Case introduces new semantics that are not already explicit
- the work includes an architectural tradeoff with relevant consequences
- the composition depends on Cases that are not yet validated

If the task is already clear and localized, the agent may create/update
`<case>.us.md`, implement immediately after, and present both at closure.

## 8. Workflow

```text
inspect → specify → create/implement → validate → review
```

| Step | Goal | Minimum Output / Rule |
| --- | --- | --- |
| `inspect` | understand current topology before acting | relevant Cases, surfaces, apps, registries, conformance or drift signals; does not modify code |
| `specify` | materialize or update `<case>.us.md` | every relevant semantic change must be reflected there |
| `create` | scaffold a new Case or surface | create `domain` first for new Cases; scaffold only needed surfaces; include `test()` from the start; create `<case>.us.md` together |
| `implement` | write or adjust a surface inside grammar | respect project conventions; do not invent slots; keep semantics local; update `test()` |
| `validate` | check structural, behavioral, operational conformance | use tooling when available; otherwise use manual grammar checklist, review `test()`, run project validations, and cross-check against `<case>.us.md` |
| `review` | inspect final result before closure | focus on grammar violations, drift, surface inconsistency, composition/recovery/agentic risk |

## 9. Validation

### 9.1 Structural

- file names follow `<case>.<surface>.case.<ext>`
- folders follow `cases/<domain>/<case>/`
- forbidden imports do not exist
- `_service` and `_composition` do not compete for the same execution center
- `handler()` delegates
- `domain` remains pure
- every touched surface has `test()`
- `<case>.us.md` exists when required by `/app`

### 9.2 Semantic

- `domain` reflects the correct capability
- `api`, `ui`, `stream`, and `agentic` do not contradict the domain
- declared invariants are enforced at a canonical point
- composition uses `ctx.cases`
- agentic delegates to a canonical surface

### 9.3 Operational

- routes and subscriptions remain declarative
- recovery remains host-compatible
- error contracts remain structured
- host materialization of `ctx.cases` and `ctx.packages` remains correct
- cross-case composition inherits the current operation context

## 10. Example: `usuario_criar`

Example prompt:

```text
Create case usuario_criar using /app.
```

Expected agent behavior:

1. inspect the current project topology and naming conventions
2. create or update `usuario_criar.us.md`
3. create `usuario_criar.domain.case.ts`
4. create `usuario_criar.api.case.ts`
5. define canonical invariants and validation rules
6. implement an atomic execution center unless composition is truly required
7. add or update `test()` on each touched surface
8. validate the result against APP grammar and `<case>.us.md`

Expected invariants:

- email is unique
- password never remains plain text in the canonical flow
- the API surface remains thin and delegates business logic

Expected structure:

```text
cases/identidade/usuario_criar/
  usuario_criar.us.md
  usuario_criar.domain.case.ts
  usuario_criar.api.case.ts
```

## 11. `test()` Model

In baseline APP, `test()` is strongly recommended.
In `/app`, `test()` is required for every surface the agent creates or edits.

### Rules

- canonical signature: `test(): Promise<void>`
- the Case validates itself
- the test lives inside the surface, not in a mandatory parallel file
- local substitutes and internal data are allowed
- failures raise by `throw`

### Minimum Expected Phases

| Surface | Minimum phases |
| --- | --- |
| `domain` | `definition()` integrity; `validate()` behavior when present; `examples()` consistency when present |
| `api` | availability of `_service` or `_composition`; validation/authorization when present; integrated execution through `handler()` |
| `ui` | `view()` returns a valid visual unit; local slots function; basic integrated flow closes |
| `stream` | `subscribe()` shape when present; pipeline slots function; `handler()` processes a valid synthetic event |
| `agentic` | definition integrity; schema and policy consistency; `tool.execute()` delegates and returns expected shape |

## 12. Subagents

If the platform supports subagents, delegation, or parallel work:

- use them when independent subtasks exist
- ensure each subagent works under this same skill
- decompose work to respect write boundaries and avoid overlap

If the platform does not support subagents:

- ignore this section
- keep the workflow in a single agent

Use subagents for:

- multiple independent files
- parallel validation while other implementation advances
- reading and classifying independent contexts

Do not use subagents for:

- immediate blocking work
- tightly coupled changes in the same file
- small tasks where coordination cost exceeds benefit

## 13. Drift and Partial Adoption

Not every project will be fully aligned with APP.

| Level | Interpretation |
| --- | --- |
| `structural-only` | recognizable structure without explicit APP |
| `partial` | APP partially adopted or mixed with local conventions |
| `full` | explicit and consistent APP |

Rules:

- do not force migration unless requested
- respect local conventions when editing legacy code
- create new code in APP when compatible with the task
- record relevant drift in the operational memory appendix when using this skill as a living artifact

## 14. Guardrails

### NEVER

- never import a Case directly from another Case folder
- never place business logic in `handler()`
- never perform I/O in `domain`
- never treat `router()` or `subscribe()` as business slots
- never skip `test()` when creating or editing a surface
- never forget to create or update `<case>.us.md` when semantics change
- never invent grammar outside canonical surfaces
- never use agentic as a shadow implementation

### IF → THEN

| If... | Then... |
| --- | --- |
| new capability | create `<case>.us.md` and `domain` first |
| new surface | update `<case>.us.md` before or during implementation |
| technical bug without semantic change | may fix directly, but still review `test()` |
| contract change | update `<case>.us.md` and `test()` |
| composition doubt | prefer atomic first; promote to composed only if needed |
| platform supports subagents | use them when useful parallelism exists |
| platform does not support subagents | ignore that capability |
| automated tooling does not exist | validate manually with this skill checklist |

## 15. Task Closure

Before closing, confirm:

- APP grammar was preserved
- `<case>.us.md` was created or updated when required
- `test()` was created or updated on touched surfaces
- available validations were executed, or a justified reason was given when not
- final review found no remaining inconsistencies

## Appendix A. Operational Memory Templates

These templates preserve low-frequency operational memory content without keeping
it in the critical path of the skill.

### A.1 Project Inventory

```markdown
- Last inspection:
- Domains found:
- Cases per domain:
- Host apps:
- Current operational level:
- Structural observations:
```

### A.2 Conventions and Decisions

```markdown
- [CONV-001] Confirmed convention.
- [DEC-001] Confirmed decision.
```

### A.3 Learnings

```markdown
- [LEARN-001] Correction or observed pattern.
```
