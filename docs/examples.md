# APP Examples

This repository contains one executable APP reference example and several placeholder example directories for future ecosystem expansion.

## Current executable reference

Primary example:

- [`../examples/typescript/`](../examples/typescript/)

This is the reference implementation to run first.

## What the TypeScript example demonstrates

- canonical project structure
- multiple Cases
- domain, API, UI, stream, and agentic surfaces
- backend and chatbot hosts
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
- [`../examples/react/`](../examples/react/)
- [`../examples/next/`](../examples/next/)
- [`../examples/angular/`](../examples/angular/)
- [`../examples/flutter/`](../examples/flutter/)
- [`../examples/python/`](../examples/python/)
- [`../examples/go/`](../examples/go/)
- [`../examples/.net/`](../examples/.net/)

These folders currently serve as placeholders and roadmap signals rather than complete examples.

## When to use the examples

Use the TypeScript example when you want to:

- see a working APP project end to end
- understand host bootstrapping
- inspect runtime composition behavior
- learn how surfaces fit together
- validate tooling changes against a running reference

## Read next

- [`getting-started.md`](./getting-started.md)
- [`protocol-overview.md`](./protocol-overview.md)
- [`../examples/typescript/README.md`](../examples/typescript/README.md)
