# ==========================================================================
# APP v1.1.3
# packages/design_system/widgets.py
# --------------------------------------------------------------------------
# Tkinter widget library for the portal host.
#
# Provides reusable, styled components for the task board UI:
# - AppShell: main application frame with header
# - BoardHeader: title bar with create button slot
# - TaskBoard: three-column kanban layout
# - TaskColumn: single column with header and card list
# - TaskCard: individual task card with status badge
# - TaskStatusBadge: colored status indicator
# - MoveTaskAction: button to move a task to a target status
# - TaskFormDialog: modal dialog for creating a new task
# - EmptyColumnState: placeholder message for empty columns
#
# This is a shared package — exposed to Cases via ctx.packages,
# never imported directly by Cases.
# ==========================================================================

from __future__ import annotations

import tkinter as tk
from tkinter import font as tkfont
from typing import Any, Callable

# ==========================================================================
# Style constants
# ==========================================================================

COLORS = {
    "bg": "#f0f2f5",
    "surface": "#ffffff",
    "border": "#d0d7de",
    "text": "#1f2328",
    "text_secondary": "#656d76",
    "primary": "#0969da",
    "primary_hover": "#0550ae",
    "danger": "#cf222e",
    "status_todo": "#ddf4ff",
    "status_todo_text": "#0550ae",
    "status_doing": "#fff8c5",
    "status_doing_text": "#7d4e00",
    "status_done": "#dafbe1",
    "status_done_text": "#116329",
    "column_bg": "#f6f8fa",
}

PADDING = {"xs": 4, "sm": 8, "md": 12, "lg": 16, "xl": 24}

TASK_STATUSES: list[dict[str, str]] = [
    {"key": "todo", "label": "To Do"},
    {"key": "doing", "label": "Doing"},
    {"key": "done", "label": "Done"},
]


# ==========================================================================
# AppShell
# ==========================================================================

class AppShell(tk.Frame):
    """Main application frame with background and padding."""

    def __init__(self, master: tk.Misc, **kwargs: Any) -> None:
        super().__init__(master, bg=COLORS["bg"], **kwargs)
        self.pack(fill=tk.BOTH, expand=True)


# ==========================================================================
# BoardHeader
# ==========================================================================

class BoardHeader(tk.Frame):
    """Title bar with an optional action slot (e.g. create button)."""

    def __init__(
        self,
        master: tk.Misc,
        title: str = "Task Board",
        action_widget: tk.Widget | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(master, bg=COLORS["surface"], **kwargs)
        self.pack(fill=tk.X, padx=PADDING["lg"], pady=(PADDING["lg"], 0))

        inner = tk.Frame(self, bg=COLORS["surface"])
        inner.pack(fill=tk.X, padx=PADDING["md"], pady=PADDING["md"])

        title_font = tkfont.Font(family="Helvetica", size=18, weight="bold")
        label = tk.Label(
            inner, text=title, font=title_font,
            bg=COLORS["surface"], fg=COLORS["text"],
        )
        label.pack(side=tk.LEFT)

        if action_widget is not None:
            action_widget.pack(side=tk.RIGHT)


# ==========================================================================
# TaskStatusBadge
# ==========================================================================

class TaskStatusBadge(tk.Label):
    """Colored status indicator badge."""

    _STATUS_STYLES: dict[str, dict[str, str]] = {
        "todo": {"bg": COLORS["status_todo"], "fg": COLORS["status_todo_text"]},
        "doing": {"bg": COLORS["status_doing"], "fg": COLORS["status_doing_text"]},
        "done": {"bg": COLORS["status_done"], "fg": COLORS["status_done_text"]},
    }

    def __init__(self, master: tk.Misc, status: str, **kwargs: Any) -> None:
        style = self._STATUS_STYLES.get(status, {"bg": "#eee", "fg": "#333"})
        badge_font = tkfont.Font(family="Helvetica", size=10, weight="bold")
        super().__init__(
            master,
            text=status.upper(),
            font=badge_font,
            bg=style["bg"],
            fg=style["fg"],
            padx=PADDING["sm"],
            pady=2,
            **kwargs,
        )


# ==========================================================================
# TaskCard
# ==========================================================================

class TaskCard(tk.Frame):
    """Individual task card with title, status badge, and action slot."""

    def __init__(
        self,
        master: tk.Misc,
        task: dict[str, Any],
        actions_widget: tk.Widget | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(
            master, bg=COLORS["surface"], relief=tk.SOLID,
            borderwidth=1, **kwargs,
        )
        self.pack(fill=tk.X, padx=PADDING["xs"], pady=PADDING["xs"])

        content = tk.Frame(self, bg=COLORS["surface"])
        content.pack(fill=tk.X, padx=PADDING["sm"], pady=PADDING["sm"])

        # Title
        title_font = tkfont.Font(family="Helvetica", size=12)
        title_label = tk.Label(
            content, text=task.get("title", ""),
            font=title_font, bg=COLORS["surface"], fg=COLORS["text"],
            anchor=tk.W, wraplength=200,
        )
        title_label.pack(fill=tk.X)

        # Bottom row: badge + actions
        bottom = tk.Frame(content, bg=COLORS["surface"])
        bottom.pack(fill=tk.X, pady=(PADDING["xs"], 0))

        TaskStatusBadge(bottom, task.get("status", "todo")).pack(side=tk.LEFT)

        if actions_widget is not None:
            actions_widget.pack(side=tk.RIGHT)


# ==========================================================================
# MoveTaskAction
# ==========================================================================

class MoveTaskAction(tk.Frame):
    """Button(s) to move a task to a different status."""

    def __init__(
        self,
        master: tk.Misc,
        task: dict[str, Any],
        on_move: Callable[[str, str], None],
        **kwargs: Any,
    ) -> None:
        super().__init__(master, bg=COLORS["surface"], **kwargs)
        current = task.get("status", "todo")
        task_id = task.get("id", "")
        btn_font = tkfont.Font(family="Helvetica", size=9)

        for status_info in TASK_STATUSES:
            key = status_info["key"]
            if key != current:
                btn = tk.Button(
                    self, text=f"→ {status_info['label']}",
                    font=btn_font, relief=tk.FLAT,
                    bg=COLORS["bg"], fg=COLORS["primary"],
                    cursor="hand2",
                    command=lambda tid=task_id, s=key: on_move(tid, s),
                )
                btn.pack(side=tk.LEFT, padx=2)


# ==========================================================================
# EmptyColumnState
# ==========================================================================

class EmptyColumnState(tk.Label):
    """Placeholder message shown in empty columns."""

    def __init__(self, master: tk.Misc, message: str, **kwargs: Any) -> None:
        msg_font = tkfont.Font(family="Helvetica", size=11, slant="italic")
        super().__init__(
            master, text=message, font=msg_font,
            bg=COLORS["column_bg"], fg=COLORS["text_secondary"],
            pady=PADDING["xl"],
            **kwargs,
        )
        self.pack(fill=tk.X)


# ==========================================================================
# TaskColumn
# ==========================================================================

class TaskColumn(tk.Frame):
    """Single column with header label and scrollable card area."""

    def __init__(
        self,
        master: tk.Misc,
        title: str,
        status_key: str,
        tasks: list[dict[str, Any]],
        empty_message: str = "No tasks",
        render_card_actions: Callable[[tk.Misc, dict[str, Any]], tk.Widget | None] | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(master, bg=COLORS["column_bg"], **kwargs)

        # Column header
        header_font = tkfont.Font(family="Helvetica", size=13, weight="bold")
        header = tk.Label(
            self, text=f"{title} ({len(tasks)})",
            font=header_font, bg=COLORS["column_bg"], fg=COLORS["text"],
            anchor=tk.W,
        )
        header.pack(fill=tk.X, padx=PADDING["sm"], pady=PADDING["sm"])

        # Cards or empty state
        if not tasks:
            EmptyColumnState(self, message=empty_message)
        else:
            for task in tasks:
                actions = None
                if render_card_actions is not None:
                    actions = render_card_actions(self, task)
                TaskCard(self, task=task, actions_widget=actions)


# ==========================================================================
# TaskBoard
# ==========================================================================

class TaskBoard(tk.Frame):
    """Three-column kanban board layout."""

    def __init__(
        self,
        master: tk.Misc,
        columns: list[dict[str, Any]],
        render_card_actions: Callable[[tk.Misc, dict[str, Any]], tk.Widget | None] | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(master, bg=COLORS["bg"], **kwargs)
        self.pack(fill=tk.BOTH, expand=True, padx=PADDING["lg"], pady=PADDING["lg"])

        for i, col in enumerate(columns):
            self.columnconfigure(i, weight=1)
            column_widget = TaskColumn(
                self,
                title=col.get("title", ""),
                status_key=col.get("status_key", ""),
                tasks=col.get("tasks", []),
                empty_message=col.get("empty_message", "No tasks"),
                render_card_actions=render_card_actions,
            )
            column_widget.grid(
                row=0, column=i, sticky="nsew",
                padx=PADDING["xs"], pady=0,
            )


# ==========================================================================
# CreateTaskButton
# ==========================================================================

class CreateTaskButton(tk.Button):
    """Styled button to open the task creation dialog."""

    def __init__(
        self,
        master: tk.Misc,
        on_click: Callable[[], None],
        **kwargs: Any,
    ) -> None:
        btn_font = tkfont.Font(family="Helvetica", size=12, weight="bold")
        super().__init__(
            master, text="+ New Task", font=btn_font,
            bg=COLORS["primary"], fg="white",
            activebackground=COLORS["primary_hover"],
            activeforeground="white",
            relief=tk.FLAT, cursor="hand2",
            padx=PADDING["md"], pady=PADDING["sm"],
            command=on_click,
            **kwargs,
        )


# ==========================================================================
# TaskFormDialog
# ==========================================================================

class TaskFormDialog(tk.Toplevel):
    """Modal dialog for creating a new task."""

    def __init__(
        self,
        master: tk.Misc,
        on_submit: Callable[[str], None],
        **kwargs: Any,
    ) -> None:
        super().__init__(master, **kwargs)
        self.title("Create Task")
        self.geometry("400x200")
        self.resizable(False, False)
        self.configure(bg=COLORS["surface"])
        self.transient(master)
        self.grab_set()

        self._on_submit = on_submit
        self._error_var = tk.StringVar(value="")

        # Title label
        label_font = tkfont.Font(family="Helvetica", size=12)
        tk.Label(
            self, text="Task Title:", font=label_font,
            bg=COLORS["surface"], fg=COLORS["text"],
        ).pack(padx=PADDING["lg"], pady=(PADDING["lg"], PADDING["xs"]), anchor=tk.W)

        # Title entry
        self._title_entry = tk.Entry(self, font=label_font, width=40)
        self._title_entry.pack(padx=PADDING["lg"], pady=PADDING["xs"])
        self._title_entry.focus_set()
        self._title_entry.bind("<Return>", lambda _e: self._handle_submit())

        # Error message
        self._error_label = tk.Label(
            self, textvariable=self._error_var, font=label_font,
            bg=COLORS["surface"], fg=COLORS["danger"],
        )
        self._error_label.pack(padx=PADDING["lg"], pady=PADDING["xs"])

        # Buttons
        btn_frame = tk.Frame(self, bg=COLORS["surface"])
        btn_frame.pack(padx=PADDING["lg"], pady=PADDING["md"])

        btn_font = tkfont.Font(family="Helvetica", size=11, weight="bold")
        tk.Button(
            btn_frame, text="Create", font=btn_font,
            bg=COLORS["primary"], fg="white",
            activebackground=COLORS["primary_hover"],
            relief=tk.FLAT, cursor="hand2",
            command=self._handle_submit,
        ).pack(side=tk.LEFT, padx=PADDING["xs"])

        tk.Button(
            btn_frame, text="Cancel", font=btn_font,
            bg=COLORS["bg"], fg=COLORS["text"],
            relief=tk.FLAT, cursor="hand2",
            command=self.destroy,
        ).pack(side=tk.LEFT, padx=PADDING["xs"])

    def _handle_submit(self) -> None:
        """Validate and submit the form."""
        title = self._title_entry.get().strip()
        if not title:
            self._error_var.set("Title cannot be empty")
            return
        self._error_var.set("")
        self._on_submit(title)

    def show_error(self, message: str) -> None:
        """Display an error message in the dialog."""
        self._error_var.set(message)

    def close(self) -> None:
        """Close the dialog."""
        self.destroy()
