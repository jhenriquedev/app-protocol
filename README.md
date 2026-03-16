# APP: AI-First Programming Protocol

APP is a specification for organizing software around self-contained units called `Cases`, designed for low-context collaboration between humans and AI agents.

The naming should stay split in two layers:

- `AI-First Programming` is the paradigm.
- `APP` is the protocol that operationalizes that paradigm.

Current status:

- Latest released snapshot: [`v0.0.4`](./versions/v0.0.4.md)
- Working draft: [`spec.md`](./spec.md)
- Maturity: working protocol with TypeScript reference implementation

Language policy:

- English is the canonical language for active documentation going forward.
- Early released snapshots in `versions/` are legacy Portuguese documents.
- Portuguese backups are preserved under [`i18n/pt-br/`](./i18n/pt-br/).

## Why APP

APP exists to make codebases easier to understand, extend, and operate with AI assistance by enforcing:

- a predictable filesystem structure
- self-contained capability units
- explicit execution surfaces
- low semantic coupling between capabilities
- agent-ready discovery and execution contracts

Canonical project layers:

- `packages/` — shared project code exposed to contextual Cases through host-managed context
- `core/` — protocol contracts
- `cases/` — business capabilities
- `apps/` — composition roots and runtimes

## Repository Map

- [`spec.md`](./spec.md): current working draft of the specification
- [`versions/`](./versions): versioned snapshots of released specs
- [`docs/philosophy.md`](./docs/philosophy.md): conceptual framing behind AI-first programming
- [`docs/architectural-properties.md`](./docs/architectural-properties.md): APP-native architectural properties and how to interpret them
- [`docs/architecture.md`](./docs/architecture.md): canonical architectural diagrams and explanatory walkthroughs
- [`docs/agentic.md`](./docs/agentic.md): deeper notes on the agentic surface
- [`docs/conformance.md`](./docs/conformance.md): conformance levels and validation criteria
- [`docs/development-flow.md`](./docs/development-flow.md): how the spec evolves
- [`scripts/validate-boundaries.mjs`](./scripts/validate-boundaries.mjs): initial static boundary validator for `cases/`, `packages/`, and `registry.ts`
- [`rfcs/`](./rfcs): proposal process for substantive changes
- [`examples/`](./examples): executable TypeScript reference implementation and future ecosystem examples
- [`i18n/pt-br/`](./i18n/pt-br/): backup copies of native Portuguese materials

## Core Model

APP defines `Case` as the canonical unit of software organization.

Each Case:

- represents a single capability
- lives in its own folder
- may expose one or more execution surfaces
- depends on protocol contracts and receives host-selected shared packages through context

Canonical surfaces:

- `domain.case.ts`
- `api.case.ts`
- `ui.case.ts`
- `stream.case.ts`
- `agentic.case.ts`

Not every Case needs every surface.

`stream.case.ts` now uses a declarative `recoveryPolicy()` contract for retry and dead-letter semantics. The Case declares recovery intent; the app host validates and binds that policy to the concrete runtime during bootstrap.

For now, `agentic.case.ts` is optional.
If a Case exposes it, it must follow the APP agentic protocol.

## Architectural Properties

APP is not a relabeling of SOLID, DDD, or Clean Architecture.

It defines its own native architectural properties around:

- capability cohesion
- semantic ownership
- explicit surface contracts
- host-owned composition roots
- protocol-first dependency inversion
- low-context navigability for humans and AI

The normative version of these properties lives in [`spec.md`](./spec.md). Explanatory mappings and visual diagrams live in [`docs/architectural-properties.md`](./docs/architectural-properties.md) and [`docs/architecture.md`](./docs/architecture.md).

## Naming Decision

`Protocol` is the right name for APP today.

Reason:

- the spec is normative, not only philosophical
- it defines structure, contracts, allowed dependencies, and execution rules
- `Paradigm` is broader and better used for the high-level worldview behind APP

Recommended positioning:

- `AI-First Programming` = paradigm
- `APP` = protocol

## How To Read This Repo

1. Start with [`README.md`](./README.md).
2. Read [`spec.md`](./spec.md) for the current draft.
3. Compare released snapshots in [`versions/`](./versions).
4. Use [`rfcs/`](./rfcs) for substantive protocol changes.

## Contribution Model

Editorial improvements can go directly to pull requests.

Substantive changes should:

1. open an issue
2. add an RFC when the change affects protocol semantics, structure, schema, or governance
3. update the working draft in `spec.md`
4. update supporting docs when needed
5. cut a new snapshot under `versions/` only when the change is accepted and release-worthy

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`GOVERNANCE.md`](./GOVERNANCE.md).

## Roadmap

The next major steps for APP are:

1. formalize the `agentic.case.ts` schema
2. define a machine-validatable conformance model
3. ship at least two reference implementations
4. expand tooling for linting and scaffolding Cases

See [`ROADMAP.md`](./ROADMAP.md).

## License

This repository is licensed under Apache-2.0. See [`LICENSE`](./LICENSE).
