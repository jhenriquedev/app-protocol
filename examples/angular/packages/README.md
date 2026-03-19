# Packages

This example plans two shared packages for v1:

- `data` for local persistence primitives and the durable `tasks.json` store
- `design_system` for reusable UI components consumed by the portal

Both packages are selected by hosts and exposed through `ctx.packages`.

Structural status:

- package code created
- packages exposed by the host registries
- cases still need to consume them in the next step
