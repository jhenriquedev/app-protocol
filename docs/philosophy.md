# Philosophy

`AI-First Programming` is the paradigm behind APP.

The central claim is simple:

> software should be organized so that humans and AI agents can understand and modify it with low context cost.

## Core Beliefs

- Capabilities should have explicit ownership.
- Semantic boundaries should be visible in the filesystem.
- Execution paths should be discoverable without deep repository traversal.
- Hidden coupling is more damaging in AI-assisted development than in traditional workflows.
- Architectural consistency is a multiplier for both humans and agents.

## Why Case-Centric Design

Most codebases drift toward structure by technical layer:

```text
api/
domain/
services/
components/
```

That layout often spreads one capability across many folders and many abstractions. APP moves in the opposite direction: keep a capability together unless there is a strong reason not to.

## Protocol vs Paradigm

The broader worldview is the paradigm:

- AI-first programming

The concrete, normative rules are the protocol:

- APP

This distinction matters because a paradigm can inspire multiple protocols, while a protocol should define specific constraints and contracts.

## Design Goals

- low context navigation
- predictable generation by AI agents
- minimal accidental architecture
- clear semantic ownership
- operational interoperability for agentic systems

## Current Limitation

APP is still early. The paradigm is coherent, but the protocol still needs:

- a formal machine schema
- reference implementations
- conformance tooling
- evidence across multiple ecosystems
