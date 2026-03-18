# APP Conformance

This document explains how APP conformance should be interpreted across different validation layers.

The normative source remains [`spec.md`](../spec.md). This document organizes those rules into enforcement categories so projects can build tooling, reviews, and runtime checks coherently.

## Conformance Levels

APP conformance operates at three levels:

### 1. Static Conformance

Rules that can be checked from:

- filesystem structure
- file naming
- import graph
- declared contracts

Typical mechanisms:

- lint rules
- repository analyzers
- code generation checks
- CI validators

### 2. Review-Level Conformance

Rules that need architectural judgment.

These usually concern:

- whether a Case really represents one capability
- whether ownership is explicit
- whether logic is being hidden in the wrong place
- whether a surface is being abused as a generic utility container

Typical mechanisms:

- PR review
- architecture review
- conformance checklist

### 3. Runtime Conformance

Rules that must be enforced by the app host during bootstrap or execution.

Typical examples:

- validating runtime compatibility with `recoveryPolicy()`
- ensuring `agentic.tool()` resolves to canonical execution
- ensuring an `apps/agent/` host can honor confirmation, execution mode, and tool-publication semantics
- refusing to register a stream surface whose declared semantics cannot be honored

Typical mechanisms:

- bootstrap validation
- runtime guards
- host-level assertions

## Operational Profiles

APP defines the baseline protocol grammar and minimum conformance expectations.
Projects, tools, and skills may adopt stricter operational profiles as long as
they do not contradict the canonical grammar.

The current canonical profile is skill `/app`.

Representative differences:

- baseline APP treats `test()` as strongly recommended; skill `/app` requires it for every surface the agent creates or edits
- baseline APP treats `<case>.us.md` as an optional support artifact; skill `/app` may require it for new Cases or significant semantic changes
- baseline APP does not require a fixed implementation workflow; skill `/app` standardizes `inspect → specify → create/implement → validate → review`

## Conformance Scope in Existing Projects

APP may be adopted incrementally inside a larger legacy repository.

In that scenario:

- conformance claims should be scoped to the APP-managed area
- new APP Cases and host registries should follow APP grammar fully
- legacy code outside the APP-managed area does not automatically invalidate bounded APP adoption
- review should make APP and legacy boundaries explicit instead of pretending the whole repository is already fully APP

## Representative Rule Matrix

| Rule | Level | Typical Enforcement |
| --- | --- | --- |
| canonical folder and file naming | static | linter / repository scanner |
| `cases/` must not import another Case's internals | static | import graph validation |
| contextual Cases must not import `packages/` directly | static | import graph validation |
| `_cases`, `_providers`, `_packages` slot usage | static | registry validation |
| `domain.case.ts` must not contain I/O | review-level + static where detectable | review + optional AST rules |
| a Case should remain capability-cohesive | review-level | architecture review |
| `_composition` should be used only for explicit orchestration | review-level | code review |
| `recoveryPolicy()` compatibility with runtime | runtime | app bootstrap validation |
| dead-letter binding resolution | runtime | app bootstrap validation |
| canonical execution from `agentic` to `api`/`stream` | runtime + review-level | host wiring + review |
| published tool name uniqueness after MCP fallback | runtime | agent host bootstrap validation |
| host enforcement of `requireConfirmation` / `executionMode` | runtime | agent host runtime guard |
| fresh `AgenticContext` per tool execution | runtime | context factory validation |

## Conformance Checklist

### Static Checklist

- every Case lives in its own folder
- canonical surface files follow naming conventions
- `cases/` imports `core/`, not other Case internals
- contextual Case surfaces do not import `packages/` directly
- `apps/<app>/registry.ts` uses `_cases`, `_providers`, and `_packages` according to protocol semantics
- protocol-declared slots such as `recoveryPolicy()` remain structurally valid

### Review Checklist

- the Case answers one capability question
- semantic ownership is local and explicit
- `domain.case.ts` stays pure
- `_repository` is local integration, not hidden orchestration
- `_composition` is explicit when orchestration exists
- the app remains the composition root instead of leaking assembly into Cases
- `agentic` app behavior is not being reimplemented as ad hoc glue outside registry/host responsibilities

### Runtime Checklist

- host contexts are built from registry slots consistently
- `ctx.cases` reflects only the Cases exposed by that app
- `ctx.packages` reflects only app-selected packages
- stream recovery contracts are validated against runtime capability
- logical dead-letter destinations are bound before registration
- hosts refuse to register capabilities whose declared semantics cannot be honored
- `apps/agent/` derives published tools from registered `agentic` surfaces
- `apps/agent/` projects the complete `AgenticDefinition` automatically from `AgenticRegistry`
- tool names are unique after MCP fallback resolution
- `requireConfirmation` and `executionMode` are enforced by the host/runtime
- `AgenticContext` is materialized per execution rather than shared globally
- the host global prompt is assembled automatically from registered tool prompt fragments and runtime policy
- `apps/agent/` exposes an HTTP boundary plus at least one real MCP boundary when it claims app-level agentic conformance
- plain host REST routes do not count as remote MCP publication
- when both local and remote MCP are present, they are bound explicitly in `_providers` rather than hidden in `core/shared/`
- MCP lifecycle, resource publication, and tool operations are validated end-to-end (`initialize`, `tools/list`, `resources/list`, `resources/read`, `tools/call`)
- HTTP and MCP publication derive from the same catalog and canonical execution path

## Evidence Model

Projects adopting APP should be able to show evidence at all three levels:

- static evidence: repository checks and import validation
- review evidence: checklist-based PR review or architecture sign-off
- runtime evidence: bootstrap assertions, startup validation, and host logs

This is especially important for AI-assisted development. A protocol is only useful if its properties are inspectable and enforceable, not merely aspirational.
