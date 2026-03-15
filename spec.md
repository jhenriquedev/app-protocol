# APP Specification

Status: Working draft

Current snapshot alignment:

- latest released version: [`v0.0.2`](./versions/v0.0.2.md)
- previous version: [`v0.0.1`](./versions/v0.0.1.md)

This document is the living draft of the AI-First Programming Protocol. Released versions are copied into [`versions/`](./versions).

Language policy:

- this working draft is canonical in English
- early released snapshots in `versions/` are legacy Portuguese documents
- Portuguese backups are preserved in [`i18n/pt-br/`](./i18n/pt-br/)

## 1. Purpose

APP defines a protocol for organizing software in a way that is predictable for humans and legible to AI agents.

The protocol optimizes for:

- low context cost
- explicit semantic ownership
- predictable file and folder structure
- minimal hidden coupling
- agent-ready execution contracts

## 2. Canonical Unit: Case

A `Case` is the canonical unit of organization in APP.

A Case:

- represents a single capability
- owns its local semantics and execution surfaces
- lives in a dedicated folder
- should be understandable with minimal navigation

Examples:

- `user_validate`
- `invoice_pay`
- `theme_toggle`
- `ticket_assign`

## 3. Canonical Structure

Recommended structure:

```text
app/
├── App.ts
├── core/
│   ├── domain.case.ts
│   ├── api.case.ts
│   ├── ui.case.ts
│   ├── stream.case.ts
│   ├── agentic.case.ts
│   └── shared/
└── cases/
    ├── cases.ts
    └── users/
        └── user_validate/
            ├── user_validate.domain.case.ts
            ├── user_validate.api.case.ts
            ├── user_validate.ui.case.ts
            ├── user_validate.stream.case.ts
            └── user_validate.agentic.case.ts
```

## 4. Surfaces

APP currently defines five canonical surfaces.

Not every Case needs every surface.

For now, `agentic.case.ts` is optional.
If present, it must follow the APP agentic protocol and map back to canonical execution logic.

### 4.1 Domain Surface

File:

```text
<case>.domain.case.ts
```

Purpose:

- pure semantics
- invariants
- validation rules
- value objects
- domain structures

Forbidden:

- IO
- HTTP
- persistence
- logging
- UI rendering
- arbitrary side effects

### 4.2 API Surface

File:

```text
<case>.api.case.ts
```

Purpose:

- input parsing
- authorization
- orchestration
- backend execution
- response mapping

### 4.3 UI Surface

File:

```text
<case>.ui.case.ts
```

Purpose:

- local state
- user interaction
- effects
- rendering
- integration with backend surfaces

### 4.4 Stream Surface

File:

```text
<case>.stream.case.ts
```

Purpose:

- event consumption
- publication
- retries
- idempotency
- pipelines

### 4.5 Agentic Surface

File:

```text
<case>.agentic.case.ts
```

Purpose:

- semantic discovery
- execution context for agents
- structured prompt metadata
- tool exposure
- policy enforcement
- RAG hints and retrieval scope
- MCP integration

Invariant:

> The agentic tool contract must execute the canonical Case implementation, not a shadow implementation.

## 5. Dependencies

A Case may depend on:

- `core`
- `core/shared`
- its own local `domain.case.ts`

Infrastructure concerns such as storage, HTTP, auth, queues, or other runtime services should be accessed through context or abstractions owned by `core`.

A Case should not directly depend on another Case.

If semantics are shared across Cases, they should be promoted to:

- `core/shared`, or
- a clearer local semantic abstraction where ownership remains explicit

Special rule:

- `agentic.case.ts` may reference `api.case.ts` or `stream.case.ts` as the canonical execution entrypoint

## 6. Registry

APP expects a registry file at:

```text
cases/cases.ts
```

The registry is used for:

- bootstrap
- discovery
- routing
- documentation generation
- agent indexing

The exact machine schema of the registry is not frozen yet.

## 7. Conformance

An implementation is APP-aligned when it preserves these invariants:

1. Case is the primary unit of ownership.
2. Cases are structurally predictable.
3. Domain semantics stay pure.
4. Cross-case coupling remains explicit and minimal.
5. Agentic execution maps back to canonical code paths.

Formal conformance tooling is planned, but not yet defined.

## 8. Non-Goals

APP does not currently define:

- a standard runtime
- a framework-specific implementation
- a package manager model
- a production-ready MCP server format
- a frozen schema for `agentic.case.ts`

## 9. Naming

Recommended terminology:

- `AI-First Programming` refers to the paradigm
- `APP` refers to the protocol

This distinction is useful because the philosophy may grow beyond the current spec, while APP remains the concrete protocol definition.

## 10. Open Work

The highest-priority gaps are:

1. formal schema for `agentic.case.ts`
2. formal schema for `cases.ts`
3. reference implementations
4. conformance tests and lint rules
5. versioning and release discipline for the spec itself

Recommended versus optional versus required protocol details will be frozen after clearer practical examples exist across multiple languages and ecosystems.
