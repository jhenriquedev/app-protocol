# Roadmap

## Phase 1: Repository Foundation

Status: completed

- published a clean README
- established governance and contribution flow
- defined the working draft and version snapshots
- added basic documentation CI

## Phase 2: Protocol Consolidation

Status: completed

- freeze terminology
- formalize `agentic.case.ts`
- formalize `apps/<app>/registry.ts` as the canonical runtime entry point
- formalize `apps/agent/` as the canonical generic host name for app-level agentic runtimes
- formalize `AgenticRegistry` plus app-level agent host responsibilities on top of `AppRegistry`
- formalize APP-induced architectural properties as protocol semantics
- define conformance invariants
- define `packages/` as fourth canonical layer
- define `recoveryPolicy()` and `StreamFailureEnvelope` for stream recovery
- align documentation around English-first canonical materials

## Phase 3: Reference Implementations

Status: completed

- create a minimal TypeScript reference (`examples/typescript/` — Task Manager, 4 Cases, 3 hosts, 18 tests)
- non-TypeScript references planned for Phase 6

## Phase 4: Tooling

Status: current

- publish and iterate the canonical `/app` operational revision under `docs/skill_v5.md`
- stabilize skill `/app` into a production-ready operational skill across supported agent hosts
- document bootstrap of new APP projects, host-app addition, `packages/` usage, and incremental adoption in the active docs and skill
- strengthen static conformance validation beyond `validate:boundaries` with deeper registry and import-graph checks
- define and implement formal conformance tooling/workflow across static, review-level, and runtime checks
- conformance validation (grammar per surface, language-agnostic)
- scaffold new Cases in the project's language
- guided development cycle (create → implement → test → validate)
- refactoring from existing codebases to APP structure

## Phase 5: Paradigm Formalization

Status: completed

- formalize AI-First Programming as the paradigm (Q11 resolved)
- establish hierarchy: AI-First Programming (paradigm) → APP (protocol) → Implementations
- define 5 paradigm declarations: Ontology, Composition, Evolution, Cognition, Operability
- define 4 canonical composition forms (intra-Case, cross-Case sync, cross-Case event-driven, host-mediated)
- define Canonical Capability Adapter concept and clarify that ownership belongs to ecosystem tooling, not the protocol
- freeze the operational direction: adapter concept closed, composition model sufficient, standalone example closed, manifesto base formalized publicly

## Phase 6: Materialization and Validation

Status: current

- artifact materialization: implement Canonical Capability Adapter in tooling/skill `/app` and/or host examples, projecting APP capabilities into an external tool runtime
- artifact materialization: publish end-to-end agentic proof-of-concept with a real agent consuming APP project tools without glue code
- ecosystem validation: add reference implementations for Python, Go, and .NET
- ecosystem validation: validate migration guidance for converting existing projects to APP through real project adoption
- field validation: collect real-world adoption cases with measurable gains

## Phase 7: v1 Readiness and Stabilization

Status: completed

- release APP `v1.0.0` as the first stable protocol baseline
- keep `agentic.case.ts` optional in baseline APP while allowing stronger conformance profiles such as `/app`
- freeze `v1` guidance around deliberate host-defined infrastructure scope (`auth`, `db`, `queue`) so these remain implementation choices rather than protocol debt
- consolidate the closed core model, app-level agentic contracts, and active docs into a stable release snapshot
