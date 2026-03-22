# ==========================================================================
# APP v1.1.3
# cases/tasks/task_create/task_create_api_case.py
# --------------------------------------------------------------------------
# API surface for the task_create Case.
#
# Responsibility:
# - expose the task_create capability via a backend interface
# - validate input by delegating to the domain surface
# - generate id and timestamps, persist via ctx.extra["task_store"]
# - return a structured ApiResponse with HTTP status hint
# ==========================================================================

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal, TypedDict

from core.api_case import ApiContext, ApiResponse, BaseApiCase
from core.shared.app_structural_contracts import AppCaseError

from cases.tasks.task_create.task_create_domain_case import (
    Task,
    TaskCreateDomain,
    TaskCreateInput,
    TaskCreateOutput,
    TaskStatus,
)

# Re-export shared types so consumers can import from this module if needed
__all__ = [
    "TaskCreateApi",
    "Task",
    "TaskCreateInput",
    "TaskCreateOutput",
    "TaskStatus",
]


# ==========================================================================
# Error code -> HTTP status mapping
# ==========================================================================

def _map_error_code_to_status(code: str | None) -> int:
    if code == "VALIDATION_FAILED":
        return 400
    if code == "NOT_FOUND":
        return 404
    return 500


# ==========================================================================
# TaskCreateApi
# ==========================================================================

class TaskCreateApi(BaseApiCase[TaskCreateInput, TaskCreateOutput]):
    """API surface for the task_create Case."""

    def handler(self, input: TaskCreateInput) -> ApiResponse[TaskCreateOutput]:
        """
        Main capability handler.

        Delegates to the execute() pipeline and returns 201 on success.
        """
        result = self.execute(input)

        if result.success:
            return ApiResponse(
                success=True,
                data=result.data,
                status_code=201,
            )

        return ApiResponse(
            success=False,
            error=result.error,
            status_code=_map_error_code_to_status(
                result.error.code if result.error else None
            ),
        )

    def router(self) -> dict[str, Any]:
        """Declare the HTTP transport binding for this Case."""
        return {
            "method": "POST",
            "path": "/tasks",
            "handler": self.handler,
        }

    def _validate(self, input: TaskCreateInput) -> None:
        """Delegate validation to the domain surface."""
        try:
            TaskCreateDomain().validate(input)
        except AppCaseError:
            raise
        except Exception as exc:
            raise AppCaseError(
                "VALIDATION_FAILED",
                str(exc),
            ) from exc

    def _service(self, input: TaskCreateInput) -> TaskCreateOutput:
        """
        Create the task and persist it via the task_store.

        Generates a uuid4 id and ISO-8601 UTC timestamps.
        Accesses the store from self.ctx["extra"]["task_store"].
        """
        task_store = self.ctx["extra"]["task_store"]

        timestamp = datetime.now(timezone.utc).isoformat()
        task: Task = {
            "id": str(uuid.uuid4()),
            "title": input["title"].strip(),
            "status": "todo",
            "createdAt": timestamp,
            "updatedAt": timestamp,
        }

        task_store.update(lambda tasks: tasks + [task])

        self.ctx["logger"].info(
            "task_create: task persisted",
            {"taskId": task["id"], "title": task["title"]},
        )

        return {"task": task}

    def _repository(self) -> Any:
        """
        Not used directly.

        The store is accessed via ctx.extra["task_store"] in _service.
        Provided here for protocol completeness.
        """
        return self.ctx.get("extra", {}).get("task_store")

    def test(self) -> None:
        """Self-contained API surface test."""

        # --- Basic create: success, status todo, uuid id ---
        result = self.handler({"title": "Test task"})

        if not result.success or result.data is None:
            raise AssertionError("test: handler should return success for a valid title")

        if result.status_code != 201:
            raise AssertionError("test: successful create must return status_code 201")

        task = result.data["task"]

        if task["status"] != "todo":
            raise AssertionError("test: created task must start in todo")

        if not task["id"]:
            raise AssertionError("test: created task must have a non-empty id")

        # Verify the id looks like a UUID (36 chars, 4 hyphens)
        if len(task["id"]) != 36 or task["id"].count("-") != 4:
            raise AssertionError("test: task id must be a uuid4")

        if task["createdAt"] != task["updatedAt"]:
            raise AssertionError("test: createdAt and updatedAt must be equal on creation")

        persisted = self.ctx["extra"]["task_store"].read()
        if not any(t["id"] == task["id"] for t in persisted):
            raise AssertionError("test: created task must be persisted in the store")

        # --- Blank title: success=False, VALIDATION_FAILED ---
        bad_result = self.handler({"title": "   "})

        if bad_result.success:
            raise AssertionError("test: blank title must not succeed")

        if bad_result.error is None or bad_result.error.code != "VALIDATION_FAILED":
            raise AssertionError("test: blank title must return VALIDATION_FAILED error code")

        if bad_result.status_code != 400:
            raise AssertionError("test: VALIDATION_FAILED must map to HTTP 400")
