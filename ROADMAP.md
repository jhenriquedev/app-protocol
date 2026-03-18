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

- publish and iterate the canonical `/app` HML under `docs/skill_v4.md`
- stabilize skill `/app` into a production-ready operational skill across supported agent hosts
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
- ecosystem validation: publish migration guidance for converting existing projects to APP
- field validation: collect real-world adoption cases with measurable gains

## Phase 7: v1 Readiness and Stabilization

Status: planned

- define explicit release criteria for calling APP `v1.0`
- decide whether `agentic.case.ts` remains optional in `v1` or becomes part of a stronger conformance profile
- freeze `v1` guidance around deliberate host-defined infrastructure scope (`auth`, `db`, `queue`) so these remain implementation choices rather than protocol debt
- consolidate feedback from real implementations back into the normative spec without regressing the closed core model
