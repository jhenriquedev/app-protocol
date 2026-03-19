# Design System Package

This package centralizes reusable UI components for the task board example.

Included components:

- `AppShell`
- `BoardHeader`
- `CreateTaskButton`
- `TaskBoard`
- `TaskColumn`
- `TaskCard`
- `TaskStatusBadge`
- `MoveTaskAction`
- `TaskFormModal`
- `EmptyColumnState`

Rules:

- the portal host exposes this package through `_packages`
- UI Cases consume shared UI primitives through `ctx.packages`
- app-specific orchestration stays in the UI Cases, not in the package
