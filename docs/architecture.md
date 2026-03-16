# APP Architecture

This document presents the canonical architectural diagrams of APP in explanatory form.

The normative source remains [`spec.md`](../spec.md). The Mermaid diagrams here are aligned with the spec and are meant to make the protocol easier to learn, teach, and review.

## Visual Grammar

APP diagrams use the same semantic palette throughout:

- `packages/` — shared project code
- `core/` — protocol contracts
- `cases/` — capability ownership
- `apps/` — runtime composition and execution

Arrow semantics:

- solid arrow = direct import, registration, or execution flow
- dashed arrow = contextual exposure or indirect runtime access

## 1. Four Canonical Layers

```mermaid
flowchart TB
  packages[packages/]:::pkg
  core[core/]:::core
  cases[cases/]:::cases
  apps[apps/]:::apps

  cases -->|imports contracts from| core
  apps -->|registers and instantiates| cases
  apps -->|binds runtime to| core
  apps -->|selects and exposes| packages
  apps -.->|injects via ctx.packages| cases

  classDef pkg fill:#efe7d2,stroke:#8a6d1d,color:#2f2508;
  classDef core fill:#dbe9ff,stroke:#2b6cb0,color:#0b2545;
  classDef cases fill:#dff3e4,stroke:#2f855a,color:#0f2f1f;
  classDef apps fill:#ffe2d5,stroke:#c05621,color:#4a1f10;
```

This is the core architectural picture of APP:

- `cases/` own capabilities
- `core/` owns contracts
- `apps/` own runtime assembly
- `packages/` provide shared project code selected by each app

## 2. A Case as a Capability Unit

```mermaid
flowchart LR
  subgraph Case["Case Folder"]
    domain["domain.case.ts"]:::domain
    api["api.case.ts"]:::surface
    ui["ui.case.ts"]:::surface
    stream["stream.case.ts"]:::surface
    agentic["agentic.case.ts"]:::surface
  end

  domain -->|semantic source of truth| api
  domain -->|semantic source of truth| ui
  domain -->|semantic source of truth| stream
  domain -->|optional derivation| agentic

  classDef domain fill:#fff4cc,stroke:#b7791f,color:#4a3410;
  classDef surface fill:#edf2f7,stroke:#4a5568,color:#1a202c;
```

Not every Case implements every surface. What matters is that all implemented surfaces belong to the same capability.

## 3. App Registry and Context Materialization

```mermaid
flowchart LR
  subgraph Registry["apps/<app>/registry.ts"]
    casesSlot["_cases"]:::cases
    providersSlot["_providers"]:::core
    packagesSlot["_packages"]:::pkg
  end

  bootstrap["apps/<app>/app.ts"]:::apps
  contexts["Per-surface ctx"]:::core
  casesRuntime["Case instances"]:::cases

  casesSlot --> bootstrap
  providersSlot --> bootstrap
  packagesSlot --> bootstrap
  bootstrap --> contexts
  contexts --> casesRuntime

  classDef pkg fill:#efe7d2,stroke:#8a6d1d,color:#2f2508;
  classDef core fill:#dbe9ff,stroke:#2b6cb0,color:#0b2545;
  classDef cases fill:#dff3e4,stroke:#2f855a,color:#0f2f1f;
  classDef apps fill:#ffe2d5,stroke:#c05621,color:#4a1f10;
```

This is how APP resolves abstraction into runtime:

- `_cases` supplies constructors
- `_providers` binds infrastructure
- `_packages` exposes shared project libraries
- the host creates per-surface contexts and instantiates the Cases

## 4. Cross-Case Composition

```mermaid
flowchart LR
  caseA["Case A"]:::cases --> compose["_composition"]:::surface
  compose -.-> ctxcases["ctx.cases"]:::core
  ctxcases -.-> caseB["Case B public surface"]:::cases

  classDef core fill:#dbe9ff,stroke:#2b6cb0,color:#0b2545;
  classDef cases fill:#dff3e4,stroke:#2f855a,color:#0f2f1f;
  classDef surface fill:#edf2f7,stroke:#4a5568,color:#1a202c;
```

APP allows composition, but only through explicit runtime boundaries. A Case does not reach into another Case's internals by import path.

## 5. Agentic Execution

```mermaid
flowchart LR
  agent["Agent / MCP Client"]:::apps --> tool["agentic.tool()"]:::surface
  tool --> canonical["canonical api/stream surface"]:::cases
  canonical --> result["AppResult / structured output"]:::core

  classDef core fill:#dbe9ff,stroke:#2b6cb0,color:#0b2545;
  classDef cases fill:#dff3e4,stroke:#2f855a,color:#0f2f1f;
  classDef surface fill:#edf2f7,stroke:#4a5568,color:#1a202c;
  classDef apps fill:#ffe2d5,stroke:#c05621,color:#4a1f10;
```

The agentic surface is not a shadow implementation. It delegates to canonical execution surfaces.

## 6. Stream Recovery

```mermaid
flowchart LR
  broker["Broker / Event Source"]:::apps --> host["App Runtime"]:::apps
  host --> handler["handler(event)"]:::surface
  handler --> pipeline["pipeline"]:::surface
  pipeline --> work["_service or _composition"]:::cases
  work -->|success| done["ack / complete"]:::core
  work -->|failure| policy{"recoveryPolicy()?"}:::core
  policy -->|no| fail["runtime-defined failure path"]:::apps
  policy -->|yes| runtime["retry / dead-letter semantics executed by host"]:::apps
  runtime --> done

  classDef surface fill:#edf2f7,stroke:#4a5568,color:#1a202c;
  classDef core fill:#dbe9ff,stroke:#2b6cb0,color:#0b2545;
  classDef cases fill:#dff3e4,stroke:#2f855a,color:#0f2f1f;
  classDef apps fill:#ffe2d5,stroke:#c05621,color:#4a1f10;
```

The Case declares semantics. The app validates and binds them. The runtime executes them.

## 7. Why This Is APP and Not a Layer-First Diagram

The diagrams above describe a capability-first system:

- capability ownership lives in `cases/`
- protocol grammar lives in `core/`
- shared project code lives in `packages/`
- runtime assembly lives in `apps/`

That is the architectural center of gravity of APP. It is not controller-service-repository rearranged with new names.
