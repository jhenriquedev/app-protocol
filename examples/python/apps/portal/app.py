# ==========================================================================
# APP v1.1.1
# apps/portal/app.py
# --------------------------------------------------------------------------
# Portal host bootstrap.
#
# Responsibilities:
# - create the registry
# - create UiContext per Case instantiation
# - compose the root tkinter window from UI surfaces
# ==========================================================================

from __future__ import annotations

import tkinter as tk
import uuid
from typing import Any

from core.ui_case import UiContext
from apps.portal.registry import PortalConfig, create_registry


# ==========================================================================
# Console logger (portal)
# ==========================================================================

class _ConsoleLogger:
    """Simple console logger for the portal host."""

    def __init__(self, prefix: str = "[portal]") -> None:
        self._prefix = prefix

    def debug(self, message: str, meta: dict[str, Any] | None = None) -> None:
        pass

    def info(self, message: str, meta: dict[str, Any] | None = None) -> None:
        if meta:
            print(f"{self._prefix} {message}", meta)
        else:
            print(f"{self._prefix} {message}")

    def warn(self, message: str, meta: dict[str, Any] | None = None) -> None:
        print(f"{self._prefix} WARN: {message}")

    def error(self, message: str, meta: dict[str, Any] | None = None) -> None:
        print(f"{self._prefix} ERROR: {message}")


# ==========================================================================
# Bootstrap
# ==========================================================================

def bootstrap(config: PortalConfig | None = None) -> dict[str, Any]:
    """
    Bootstrap the portal host.

    Returns a dict with:
    - registry, create_ui_context, render_root
    """
    cfg = config or PortalConfig()
    registry = create_registry(cfg)
    logger = _ConsoleLogger()

    def create_ui_context(extra: dict[str, Any] | None = None) -> UiContext:
        """Create a fresh UiContext."""
        return UiContext(
            correlation_id=str(uuid.uuid4()),
            execution_id=str(uuid.uuid4()),
            logger=logger,
            api=registry["_providers"]["http_client"],
            packages=registry.get("_packages", {}),
            extra=extra or {},
        )

    def render_root(root: tk.Tk) -> tk.Frame:
        """
        Compose the root UI from Case surfaces.

        Follows the same composition pattern as the React example's root.tsx:
        - TaskCreateUi provides the create button + form dialog
        - TaskListUi provides the board with columns
        - TaskMoveUi is instantiated per card as action buttons
        """
        cases = registry["_cases"]["tasks"]
        ds = registry["_packages"]["design_system"]

        AppShell = ds["AppShell"]
        BoardHeader = ds["BoardHeader"]

        shell = AppShell(root)

        # Refresh mechanism: a mutable counter that triggers board reload.
        refresh_counter = {"value": 0}

        def refresh_board() -> None:
            """Trigger a board refresh."""
            refresh_counter["value"] += 1
            _rebuild_board()

        # -- Task Create --
        def on_task_created() -> None:
            refresh_board()

        task_create_ctx = create_ui_context(extra={"on_task_created": on_task_created})
        TaskCreateUiCls = cases["task_create"]["ui"]
        task_create_ui = TaskCreateUiCls(task_create_ctx)
        create_widget = task_create_ui.view()

        BoardHeader(shell, title="Task Board", action_widget=create_widget)

        # -- Board container --
        board_container = tk.Frame(shell, bg="#f0f2f5")
        board_container.pack(fill=tk.BOTH, expand=True)

        # -- Render card actions (TaskMoveUi per card) --
        def render_card_actions(parent: tk.Misc, task: dict[str, Any]) -> tk.Widget | None:
            TaskMoveUiCls = cases["task_move"]["ui"]
            move_ctx = create_ui_context(extra={
                "task": task,
                "on_task_moved": refresh_board,
            })
            move_ui = TaskMoveUiCls(move_ctx)
            return move_ui.view()

        def _rebuild_board() -> None:
            """Clear and re-render the board."""
            for child in board_container.winfo_children():
                child.destroy()

            TaskListUiCls = cases["task_list"]["ui"]
            list_ctx = create_ui_context(extra={
                "refresh_token": refresh_counter["value"],
                "render_card_actions": render_card_actions,
            })
            task_list_ui = TaskListUiCls(list_ctx)
            board_widget = task_list_ui.view()
            if isinstance(board_widget, tk.Widget):
                board_widget.pack(in_=board_container, fill=tk.BOTH, expand=True)

        # Initial render
        _rebuild_board()

        return shell

    return {
        "registry": registry,
        "create_ui_context": create_ui_context,
        "render_root": render_root,
    }
