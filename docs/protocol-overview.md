# APP Protocol Overview

This document explains APP at a high level before you read the full specification.

## What APP is

APP stands for `AI-First Programming Protocol`.

It is a protocol for organizing software around self-contained capabilities that
are easier for humans and AI agents to inspect, understand, and evolve.

APP is not a library, framework, or runtime product.
It is a structural and operational protocol.

APP can be used in both:

- new greenfield projects
- existing projects through incremental adoption

APP can also be agentic at two different layers:

- Case level, through `agentic.case.ts`
- app level, through an `apps/agent/` host that publishes and governs those capabilities across HTTP and MCP

## APP in one sentence

APP organizes software around `Cases`, each owning one capability and exposing
canonical surfaces inside a predictable filesystem grammar.

## Paradigm vs protocol

APP sits inside a larger conceptual hierarchy:

```text
AI-First Programming -> APP -> concrete implementations
```

- `AI-First Programming` is the paradigm
- `APP` is the protocol
- projects, apps, and examples are implementations

## Why APP exists

APP optimizes for:

- low context cost
- explicit capability ownership
- predictable file navigation
- explicit runtime boundaries
- compatibility with AI-assisted development and operation

## Canonical layers

APP defines four canonical project layers:

```text
packages/ -> core/ -> cases/ -> apps/
```

- `packages/`: shared project code selected by the host and exposed through `ctx.packages`
- `core/`: contracts, base classes, shared protocol types, and integration interfaces
- `cases/`: business capabilities
- `apps/`: hosts, runtimes, registries, deployment bindings

## What a Case is

A `Case` is the canonical unit of capability.

Each Case:

- owns one capability
- lives in its own folder
- may expose one or more surfaces
- can be consumed by hosts and other Cases through protocol rules

## Canonical surfaces

APP currently defines these surfaces:

- `domain.case.ts`
- `api.case.ts`
- `ui.case.ts`
- `stream.case.ts`
- `agentic.case.ts`

Not every Case needs every surface.

## Runtime model

The host owns runtime materialization.

That includes:

- selecting providers and packages
- building the registry
- materializing `ctx.cases`
- exposing `ctx.packages`
- binding routes, streams, and tools
- enforcing app-level agentic policy when the host is `apps/agent/`
- keeping HTTP and MCP publication aligned to the same host catalog and execution rules

## What APP does not try to standardize

APP does not try to model all infrastructure as a closed taxonomy.

Capabilities like `auth`, `db`, and `queue` remain host-defined.
The protocol only defines minimal integration examples where convergence is useful.

## `/app` vs APP

APP is the protocol baseline.
`/app` is the canonical operational profile for agents working inside APP projects.

That means `/app` can be stricter than baseline APP without changing the protocol itself.

## Read next

- [`core-concepts.md`](./core-concepts.md)
- [`conformance.md`](./conformance.md)
- [`../spec.md`](../spec.md)
