# APP Examples

This repository contains two executable APP examples and several placeholder
directories for future ecosystem expansion.

## Current executable references

Primary current reference:

- [`../examples/react/`](../examples/react/)

This is the full current reference to run first when you want the active
`apps/agent/` semantics, HTTP publication, local MCP publication, and remote
MCP publication.

Compact illustrative example:

- [`../examples/typescript/`](../examples/typescript/)

This remains useful for a smaller scenario that still demonstrates broad APP
surface coverage, but it preserves the legacy `chatbot` host name and is not the
main MCP-oriented reference.

## What the React example demonstrates

- canonical project structure
- `backend`, `portal`, and `agent` hosts
- domain, API, UI, and agentic surfaces
- HTTP, MCP `stdio`, and remote MCP publication from the same agent host
- end-to-end smoke validation across backend and agent runtime boundaries

## Run the React example

```bash
npm --prefix ../examples/react ci
npm --prefix ../examples/react run smoke
```

Expected output:

- backend and agent host boot logs
- HTTP smoke passing
- agentic HTTP smoke passing
- MCP stdio smoke passing
- remote MCP HTTP smoke passing

## What the TypeScript example demonstrates

- canonical project structure
- multiple Cases
- domain, API, UI, stream, and agentic surfaces
- backend and agent hosts using the legacy `chatbot` host name
- declarative stream recovery
- cross-case orchestration through `ctx.cases`
- end-to-end scenario execution
- `test()` execution across the illustrative surfaces

## Run the TypeScript example

```bash
npm --prefix ../examples/typescript ci
npm --prefix ../examples/typescript run start
```

Expected output:

- host boot logs
- one full scenario
- test execution
- all tests passing

## Other example directories

The repository also contains placeholder example folders for future reference implementations:

- [`../examples/node/`](../examples/node/)
- [`../examples/next/`](../examples/next/)
- [`../examples/angular/`](../examples/angular/)
- [`../examples/flutter/`](../examples/flutter/)
- [`../examples/python/`](../examples/python/)
- [`../examples/go/`](../examples/go/)
- [`../examples/.net/`](../examples/.net/)

These folders currently serve as placeholders and roadmap signals rather than complete examples.

## When to use the examples

Use the TypeScript example when you want to:

- see a smaller working APP project end to end
- understand host bootstrapping
- inspect runtime composition behavior
- learn how surfaces fit together
- validate tooling changes against a running reference
- derive the first host app and registry pattern for a new TypeScript APP project
- inspect stream recovery and broader surface coverage in a compact scenario

Use the React example when you want to:

- validate the current `agent` host semantics
- inspect HTTP, MCP `stdio`, and remote MCP publication from the same host
- see the current full reference for app-level agentic conformance
- validate MCP-related tooling changes against a real runnable example

## Read next

- [`getting-started.md`](./getting-started.md)
- [`create-app-project.md`](./create-app-project.md)
- [`add-host-app.md`](./add-host-app.md)
- [`protocol-overview.md`](./protocol-overview.md)
- [`../examples/react/README.md`](../examples/react/README.md)
- [`../examples/typescript/README.md`](../examples/typescript/README.md)
