# Design System Package

This package owns the shared HTML rendering helpers for the Node task board
portal.

It is exposed by `apps/portal/registry.ts` through `_packages.designSystem` and
consumed by the UI Cases through `ctx.packages`.
