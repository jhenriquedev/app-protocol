# Glossary

## AI-First Programming

The broader paradigm that treats software as something that must be structured
for both humans and AI agents from the start.

## APP

The `AI-First Programming Protocol`, a normative protocol for organizing software
around Cases and canonical surfaces.

## Case

The canonical unit of capability in APP.

## Surface

A canonical execution or interaction boundary of a Case, such as `domain`,
`api`, `ui`, `stream`, or `agentic`.

## Host

An app-level runtime that selects Cases, providers, shared packages, and
materializes execution context.

## Agent Host

The canonical generic app-level host for agentic runtimes, conventionally
located at `apps/agent/`.

## `AgenticRegistry`

The app-level extension of `AppRegistry` used by agent hosts to discover,
catalog, resolve, and publish registered `agentic` surfaces.

## `ctx.cases`

The host-materialized composition boundary through which a Case orchestrates
other Cases.

## `ctx.packages`

The host-materialized entrypoint through which a Case consumes shared project
packages.

## `domain`

The pure semantic surface that defines schemas, invariants, examples, and
validation semantics.

## `api`

The execution surface typically used for backend request handling and orchestration.

## `ui`

The interaction surface used for visual or stateful presentation concerns.

## `stream`

The event-driven surface used for subscriptions, event handling, and recovery policy.

## `agentic`

The optional surface that exposes a Case to AI agent tooling and orchestration.

## `_service()`

The execution center used by atomic surfaces that implement local capability logic.

## `_composition()`

The execution center used by composed surfaces that orchestrate other Cases.

## `<case>.us.md`

The support artifact used by stricter operational profiles such as `/app` to
record capability intent, validation scenarios, and expected behavior.

## `/app`

The canonical operational profile for agents working in APP projects.

## Trusted Publishing

npm's OIDC-based release model that allows GitHub Actions to publish without a
long-lived npm publish token.
