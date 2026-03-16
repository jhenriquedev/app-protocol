# Architectural Properties

This document explains the architectural properties induced by APP.

The normative source of truth remains [`spec.md`](../spec.md). This file is interpretive and explanatory: it helps readers recognize what APP is doing architecturally without reducing APP to an older architectural doctrine.

## Interpretation Rule

APP does not normatively inherit SOLID, DDD, Clean Architecture, Hexagonal Architecture, or any other prior school.

Instead:

- APP defines its own protocol-native properties
- external parallels are informative only
- the protocol's own semantics remain authoritative

## Property Map

| APP Property | What It Means in APP | What APP Rejects | Related External Ideas |
| --- | --- | --- | --- |
| Capability Cohesion | A `Case` is one capability, not a miscellaneous container | one folder mixing unrelated responsibilities | SRP, capability-based design |
| Semantic Ownership | The Case owns its semantics, contracts, and surfaces locally | ownership scattered across unrelated folders | bounded context ownership |
| Explicit Surface Contracts | Runtime boundaries are expressed through canonical surfaces | ad hoc entrypoints and hidden execution paths | explicit interface boundaries |
| Pure Domain Core | `domain.case.ts` stays side-effect-free | persistence, HTTP, UI, or logging inside domain | DDD tactical purity, functional core |
| Protocol Dependency Inversion | Cases depend on `core/` contracts; hosts bind implementations | business logic importing concrete runtime dependencies directly | DIP, ports and adapters |
| Host-Owned Composition Root | `apps/` assemble runtime, registry, providers, packages, and bindings | composition hidden inside cases or global singletons | composition root, DI |
| Explicit Orchestration Boundary | cross-case composition happens through `ctx.cases` and public capability boundaries | direct imports between Case internals | application orchestration boundary |
| Declarative Operational Contracts | operational semantics are declared when protocol slots exist | imperative hidden host behavior embedded inside Cases | policy object, declarative metadata |
| Structural Toolability | contracts remain structurally explicit for tooling and agents | opaque conventions and stringly-typed runtime behavior | schema-first / protocol-first design |
| Low-Context Navigability | a capability should be understandable with minimal navigation | layer scattering and high-context traversal | clean code outcome, AI-first legibility |

## The Properties in APP Terms

### Capability Cohesion

A `Case` is the unit of capability in APP.

This means:

- the Case folder should answer one business question
- the surfaces in that folder are multiple expressions of the same capability
- unrelated capabilities should be split into separate Cases even if they touch the same entities

APP rejects folders that become generic buckets such as "user services", "helpers", or "shared business logic" when the semantics actually belong to distinct capabilities.

### Semantic Ownership

APP keeps semantic ownership local to the Case.

This means:

- the Case owns its description, schemas, execution surfaces, and examples
- other Cases do not reach into its internal files
- apps consume Cases; they do not redefine their meaning

Semantic ownership is one of the main ways APP reduces ambiguity for humans and AI.

### Explicit Surface Contracts

A capability is not "some code that happens to be callable". It is expressed through canonical surfaces:

- `domain`
- `api`
- `ui`
- `stream`
- `agentic`

This means runtime boundaries are explicit and discoverable. Tooling, hosts, and AI agents know where to look for semantics and execution.

### Pure Domain Core

`domain.case.ts` is the semantic source of truth, not a runtime hook.

This means:

- validation, invariants, examples, and structural contracts belong there
- I/O, persistence, transport, and UI concerns do not

APP uses this purity to keep semantic reasoning stable across runtimes and surfaces.

### Protocol Dependency Inversion

Cases depend on protocol contracts from `core/`. Hosts bind concrete implementations in `apps/`.

This means:

- business capabilities do not import concrete HTTP, cache, queue, or vendor client details as their primary dependency model
- `core/` defines the protocol grammar
- `apps/` connect that grammar to runtime reality

This is one of the central reasons APP remains portable across languages and frameworks.

### Host-Owned Composition Root

APP makes `apps/` the composition root layer.

This means:

- `_cases`, `_providers`, and `_packages` are registered there
- per-surface contexts are created there
- runtime bindings such as dead-letter destinations, HTTP clients, caches, and packages are decided there

The app owns assembly. The Case owns capability semantics.

### Explicit Orchestration Boundary

Cross-case composition is allowed, but only through explicit capability boundaries.

This means:

- execution surfaces compose through `ctx.cases`
- orchestration lives in `_composition` when needed
- a Case does not import another Case's internal files

APP therefore allows composition without collapsing boundaries.

### Declarative Operational Contracts

When the protocol offers a declarative slot, APP prefers declaration over hidden imperative behavior.

Examples:

- `router()`
- `subscribe()`
- `recoveryPolicy()`
- `tool()`
- `mcp()`

The Case declares intent. The host materializes it.

This makes operational behavior inspectable, toolable, and validateable at bootstrap.

### Structural Toolability

APP is designed for tooling and agents, not only for human reading.

This is why the protocol emphasizes stable structural contracts such as:

- `AppSchema`
- `AppResult`
- `AppError`
- `StreamFailureEnvelope`
- registry contracts

These shapes are protocol assets. They are not incidental convenience types.

### Low-Context Navigability

APP treats low-context navigation as an architectural property, not just a documentation goal.

This means:

- a capability should be explainable by opening a small number of files
- local reasoning is preferred over distributed reasoning
- file placement carries semantic meaning

This property is one of the reasons APP is suitable for code generation and AI-assisted maintenance.

## What APP Is Not Doing

APP is not:

- a rebranding of SOLID
- a direct restatement of DDD
- a restatement of Clean Architecture layers
- a framework-specific architecture style

It is a protocol designed around a different pressure:

- code generation
- low-context maintenance
- human + AI collaboration
- predictable capability discovery

That is why APP names its own properties instead of borrowing external labels as normative law.
