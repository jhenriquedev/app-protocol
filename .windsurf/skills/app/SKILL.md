---
name: app
description: use when setting up APP projects, adding host apps, creating or updating Cases, introducing packages, classifying shared code across cases/packages/core/shared, maintaining <case>.us.md, validating APP grammar, reviewing structural drift, and adapting existing projects incrementally with the canonical /app workflow
---

# /app — Canonical Operational Skill for APP

This is the active PRD revision of the canonical `/app` skill.
It keeps the operational content of the previous revision while reducing repetition
and improving scanability.

## Revision Metadata

- Version: `1.1.0-prd`
- Protocol: `app@v1.1.0`
- Status: `prd`

## What This Skill Does

- inspect an APP project and explain its topology
- set up a new APP project with canonical layers and the first host app
- add a new host app such as `backend`, `portal`, `agent`, `worker`, or `lambdas`
- create a new Case such as `usuario_criar`
- implement or revise `domain`, `api`, `ui`, `stream`, and `agentic` surfaces
- introduce `packages/` and expose them correctly through host registries
- classify whether a new artifact belongs in `cases/`, `packages/`, `core/shared/`, or requires protocol evolution
- validate APP grammar and host runtime rules
- detect architectural drift in Cases and hosts
- adapt an existing project to APP incrementally when requested
- create or update `<case>.us.md` when semantics, contracts, or composition change

If you do not know APP yet, this skill should guide you through the canonical workflow instead of assuming prior protocol knowledge.

APP is the protocol layer of the AI-First Programming Paradigm.
`/app` is the canonical skill for applying that protocol in real projects.

### Example Prompts

- `Use /app to inspect this repository.`
- `Set up a new APP project using /app.`
- `Add an agent host app using /app.`
- `Create case usuario_criar using /app.`
- `Introduce packages/ for shared HTTP clients using /app.`
- `Adapt this existing project to APP incrementally using /app.`
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
| agentic completeness | `agentic` optional; app-level agentic host formalized in current spec | when the task requires agentic at Case or app level, the full formal definition is mandatory; partial or placeholder agentic layers are non-conformant in `/app` |
| subagents | outside protocol scope | required when supported and parallel work is useful |

### Core Rules

- start unknown work with `inspect`
- keep `handler()` thin and free of business logic
- create or update `<case>.us.md` when semantics change
- add or update `test()` on every touched surface
- if the task requires the agentic layer, define it completely according to the current normative contract; never leave a partial agentic host or surface behind
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

### Structural Tasks Supported by `/app`

| Task | Canonical result |
| --- | --- |
| new APP project | create canonical layers, first host app, first registry, and first Case path |
| new host app | add `apps/<app>/app.ts` and `apps/<app>/registry.ts` with only needed `_cases`, `_providers`, `_packages` |
| new package | add shared project code under `packages/` and expose it per app through `_packages` / `ctx.packages` |
| new `core/shared/` artifact | add only if it is a protocol-level contract or shared structural shape |
| new canonical surface | stop normal implementation flow and treat as protocol evolution |
| existing-project adoption | carve out APP-managed areas incrementally; do not force a full rewrite unless requested |

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
| `agentic` | `<case>.agentic.case.ts` | discovery, tool contract, policy, MCP integration | `discovery()`, `context()`, `prompt()`, `tool()`, `test()` when surface exists | `mcp`, `rag`, `policy`, `examples` | `tool.execute()` delegates to a canonical surface; no shadow business logic; if the task requires the agentic layer, `/app` requires the full formal definition, not a partial stub |

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

- `mcp()` controls Case-level exposure and presentation; it does not redefine execution
- `tool.execute()` must delegate to a canonical surface
- if `agentic` is created or revised, `/app` requires the full formal contract to be materially defined: `discovery()`, `context()`, `prompt()`, `tool()`, and `test()`
- include `policy()`, `mcp()`, `rag()`, and `examples()` whenever the capability semantics or host runtime require them; do not leave those concerns implicit
- if the task requires app-level agentic operability, the skill must also formalize the host layer in `apps/agent/`; `agentic.case.ts` alone is not sufficient
- full app-level agentic conformance requires a real MCP boundary in `apps/agent/`; Case-level `mcp()` metadata alone is not enough

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

## 6.1 Structural Playbooks

Use these playbooks for repository-structure tasks that are broader than a single Case.

### New APP Project

- create the canonical layer layout: `packages/`, `core/`, `cases/`, `apps/`
- `packages/` may start empty; do not invent packages before there is shared project code to expose
- create at least one host app with `apps/<app>/app.ts` and `apps/<app>/registry.ts`
- create the first Case with `domain` first and add only the needed surfaces
- validate imports, registry slots, and host context materialization before closure

### New Host App

- inspect existing Cases, surfaces, providers, and packages first
- create `apps/<app>/registry.ts` selecting only the Cases, providers, and packages that host actually needs
- create `apps/<app>/app.ts` as the host bootstrap for that runtime
- keep the semantic role the same across host types, but adapt bootstrap to the runtime: server, frontend, worker, lambda, or agent host
- prefer `agent` as the canonical generic host name for agentic runtimes; use `chatbot` only when the host is explicitly conversational
- do not assume `backend`, `portal`, `agent`, `worker`, and `lambdas` share the same boot code; they share responsibilities, not identical implementation

### Agent Host Completeness

If the task creates or revises `apps/agent/`, `/app` MUST treat the agentic
layer as a complete host concern, not as an optional enhancement.

Required registry definition:

- `AgenticRegistry` on top of `AppRegistry`
- `listAgenticCases()`
- `getAgenticSurface(ref)`
- `instantiateAgentic(ref, ctx)`
- `buildCatalog(ctx)`
- `resolveTool(toolName, ctx)`
- `listMcpEnabledTools(ctx)`
- protocol-level MCP abstraction in `core/shared/` through an abstract adapter contract such as `BaseAppMcpAdapter`
- concrete MCP transport implementation bound in `_providers` rather than in `core/shared/`
- if more than one MCP transport exists, bind them explicitly as named providers such as `_providers.mcpAdapters.stdio` and `_providers.mcpAdapters.http`

Required `apps/agent/app.ts` responsibilities:

- `bootstrap(config)`
- `createAgenticContext(parent?)`
- `buildAgentCatalog(parent?)`
- `buildSystemPrompt(parent?)`
- `resolveTool(toolName, parent?)`
- `executeTool(toolName, input, parent?)`
- `initializeMcp(params?, parent?)`
- `listMcpTools(parent?)`
- `listMcpResources(parent?)`
- `readMcpResource(uri, parent?)`
- `callMcpTool(name, input, parent?)`
- `publishMcp()`
- `validateAgenticRuntime()`

Required runtime semantics:

- tool publication derives from registered `agentic` surfaces
- host publication must project the complete `AgenticDefinition` automatically from `AgenticRegistry`; do not hand-curate per-tool semantic fields in the host
- `AgenticContext` is materialized per execution
- tool names are unique after MCP fallback resolution
- `requireConfirmation` and `executionMode` are enforced by the host/runtime
- MCP tool descriptors must include a semantic summary derived from `prompt`, `discovery`, `context`, and runtime policy
- richer host channels such as MCP resources and `/catalog` must expose the full projected semantic payload from the registry
- the global host prompt must be assembled automatically from registered tool prompt fragments and runtime policy; it must not override per-Case `agentic` semantics
- complete `apps/agent/` conformance exposes an HTTP boundary plus at least one real MCP boundary
- HTTP and MCP derive from the same host catalog and canonical execution path
- MCP lifecycle and operations are materially implemented: `initialize`, `tools/list`, `resources/list`, `resources/read`, `tools/call`
- do not invent `_mcp()` as a canonical host method; use explicit host methods such as `publishMcp()`, `listMcpTools()`, and `callMcpTool()`
- when MCP uses `stdio`, do not present it as just another long-running HTTP service; document and wire it as a separate process because the MCP client must own stdin/stdout directly
- `initializeMcp()` must not assume exact protocol-version equality if the host claims support for more than one compatible revision; declare supported versions explicitly and reject only truly unsupported versions
- plain host REST routes do not count as remote MCP publication
- if remote MCP is in scope, expose a dedicated remote MCP endpoint and keep it aligned with the same catalog, policy, and structured-error semantics used by local MCP

### New `packages/` Entry

- use `packages/` for shared project code selected by hosts, not for protocol contracts
- expose packages through `registry._packages`
- consume packages only through `ctx.packages` in contextual surfaces
- keep package introduction app-scoped: each host exposes only what it wants to make available

### New `core/shared/` Artifact

- place something in `core/shared/` only if it is a protocol-level context, host contract, infrastructure contract, or structural shape with cross-project meaning
- keep project-specific utilities, SDK wrappers, adapters, and design systems in `packages/`
- keep capability-specific structures inside the owning Case

### New Canonical Surface

- do not scaffold a new surface base class as routine project work
- treat it as protocol evolution requiring issue, RFC, `spec.md` change, and release acceptance
- if the user wants a project-local abstraction, prefer `packages/`, `core/shared/`, or local Case/app code instead of inventing a new canonical surface

### Existing Project Adoption

- do not force migration unless requested
- identify a bounded area where APP can be introduced safely
- create new APP Cases and host registries incrementally around new or refactored capability slices
- record where APP-managed and legacy areas meet, and review drift explicitly at task closure
- if an example or guide changes status from placeholder/legacy to active reference, update all active onboarding documents that point to the old reference

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

### Structural Task Routing

| If the task is... | Then the skill should... |
| --- | --- |
| new project bootstrap | inspect repo state, scaffold canonical layers, add first host app, and validate minimal APP topology |
| new host app | inspect runtime needs, create `app.ts` + `registry.ts`, wire only needed Cases/providers/packages, then validate host semantics; if the host is `agent`, require the complete formal agentic host definition |
| package introduction | classify the shared code as `packages/`, expose it through `_packages`, and validate `ctx.packages` usage |
| `core/shared/` addition | check whether it is truly protocol-level; if not, keep it out of `core/shared/` |
| new canonical surface proposal | stop normal implementation and switch to protocol-evolution guidance |
| existing-project adaptation | use incremental adoption, preserve bounded legacy areas, and avoid broad rewrites unless requested |

## 9. Validation

### 9.1 Structural

- file names follow `<case>.<surface>.case.<ext>`
- folders follow `cases/<domain>/<case>/`
- forbidden imports do not exist
- host apps keep `apps/<app>/app.ts` and `apps/<app>/registry.ts`
- `registry.ts` uses `_cases`, `_providers`, and `_packages` according to protocol semantics
- `packages/` additions are exposed through `_packages`, not direct Case imports
- `core/shared/` additions remain protocol-level instead of project-utility drift
- `_service` and `_composition` do not compete for the same execution center
- `handler()` delegates
- `domain` remains pure
- every touched surface has `test()`
- `<case>.us.md` exists when required by `/app`
- if agentic work was requested, the full required agentic surface or host contract is present rather than partially scaffolded

### 9.2 Semantic

- `domain` reflects the correct capability
- `api`, `ui`, `stream`, and `agentic` do not contradict the domain
- declared invariants are enforced at a canonical point
- composition uses `ctx.cases`
- agentic delegates to a canonical surface
- if app-level agentic behavior is in scope, `apps/agent/` semantics are explicit and complete rather than implied by Case-level metadata

### 9.3 Operational

- routes and subscriptions remain declarative
- recovery remains host-compatible
- error contracts remain structured
- host materialization of `ctx.cases` and `ctx.packages` remains correct
- cross-case composition inherits the current operation context
- each host app exposes only the Cases and packages it actually intends to load
- existing-project adoption keeps APP boundaries explicit instead of silently mixing grammar
- `apps/agent/` enforces `requireConfirmation` and `executionMode` at runtime
- `apps/agent/` resolves and publishes tools through `AgenticRegistry`
- `apps/agent/` keeps HTTP and MCP publication aligned to the same catalog and policy semantics
- the concrete MCP adapter is bound in `_providers`, while the abstract MCP contract remains in `core/shared/`
- `apps/agent/` does not conflate stdio MCP startup with aggregate HTTP dev flows
- `apps/agent/` does not confuse ordinary HTTP routes with a remote MCP boundary
- active onboarding docs point to the current reference implementation rather than a legacy or placeholder example

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

When `apps/agent/` is touched, validation must also cover:

- `AgenticRegistry` lookup and catalog behavior
- host resolution from external tool name to canonical execution
- runtime enforcement for confirmation and execution mode
- per-execution `AgenticContext` materialization
- MCP lifecycle and transport behavior: `initialize`, `tools/list`, `tools/call`
- HTTP/MCP parity for catalog publication and canonical execution behavior
- negative MCP checks for unsupported protocol versions when the host exposes `initializeMcp()`
- if MCP `stdio` exists, stdout remains reserved for protocol messages and startup guidance keeps stdio separate from aggregate dev runners
- if remote MCP exists, validate the dedicated endpoint path and the remote transport handshake separately from plain REST routes

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
- never leave the agentic layer partially defined when the task requires agentic operability

### IF → THEN

| If... | Then... |
| --- | --- |
| new capability | create `<case>.us.md` and `domain` first |
| new surface | update `<case>.us.md` before or during implementation |
| technical bug without semantic change | may fix directly, but still review `test()` |
| contract change | update `<case>.us.md` and `test()` |
| composition doubt | prefer atomic first; promote to composed only if needed |
| agentic surface is required | fully define `discovery`, `context`, `prompt`, `tool`, and `test`, plus any required `policy` / `mcp` / `rag` / `examples` |
| `apps/agent/` is required | fully define the formal agent host contract, not only the Case-level `agentic` surfaces |
| platform supports subagents | use them when useful parallelism exists |
| platform does not support subagents | ignore that capability |
| automated tooling does not exist | validate manually with this skill checklist |

## 15. Task Closure

Before closing, confirm:

- APP grammar was preserved
- `<case>.us.md` was created or updated when required
- `test()` was created or updated on touched surfaces
- if agentic was in scope, the full formal Case-level and/or app-level agentic definition was implemented and validated
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
