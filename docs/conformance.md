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
- refusing to register a stream surface whose declared semantics cannot be honored

Typical mechanisms:

- bootstrap validation
- runtime guards
- host-level assertions

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

### Runtime Checklist

- host contexts are built from registry slots consistently
- `ctx.cases` reflects only the Cases exposed by that app
- `ctx.packages` reflects only app-selected packages
- stream recovery contracts are validated against runtime capability
- logical dead-letter destinations are bound before registration
- hosts refuse to register capabilities whose declared semantics cannot be honored

## Evidence Model

Projects adopting APP should be able to show evidence at all three levels:

- static evidence: repository checks and import validation
- review evidence: checklist-based PR review or architecture sign-off
- runtime evidence: bootstrap assertions, startup validation, and host logs

This is especially important for AI-assisted development. A protocol is only useful if its properties are inspectable and enforceable, not merely aspirational.
