# APP: AI-First Programming Protocol

APP is a specification for organizing software around self-contained units called `Cases`, designed for low-context collaboration between humans and AI agents.

The naming should stay split in two layers:

- `AI-First Programming` is the paradigm.
- `APP` is the protocol that operationalizes that paradigm.

Current status:

- Latest released snapshot: [`v1.1.4`](./versions/v1.1.4.md)
- Working draft: [`spec.md`](./spec.md)
- Maturity: stable protocol baseline with TypeScript reference implementation

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

Infrastructure contracts in `core/shared/app_infra_contracts.ts` are minimal integration examples, not a complete infrastructure taxonomy. Host-specific concerns such as `auth`, `db`, and `queue` remain free for each language, project, and runtime to model.

## Start Here

If you are new to APP, use this order:

1. [`docs/getting-started.md`](./docs/getting-started.md)
2. [`docs/create-app-project.md`](./docs/create-app-project.md)
3. [`docs/add-host-app.md`](./docs/add-host-app.md)
4. [`docs/using-packages.md`](./docs/using-packages.md)
5. [`docs/migrating-existing-projects.md`](./docs/migrating-existing-projects.md)
6. [`docs/protocol-overview.md`](./docs/protocol-overview.md)
7. [`docs/core-concepts.md`](./docs/core-concepts.md)
8. [`docs/spec-guide.md`](./docs/spec-guide.md)
9. [`docs/installing-app-skill.md`](./docs/installing-app-skill.md)
10. [`docs/using-app-skill.md`](./docs/using-app-skill.md)

Quick project-local install of the `/app` skill:

```bash
npx @app-protocol/skill-app install all --project .
```

Each installed skill now includes both `SKILL.md` and the current `spec.md` copy so agents can read the operational profile and the normative protocol together.

Supported host mirrors:

- Codex
- Claude
- GitHub Copilot
- Windsurf
- other Agent Skills-compatible hosts through `.agents/skills`

Quick validation:

```bash
npx @app-protocol/skill-app validate
```

Quick example run:

```bash
npm --prefix examples/react ci
npm --prefix examples/react run smoke
```

The React example is the active cross-client agentic reference: agent HTTP,
MCP `stdio`, and remote MCP over HTTP all come from the same host runtime.
The root `src/` baseline now mirrors the formal agent-host contract as well,
with canonical `apps/agent/` and shared MCP contracts in `core/shared/`.

## Repository Map

- [`spec.md`](./spec.md): current working draft of the specification
- [`versions/`](./versions): versioned snapshots of released specs
- [`docs/getting-started.md`](./docs/getting-started.md): fastest path to install `/app` and run the reference implementation
- [`docs/create-app-project.md`](./docs/create-app-project.md): bootstrap a new APP project without overbuilding the repository
- [`docs/add-host-app.md`](./docs/add-host-app.md): add a new host app and choose the right runtime wiring for backend, portal, agent, worker, or lambdas
- [`docs/using-packages.md`](./docs/using-packages.md): decide when code belongs in `packages/` and how to expose it correctly through hosts
- [`docs/migrating-existing-projects.md`](./docs/migrating-existing-projects.md): adopt APP incrementally in an existing codebase without forcing a big-bang rewrite
- [`docs/installing-app-skill.md`](./docs/installing-app-skill.md): installation, update, downgrade, uninstall, and host matrices for Codex, Claude, GitHub Copilot, Windsurf, npm, and GitHub Release tarballs
- [`docs/using-app-skill.md`](./docs/using-app-skill.md): when and how to use the canonical `/app` skill
- [`docs/protocol-overview.md`](./docs/protocol-overview.md): high-level overview of APP as a protocol
- [`docs/core-concepts.md`](./docs/core-concepts.md): canonical layers, surfaces, composition, and runtime model
- [`docs/spec-guide.md`](./docs/spec-guide.md): how the spec, snapshots, and supporting docs fit together
- [`docs/examples.md`](./docs/examples.md): example map and executable multi-runtime reference walkthroughs
- [`docs/faq.md`](./docs/faq.md): frequent questions about APP and `/app`
- [`docs/glossary.md`](./docs/glossary.md): canonical terminology
- [`docs/philosophy.md`](./docs/philosophy.md): conceptual framing behind AI-first programming
- [`docs/architectural-properties.md`](./docs/architectural-properties.md): APP-native architectural properties and how to interpret them
- [`docs/architecture.md`](./docs/architecture.md): canonical architectural diagrams and explanatory walkthroughs
- [`docs/agentic.md`](./docs/agentic.md): deeper notes on the agentic surface and agent host runtime contracts
- [`docs/conformance.md`](./docs/conformance.md): conformance levels and validation criteria
- [`docs/development-flow.md`](./docs/development-flow.md): how the spec evolves
- [`docs/publishing.md`](./docs/publishing.md): release and publishing flow for the installable `/app` skill
- [`docs/skill_v6.md`](./docs/skill_v6.md): current revision of the canonical `/app` operational skill
- [`skills/app/`](./skills/app): canonical installable `/app` skill package
- [`tooling/skill-app/`](./tooling/skill-app): npm-publishable installer package for the `/app` skill with install, update, upgrade, downgrade, uninstall, and `outdated` commands
- [`scripts/validate-boundaries.mjs`](./scripts/validate-boundaries.mjs): initial static boundary validator for `cases/`, `packages/`, and `registry.ts`
- [`rfcs/`](./rfcs): proposal process for substantive changes
- [`src/`](./src): minimal TypeScript protocol baseline with canonical `apps/agent/`, `backend`, `portal`, `lambdas`, and user Cases
- [`examples/`](./examples): executable APP references across React, Next.js, Node.js, Go, Deno, and TypeScript, plus additional ecosystem references under `examples/`
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
- `web.case.ts`
- `mobile.case.ts`
- `stream.case.ts`
- `agentic.case.ts`

Not every Case needs every surface.

`ui.case.ts` remains the general visual surface. `web.case.ts` and `mobile.case.ts` are specialized visual surfaces in the same family and may use their own concrete contracts.

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

## Paradigm and Protocol

APP operates within a clear conceptual hierarchy:

```text
AI-First Programming          ← paradigm
  └─ APP                      ← protocol
       └─ Implementations     ← concrete projects
```

**AI-First Programming** is the paradigm — the conceptual worldview that software must be structured for both humans and AI agents from the ground up. It is defined by five declarations: Ontology, Composition, Evolution, Cognition, and Operability.

**APP** is the protocol — the normative layer that operationalizes the paradigm with concrete structure, contracts, surfaces, and execution rules.

APP is the first normative expression of the paradigm, not the only one possible.

The paradigm declarations are formalized in [`spec.md` §2](./spec.md). Expanded philosophical framing lives in [`docs/philosophy.md`](./docs/philosophy.md).

The conceptual layer is now closed enough to be public and stable. The next cycle is operational hardening and validation: strengthen formal conformance tooling, ship Canonical Capability Adapter tooling, publish an end-to-end agentic proof-of-concept, expand multi-language references, and validate the protocol through real-world adoption.

## Install and Publish

For installation details:

- [`docs/installing-app-skill.md`](./docs/installing-app-skill.md)
- [`tooling/skill-app/README.md`](./tooling/skill-app/README.md)

For release and npm publishing:

- [`docs/publishing.md`](./docs/publishing.md)
- [`.github/workflows/release-skill-app.yml`](./.github/workflows/release-skill-app.yml)

## How To Read This Repo

1. Start with [`README.md`](./README.md).
2. Read [`docs/getting-started.md`](./docs/getting-started.md) if you want the shortest practical path.
3. Read [`docs/create-app-project.md`](./docs/create-app-project.md) if you want to start a new APP project.
4. Read [`docs/migrating-existing-projects.md`](./docs/migrating-existing-projects.md) if you want to adopt APP incrementally.
5. Read [`spec.md`](./spec.md) for the current draft.
6. Compare released snapshots in [`versions/`](./versions).
7. Use [`rfcs/`](./rfcs) for substantive protocol changes.

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

1. harden conformance tooling beyond the initial static boundary validator
2. generalize the reference MCP-capable agent host into reusable capability-adapter tooling
3. end-to-end agentic proof-of-concept with real agents
4. expand the multi-language reference set further, especially Python and additional ecosystems

See [`ROADMAP.md`](./ROADMAP.md).

## License

This repository is licensed under Apache-2.0. See [`LICENSE`](./LICENSE).
