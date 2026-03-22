# ==========================================================================
# APP v1.1.4
# cases/tasks/task_list/task_list_ui_case.py
# --------------------------------------------------------------------------
# UI surface for the task_list Case.
#
# Responsibility:
# - present the task board as a three-column tkinter widget
# - group tasks into todo / doing / done columns via _viewmodel
# - fetch tasks from the backend API via _repository
# - pass the render_card_actions callback from ctx.extra to TaskBoard
#
# Canonical grammar:
#   view -> _viewmodel -> _service -> _repository
#
# Framework: tkinter
# Design system: packages/design_system consumed via ctx.packages
# ==========================================================================

from __future__ import annotations

from typing import Any, Callable, Literal

from core.ui_case import BaseUiCase, UiContext
from core.shared.app_structural_contracts import AppCaseError

# ==========================================================================
# Shared types
# --------------------------------------------------------------------------
# Cases are self-contained — types are redefined per file.
# ==========================================================================

TaskStatus = Literal["todo", "doing", "done"]
VALID_STATUSES = ("todo", "doing", "done")


class Task(dict):  # type: ignore[type-arg]
    """Runtime-typed task record (id, title, status, createdAt, updatedAt)."""


class TaskListInput(dict):  # type: ignore[type-arg]
    """Empty input — no filters accepted."""


class TaskListOutput(dict):  # type: ignore[type-arg]
    """Output containing a list of Task records."""


# ==========================================================================
# Column configuration
# --------------------------------------------------------------------------
# Ordered left-to-right: todo, doing, done.
# ==========================================================================

_COLUMN_CONFIG = [
    {
        "status_key": "todo",
        "title": "To Do",
        "empty_message": "No tasks in To Do",
    },
    {
        "status_key": "doing",
        "title": "Doing",
        "empty_message": "No tasks in Doing",
    },
    {
        "status_key": "done",
        "title": "Done",
        "empty_message": "No tasks in Done",
    },
]


# ==========================================================================
# TaskListUi
# ==========================================================================

class TaskListUi(BaseUiCase):
    """UI surface for the task_list Case."""

    # ==================================================================
    # Required: view
    # ==================================================================

    def view(self) -> Any:
        """
        Public entrypoint — returns the TaskBoard tkinter widget.

        Fetches tasks via _service(), groups them via _viewmodel(), then
        renders a TaskBoard with the render_card_actions callback from
        ctx.extra (if provided by the host).
        """
        packages = self.ctx.get("packages", {})
        design_system: dict[str, Any] = packages.get("design_system") or {}
        task_board_cls = design_system.get("TaskBoard")

        if task_board_cls is None:
            raise AppCaseError(
                "INTERNAL",
                "task_list.ui requires packages['design_system']['TaskBoard']",
            )

        tasks: list[dict[str, Any]] = self._service()
        columns = self._viewmodel(tasks)

        render_card_actions: Callable[..., Any] | None = (
            self.ctx.get("extra", {}).get("render_card_actions")
        )

        # TaskBoard requires a tkinter parent; acquire it from ctx.renderer
        # when available, otherwise fall back to a bare tk.Frame stub for
        # environments (tests) that do not provide a renderer.
        renderer = self.ctx.get("renderer")

        board = task_board_cls(
            master=renderer,
            columns=columns,
            render_card_actions=render_card_actions,
        )
        return board

    # ==================================================================
    # Internal slots
    # ==================================================================

    def _viewmodel(self, tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:  # type: ignore[override]
        """
        Transform a flat task list into three column descriptors.

        Groups tasks by status and attaches column titles and empty messages.
        The task order within each column preserves the input order (which
        is expected to be createdAt descending as returned by the API).
        """
        grouped: dict[str, list[dict[str, Any]]] = {
            "todo": [],
            "doing": [],
            "done": [],
        }
        for task in tasks:
            status = task.get("status", "todo")
            if status in grouped:
                grouped[status].append(task)

        columns: list[dict[str, Any]] = []
        for cfg in _COLUMN_CONFIG:
            key = cfg["status_key"]
            columns.append(
                {
                    "status_key": key,
                    "title": cfg["title"],
                    "empty_message": cfg["empty_message"],
                    "tasks": grouped.get(key, []),
                }
            )

        return columns

    def _service(self) -> list[dict[str, Any]]:  # type: ignore[override]
        """
        Fetch tasks from the backend via _repository().

        Returns the list of tasks (may be empty).
        If the fetch fails, returns an empty list and logs the error.
        """
        try:
            result: TaskListOutput = self._repository()
            return result.get("tasks", [])  # type: ignore[return-value]
        except Exception as exc:
            logger = self.ctx.get("logger")
            if logger is not None:
                logger.error(
                    "task_list_ui: failed to fetch tasks",
                    {"error": str(exc)},
                )
            return []

    def _repository(self) -> TaskListOutput:  # type: ignore[override]
        """
        Fetch all tasks from the backend API.

        Calls GET /tasks via ctx.api.request() and returns the unwrapped
        TaskListOutput. The API adapter is expected to unwrap the {success,
        data} envelope and return data directly (or raise on failure).
        """
        api = self.ctx["api"]
        data: Any = api.request({"method": "GET", "path": "/tasks"})

        # The adapter may return the bare tasks list or the full output envelope.
        if isinstance(data, dict) and "tasks" in data:
            return data  # type: ignore[return-value]

        # Gracefully handle adapters that return the tasks list directly.
        if isinstance(data, list):
            return {"tasks": data}  # type: ignore[return-value]

        return {"tasks": []}  # type: ignore[return-value]

    # ==================================================================
    # Test
    # ==================================================================

    def test(self) -> None:
        """
        Minimal structural test for the UI surface.

        Verifies:
        - the class can be instantiated with a minimal UiContext
        - view(), _viewmodel(), _service(), _repository() exist as methods
        - _viewmodel correctly groups tasks into 3 columns
        - _viewmodel assigns correct empty messages when columns are empty
        """
        # Verify all required methods exist.
        assert callable(getattr(self, "view", None)), "view() must exist"
        assert callable(getattr(self, "_viewmodel", None)), "_viewmodel() must exist"
        assert callable(getattr(self, "_service", None)), "_service() must exist"
        assert callable(getattr(self, "_repository", None)), "_repository() must exist"

        # ----------------------------------------------------------------
        # _viewmodel: empty input produces 3 columns with empty tasks
        # ----------------------------------------------------------------
        columns = self._viewmodel([])
        assert len(columns) == 3, "_viewmodel must return exactly 3 columns"

        status_keys = [col["status_key"] for col in columns]
        assert status_keys == ["todo", "doing", "done"], (
            "Columns must be ordered: todo, doing, done"
        )

        for col in columns:
            assert col["tasks"] == [], (
                f"Column '{col['status_key']}' must have empty tasks for empty input"
            )
            assert col["empty_message"], (
                f"Column '{col['status_key']}' must have a non-empty empty_message"
            )

        # ----------------------------------------------------------------
        # _viewmodel: tasks are grouped into the correct columns
        # ----------------------------------------------------------------
        sample_tasks: list[dict[str, Any]] = [
            {
                "id": "t1",
                "title": "Todo task",
                "status": "todo",
                "createdAt": "2024-01-03T00:00:00Z",
                "updatedAt": "2024-01-03T00:00:00Z",
            },
            {
                "id": "t2",
                "title": "Doing task",
                "status": "doing",
                "createdAt": "2024-01-02T00:00:00Z",
                "updatedAt": "2024-01-02T00:00:00Z",
            },
            {
                "id": "t3",
                "title": "Done task",
                "status": "done",
                "createdAt": "2024-01-01T00:00:00Z",
                "updatedAt": "2024-01-01T00:00:00Z",
            },
        ]

        grouped_columns = self._viewmodel(sample_tasks)
        todo_col = next(c for c in grouped_columns if c["status_key"] == "todo")
        doing_col = next(c for c in grouped_columns if c["status_key"] == "doing")
        done_col = next(c for c in grouped_columns if c["status_key"] == "done")

        assert len(todo_col["tasks"]) == 1, "todo column must have 1 task"
        assert todo_col["tasks"][0]["id"] == "t1", "todo column must contain t1"

        assert len(doing_col["tasks"]) == 1, "doing column must have 1 task"
        assert doing_col["tasks"][0]["id"] == "t2", "doing column must contain t2"

        assert len(done_col["tasks"]) == 1, "done column must have 1 task"
        assert done_col["tasks"][0]["id"] == "t3", "done column must contain t3"

        # ----------------------------------------------------------------
        # _viewmodel: empty messages
        # ----------------------------------------------------------------
        assert "To Do" in todo_col["empty_message"], (
            "todo empty_message must reference 'To Do'"
        )
        assert "Doing" in doing_col["empty_message"], (
            "doing empty_message must reference 'Doing'"
        )
        assert "Done" in done_col["empty_message"], (
            "done empty_message must reference 'Done'"
        )
