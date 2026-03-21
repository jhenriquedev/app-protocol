# APP v1.1.1 — packages/design_system/
# Tkinter widget library for the portal host.

from packages.design_system.widgets import (
    AppShell,
    BoardHeader,
    CreateTaskButton,
    EmptyColumnState,
    MoveTaskAction,
    TaskBoard,
    TaskCard,
    TaskColumn,
    TaskFormDialog,
    TaskStatusBadge,
    TASK_STATUSES,
    COLORS,
    PADDING,
)

DesignSystem = {
    "AppShell": AppShell,
    "BoardHeader": BoardHeader,
    "CreateTaskButton": CreateTaskButton,
    "EmptyColumnState": EmptyColumnState,
    "MoveTaskAction": MoveTaskAction,
    "TaskBoard": TaskBoard,
    "TaskCard": TaskCard,
    "TaskColumn": TaskColumn,
    "TaskFormDialog": TaskFormDialog,
    "TaskStatusBadge": TaskStatusBadge,
    "TASK_STATUSES": TASK_STATUSES,
    "COLORS": COLORS,
    "PADDING": PADDING,
}

__all__ = [
    "AppShell",
    "BoardHeader",
    "CreateTaskButton",
    "DesignSystem",
    "EmptyColumnState",
    "MoveTaskAction",
    "TaskBoard",
    "TaskCard",
    "TaskColumn",
    "TaskFormDialog",
    "TaskStatusBadge",
    "TASK_STATUSES",
    "COLORS",
    "PADDING",
]
