# APP Examples

This repository contains multiple executable APP examples plus a small set of
planned ecosystem targets.

The root [`../src/`](../src/) tree is the minimal normative TypeScript baseline.
It now includes the canonical `apps/agent/` host and the shared MCP contracts
used by the formal agent-host profile.

## Current executable references

Primary current reference:

- [`../examples/react/`](../examples/react/)

This is the full current reference to run first when you want the active
`apps/agent/` semantics, HTTP publication, local MCP publication, and remote MCP
publication.

Pure TypeScript companion reference:

- [`../examples/typescript/`](../examples/typescript/)

This is the full 100% TypeScript reference without React. It keeps
`backend`, `portal`, and `agent` hosts in plain TypeScript, uses
server-rendered HTML in the web visual host (`apps/portal/`), and exposes the same canonical
agent catalog through HTTP, MCP `stdio`, and remote MCP HTTP.

Full-stack Next.js reference:

- [`../examples/next/`](../examples/next/)

This is the full Next.js web reference when you want the same task-board
capability set as `examples/react/`, but with the web visual host running through
Next.js App Router while preserving the APP host bootstrap in `apps/portal/`.

Node-first companion reference:

- [`../examples/node/`](../examples/node/)

This mirrors the complete task-board capability of the React example while
replacing the frontend runtime with a Node.js web visual host that serves
server-rendered HTML through canonical APP `ui` Cases.

Go-first companion reference:

- [`../examples/go/`](../examples/go/)

This recreates the complete task-board capability of the React example in Go,
including `backend`, `portal`, and `agent` hosts, JSON persistence, HTTP
publication, MCP `stdio`, and remote MCP HTTP publication.

Deno-first companion reference:

- [`../examples/deno/`](../examples/deno/)

This recreates the complete task-board capability of the React example in Deno,
including `backend`, `portal`, and `agent` hosts, JSON persistence, HTTP
publication, MCP `stdio`, and remote MCP HTTP publication.

## What the React example demonstrates

- canonical project structure
- `backend`, `portal`, and `agent` hosts
- domain, API, general visual (`ui`), and agentic surfaces
- HTTP, MCP `stdio`, and remote MCP publication from the same agent host
- end-to-end smoke validation across backend and agent runtime boundaries

## What the Node example demonstrates

- canonical project structure
- `backend`, `portal`, and `agent` hosts
- a Node.js web visual host rendering the board through canonical `ui` surfaces
- domain, API, general visual (`ui`), and agentic surfaces
- HTTP, MCP `stdio`, and remote MCP publication from the same agent host
- end-to-end smoke validation across portal, backend, and agent runtime
  boundaries

## What the Go example demonstrates

- canonical project structure
- `backend`, `portal`, and `agent` hosts
- domain, API, general visual (`ui`), and agentic surfaces in Go
- a Go-native web visual host that still preserves canonical APP `ui` semantics
- HTTP, MCP `stdio`, and remote MCP publication from the same agent host
- end-to-end validation across backend, portal, and agent runtime boundaries

## What the Deno example demonstrates

- canonical project structure
- `backend`, `portal`, and `agent` hosts
- domain, API, general visual (`ui`), and agentic surfaces on a Deno runtime
- a Deno-native backend and agent host while preserving the same APP task-board
  semantics
- HTTP, MCP `stdio`, and remote MCP publication from the same agent host
- end-to-end validation across backend, portal, and agent runtime boundaries

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

## Run the Node example

```bash
npm --prefix ../examples/node ci
npm --prefix ../examples/node run smoke
```

Expected output:

- portal, backend, and agent host boot logs
- backend smoke passing
- portal smoke passing
- agentic HTTP smoke passing
- MCP stdio smoke passing
- remote MCP HTTP smoke passing

## Run the Go example

```bash
go test ./examples/go/...
go run ./examples/go/scripts/smoke
go run ./examples/go/scripts/agentic_smoke
go run ./examples/go/scripts/agent_mcp_http_smoke
go run ./examples/go/scripts/agent_mcp_smoke
```

Expected output:

- backend, portal, and agent host tests passing
- backend smoke passing
- agentic HTTP smoke passing
- MCP stdio smoke passing
- remote MCP HTTP smoke passing

## Run the Deno example

```bash
deno task --cwd ../examples/deno smoke
```

Expected output:

- backend and agent host boot logs
- backend smoke passing
- agentic HTTP smoke passing
- MCP stdio smoke passing
- remote MCP HTTP smoke passing

## What the TypeScript example demonstrates

- canonical project structure
- `backend`, `portal`, and `agent` hosts in plain TypeScript
- server-rendered HTML through canonical `ui` surfaces
- domain, API, general visual (`ui`), and agentic surfaces
- registry-derived tool catalog plus HTTP, MCP `stdio`, and remote MCP HTTP
  publication from the same agent host
- end-to-end scenario execution
- `test()` execution across the implemented surfaces
- `.us.md` support artifacts on every implemented Case

## What the Next.js example demonstrates

- canonical project structure
- `backend`, `portal`, and `agent` hosts
- a Next.js App Router shell delegating to the canonical web visual host bootstrap
- domain, API, general visual (`ui`), and agentic surfaces
- HTTP, MCP `stdio`, and remote MCP publication from the same agent host
- end-to-end smoke validation across portal, backend, and agent runtime
  boundaries

## Run the Next.js example

```bash
npm --prefix ../examples/next ci
npm --prefix ../examples/next run smoke
```

Expected output:

- portal smoke passing
- backend and agent host boot logs
- HTTP smoke passing
- agentic HTTP smoke passing
- MCP stdio smoke passing
- remote MCP HTTP smoke passing

## Run the TypeScript example

```bash
npm --prefix ../examples/typescript ci
npm --prefix ../examples/typescript run smoke
```

Expected output:

- host boot logs
- one full scenario
- test execution
- all tests passing

## Additional complete companion references

The repository also contains more complete companion examples:

- [`../examples/angular/`](../examples/angular/)
- [`../examples/flutter/`](../examples/flutter/)
- [`../examples/java/`](../examples/java/)
- [`../examples/kotlin/`](../examples/kotlin/)

These are complete runnable examples, but they are not the first references to
start from when you want the active TypeScript-facing APP guidance.

## Planned reference

- [`../examples/python/`](../examples/python/)

The Python example remains planned.

## When to use the examples

Use the TypeScript example when you want to:

- inspect a 100% TypeScript APP project end to end
- understand host bootstrapping
- inspect runtime composition behavior
- learn how domain, execution, and visual surfaces fit together
- validate tooling changes against a running reference
- derive the first host app and registry pattern for a new TypeScript APP
  project
- inspect server-rendered `ui` surfaces without React
- validate HTTP, MCP `stdio`, and remote MCP publication in a plain TypeScript
  stack

Use the React example when you want to:

- validate the current `agent` host semantics
- inspect HTTP, MCP `stdio`, and remote MCP publication from the same host
- see the current full reference for app-level agentic conformance
- validate MCP-related tooling changes against a real runnable example

Use the Node example when you want to:

- inspect a complete APP task board without a React runtime
- study a Node.js portal host that still preserves canonical `ui` surface
  semantics
- compare two full APP implementations with the same domain and agentic behavior
  but different portal runtimes
- validate MCP-related tooling changes against a runnable Node portal example

Use the Go example when you want to:

- inspect a full APP implementation in a Go-native stack
- compare APP host/runtime semantics across React, Node.js, and Go
- validate HTTP, remote MCP, and stdio MCP behavior against a runnable Go
  reference
- study how `packages/`, `ctx.packages`, and `ctx.cases` map into idiomatic Go
  without breaking APP grammar

Use the Deno example when you want to:

- inspect a full APP implementation on the Deno runtime
- compare the same task-board capability against the React, Node.js, and Go
  companions with a Deno-native backend and agent host
- validate HTTP, remote MCP, and stdio MCP behavior against a runnable Deno
  reference
- study how the APP host/bootstrap model maps into Deno `serve`, Deno
  subprocesses, and Deno-managed npm/jsr dependencies

Use the Next.js example when you want to:

- inspect a full APP web example using Next.js App Router
- keep `backend` and `agent` as separate APP hosts while changing only the
  portal runtime
- validate that the APP host bootstrap stays in `apps/portal` even when the
  framework requires a root `app/` shell
- validate MCP-related tooling changes against a runnable Next.js portal example

## Read next

- [`getting-started.md`](./getting-started.md)
- [`create-app-project.md`](./create-app-project.md)
- [`add-host-app.md`](./add-host-app.md)
- [`protocol-overview.md`](./protocol-overview.md)
- [`../examples/react/README.md`](../examples/react/README.md)
- [`../examples/node/README.md`](../examples/node/README.md)
- [`../examples/go/README.md`](../examples/go/README.md)
- [`../examples/deno/README.md`](../examples/deno/README.md)
- [`../examples/next/README.md`](../examples/next/README.md)
- [`../examples/typescript/README.md`](../examples/typescript/README.md)
