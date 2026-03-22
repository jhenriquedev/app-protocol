# ==========================================================================
# APP v1.1.4
# cases/tasks/task_move/task_move_ui_case.py
# --------------------------------------------------------------------------
# UI surface for the task_move Case.
#
# Responsibility:
# - present the MoveTaskAction widget from the design_system package
# - submit moves via the backend API through _service -> _repository
# - manage a submission lock to prevent double-clicks
# - no domain logic reimplementation
#
# Canonical grammar:
#   view -> _service -> _repository -> ctx.api
# ==========================================================================

from __future__ import annotations

from typing import Any, Callable, Literal, TypedDict

from core.ui_case import BaseUiCase, UiContext
from core.shared.app_structural_contracts import AppCaseError

# ==========================================================================
# Shared types (self-contained copy)
# ==========================================================================

TaskStatus = Literal["todo", "doing", "done"]

VALID_STATUSES: tuple[str, ...] = ("todo", "doing", "done")


class Task(TypedDict):
    id: str
    title: str
    status: TaskStatus
    createdAt: str
    updatedAt: str


class TaskMoveInput(TypedDict):
    taskId: str
    targetStatus: TaskStatus


class TaskMoveOutput(TypedDict):
    task: Task


# ==========================================================================
# TaskMoveUi
# ==========================================================================

class TaskMoveUi(BaseUiCase):
    """UI surface for the task_move Case."""

    def __init__(self, ctx: UiContext) -> None:
        super().__init__(ctx, initial_state={"submitting": False, "error": None})
        # Submission lock prevents concurrent/double-click submissions.
        self._move_locked: bool = False

    # ==================================================================
    # Required: view
    # ==================================================================

    def view(self) -> Any:
        """
        Return a MoveTaskAction widget from the design_system package.

        Requires:
        - ctx.extra["task"]: the Task dict whose status will be changed
        - ctx.extra["on_task_moved"]: callback invoked on successful move
        - ctx.packages["design_system"]["MoveTaskAction"]: the widget class
        """
        packages: dict[str, Any] = self.ctx.get("packages") or {}
        design_system: dict[str, Any] = packages.get("design_system") or {}
        move_task_action_cls = design_system.get("MoveTaskAction")

        if move_task_action_cls is None:
            raise AppCaseError(
                "INTERNAL",
                "task_move.ui requires packages.design_system.MoveTaskAction",
            )

        extra: dict[str, Any] = self.ctx.get("extra") or {}
        task: Task | None = extra.get("task")

        if task is None:
            raise AppCaseError("INTERNAL", "task_move.ui requires ctx.extra['task']")

        on_task_moved: Callable[[], None] | None = extra.get("on_task_moved")

        def _on_move(task_id: str, target_status: str) -> None:
            """Handle a move button click from the widget."""
            if not self._acquire_move_lock():
                # Submission already in progress — ignore the click.
                return

            self.set_state({"submitting": True, "error": None})

            try:
                result = self._service(task_id, target_status)
                if on_task_moved is not None:
                    on_task_moved()
                self.set_state({"submitting": False, "error": None})
            except Exception as exc:
                self.set_state({"submitting": False, "error": str(exc)})
            finally:
                self._release_move_lock()

        # The MoveTaskAction widget receives the task dict and the callback.
        return move_task_action_cls(
            master=None,  # Parent frame is provided by the host/portal.
            task=dict(task),
            on_move=_on_move,
        )

    # ==================================================================
    # Protected hooks
    # ==================================================================

    def _service(self, task_id: str, target_status: str) -> TaskMoveOutput:
        """
        Local business logic: validate target_status, then call repository.

        Raises AppCaseError on invalid target_status or API failure.
        """
        if target_status not in VALID_STATUSES:
            raise AppCaseError(
                "VALIDATION_FAILED",
                f"task_move.ui: invalid targetStatus '{target_status}'. "
                f"Must be one of {', '.join(VALID_STATUSES)}",
            )
        return self._repository(task_id, target_status)

    def _repository(self, task_id: str, target_status: str) -> TaskMoveOutput:
        """
        Data access: call PATCH /tasks/{task_id}/status via ctx.api.

        Returns the TaskMoveOutput on success.
        Raises AppCaseError on API failure.
        """
        api = self.ctx.get("api")
        if api is None:
            raise AppCaseError("INTERNAL", "task_move.ui requires ctx.api")

        result: Any = api.request({
            "method": "PATCH",
            "path": f"/tasks/{task_id}/status",
            "body": {"targetStatus": target_status},
        })

        # The FetchHttpAdapter unwraps the envelope — result is the data payload.
        if not isinstance(result, dict) or not isinstance(result.get("task"), dict):
            raise AppCaseError(
                "INTERNAL",
                "task_move.ui received an invalid move response from the API",
            )

        return result  # type: ignore[return-value]

    # ==================================================================
    # Submission lock
    # ==================================================================

    def _acquire_move_lock(self) -> bool:
        """
        Acquire the submission lock.

        Returns True if acquired, False if already locked (reentry rejected).
        """
        if self._move_locked:
            return False
        self._move_locked = True
        return True

    def _release_move_lock(self) -> None:
        """Release the submission lock."""
        self._move_locked = False

    # ==================================================================
    # Test
    # ==================================================================

    def test(self) -> None:
        """Minimal structural test for the UI surface."""

        # --- Test 1: submission lock mechanics ---
        if not self._acquire_move_lock():
            raise AssertionError("test: first lock acquisition must succeed")
        if self._acquire_move_lock():
            raise AssertionError("test: reentry must be rejected while locked")
        self._release_move_lock()
        if not self._acquire_move_lock():
            raise AssertionError("test: lock must be acquirable after release")
        self._release_move_lock()

        # --- Test 2: _service rejects invalid targetStatus ---
        threw = False
        try:
            self._service("any_task_id", "invalid_status")
        except AppCaseError:
            threw = True
        if not threw:
            raise AssertionError("test: _service must reject invalid targetStatus")

        # --- Test 3: view requires design_system ---
        threw = False
        try:
            no_ds_ctx: UiContext = {
                "correlation_id": "test-ui",
                "logger": self.ctx["logger"],
                "packages": {},
                "extra": {"task": {"id": "t1", "title": "T", "status": "todo",
                                   "createdAt": "2026-03-18T00:00:00Z",
                                   "updatedAt": "2026-03-18T00:00:00Z"}},
            }
            no_ds_ui = TaskMoveUi(no_ds_ctx)
            no_ds_ui.view()
        except AppCaseError:
            threw = True
        if not threw:
            raise AssertionError("test: view must raise if design_system is missing")
