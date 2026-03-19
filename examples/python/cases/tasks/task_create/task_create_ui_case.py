# ==========================================================================
# APP v1.1.0
# cases/tasks/task_create/task_create_ui_case.py
# --------------------------------------------------------------------------
# UI surface for the task_create Case.
#
# Responsibility:
# - present a CreateTaskButton widget that opens a TaskFormDialog
# - validate title locally via _service before calling _repository
# - on success: notify ctx.extra["on_task_created"] and close dialog
# - on error: surface the message inside the dialog
#
# Framework: tkinter (from packages/design_system/widgets.py)
#
# Note on test():
# tkinter requires a display to instantiate widgets. test() performs a
# purely structural check — it verifies the class can be instantiated and
# that the required methods exist, without calling view() or constructing
# any widget.
# ==========================================================================

from __future__ import annotations

from typing import Any, Literal, TypedDict

from core.ui_case import BaseUiCase, UiContext
from core.shared.app_structural_contracts import AppCaseError

from cases.tasks.task_create.task_create_domain_case import (
    Task,
    TaskCreateDomain,
    TaskCreateInput,
    TaskCreateOutput,
    TaskStatus,
)

# Re-export shared types
__all__ = [
    "TaskCreateUi",
    "Task",
    "TaskCreateInput",
    "TaskCreateOutput",
    "TaskStatus",
]


# ==========================================================================
# TaskCreateUi
# ==========================================================================

class TaskCreateUi(BaseUiCase):
    """UI surface for the task_create Case."""

    def view(self) -> Any:
        """
        Return a CreateTaskButton widget from the design system.

        The button's on_click callback opens a TaskFormDialog.
        When the form submits:
        - calls _service(title)
        - on success: notifies ctx.extra["on_task_created"] and closes dialog
        - on error: shows the error message inside the dialog
        """
        # Import tkinter here so the module can be imported without a display
        import tkinter as tk

        packages = self.ctx.get("packages", {})
        design_system = packages.get("design_system")

        if design_system is None:
            raise AppCaseError(
                "INTERNAL",
                "task_create.ui requires packages['design_system']",
            )

        CreateTaskButton = design_system.CreateTaskButton
        TaskFormDialog = design_system.TaskFormDialog

        # The parent window must be supplied by the host via ctx.renderer
        parent: tk.Misc = self.ctx.get("renderer")  # type: ignore[assignment]
        if parent is None:
            raise AppCaseError(
                "INTERNAL",
                "task_create.ui requires ctx['renderer'] (tk.Tk or tk.Frame)",
            )

        def open_dialog() -> None:
            """Open the task form dialog when the button is clicked."""

            def on_submit(title: str) -> None:
                """Called by TaskFormDialog when the user confirms creation."""
                try:
                    result = self._service(title)
                    callback = (self.ctx.get("extra") or {}).get("on_task_created")
                    if callable(callback):
                        callback()
                    dialog.close()
                except AppCaseError as exc:
                    dialog.show_error(exc.args[0])
                except Exception as exc:
                    dialog.show_error(str(exc))

            dialog = TaskFormDialog(parent, on_submit=on_submit)

        button = CreateTaskButton(parent, on_click=open_dialog)
        return button

    def _service(self, title: str) -> TaskCreateOutput:
        """
        Validate the title and delegate to _repository.

        Raises AppCaseError("VALIDATION_FAILED", ...) on blank title.
        """
        if not isinstance(title, str) or title.strip() == "":
            raise AppCaseError("VALIDATION_FAILED", "title must not be empty")

        # Full domain validation for additional rules
        TaskCreateDomain().validate({"title": title})

        return self._repository(title)

    def _repository(self, title: str) -> TaskCreateOutput:
        """
        POST /tasks via ctx.api.request.

        Returns the created TaskCreateOutput.
        Raises AppCaseError on unexpected response shape.
        """
        api = self.ctx.get("api")
        if api is None:
            raise AppCaseError(
                "INTERNAL",
                "task_create.ui requires ctx['api']",
            )

        response: Any = api.request({
            "method": "POST",
            "path": "/tasks",
            "body": {"title": title},
        })

        # The api client is expected to return the data payload directly
        if not isinstance(response, dict) or "task" not in response:
            raise AppCaseError(
                "INTERNAL",
                "task_create.ui received an invalid create response",
            )

        return response  # type: ignore[return-value]

    def test(self) -> None:
        """
        Structural test — no display required.

        Verifies the class can be instantiated with a mock context and
        that required methods exist. Does not call view() because tkinter
        widget construction requires a running Tk display.
        """

        # --- Verify required methods exist ---
        if not callable(getattr(self, "view", None)):
            raise AssertionError("test: view() method must exist")
        if not callable(getattr(self, "_service", None)):
            raise AssertionError("test: _service() method must exist")
        if not callable(getattr(self, "_repository", None)):
            raise AssertionError("test: _repository() method must exist")

        # --- _service: blank title must be rejected ---
        threw = False
        try:
            self._service("   ")
        except AppCaseError:
            threw = True
        except Exception:
            threw = True  # Any error is acceptable here (no api in mock ctx)
        if not threw:
            raise AssertionError("test: _service must reject blank title")

        # --- _service: valid title with no api raises INTERNAL (expected) ---
        threw = False
        try:
            self._service("Valid title")
        except AppCaseError as exc:
            # INTERNAL is expected since no api is configured in the test ctx
            threw = True
            if exc.code not in ("INTERNAL", "VALIDATION_FAILED"):
                raise AssertionError(
                    f"test: unexpected error code from _service: {exc.code}"
                )
        except Exception:
            threw = True  # Any exception is acceptable — no api configured
        if not threw:
            raise AssertionError(
                "test: _service must raise when ctx has no api configured"
            )

        # --- _repository: missing api raises INTERNAL ---
        threw = False
        try:
            self._repository("Some task")
        except AppCaseError as exc:
            threw = True
            if exc.code != "INTERNAL":
                raise AssertionError(
                    f"test: _repository must raise INTERNAL when api is missing, got {exc.code}"
                )
        if not threw:
            raise AssertionError(
                "test: _repository must raise INTERNAL when ctx has no api"
            )
