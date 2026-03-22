# ==========================================================================
# APP v1.1.6
# cases/tasks/task_move/task_move_api_case.py
# --------------------------------------------------------------------------
# API surface for the task_move Case.
#
# Responsibility:
# - expose PATCH /tasks/:taskId/status
# - orchestrate validate -> service -> response
# - delegate business logic to _service, infrastructure to task_store
# - no domain logic reimplementation
# ==========================================================================

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Literal, TypedDict

from core.api_case import ApiContext, ApiResponse, BaseApiCase
from core.shared.app_structural_contracts import AppCaseError

from cases.tasks.task_move.task_move_domain_case import (
    VALID_STATUSES,
    TaskMoveDomain,
    TaskMoveInput,
    TaskMoveOutput,
    assert_task_record,
)

# ==========================================================================
# Shared types (self-contained copy)
# ==========================================================================

TaskStatus = Literal["todo", "doing", "done"]


class Task(TypedDict):
    id: str
    title: str
    status: TaskStatus
    createdAt: str
    updatedAt: str


# ==========================================================================
# Task store protocol
# --------------------------------------------------------------------------
# The store is provided by the host via ctx.extra["task_store"].
# It must satisfy: read(), write(), update().
# ==========================================================================

class _TaskStore:
    """Structural description of the task store contract."""

    def read(self) -> list[Any]: ...
    def write(self, data: list[Any]) -> None: ...
    def update(self, updater: Callable[[list[Any]], list[Any]]) -> list[Any]: ...


def _map_error_code_to_status(code: str | None) -> int:
    """Map a business error code to an HTTP status code hint."""
    if code == "VALIDATION_FAILED":
        return 400
    if code == "NOT_FOUND":
        return 404
    return 500


# ==========================================================================
# TaskMoveApi
# ==========================================================================

class TaskMoveApi(BaseApiCase[TaskMoveInput, TaskMoveOutput]):
    """API surface for the task_move Case."""

    def __init__(self, ctx: ApiContext) -> None:
        super().__init__(ctx)
        self._domain = TaskMoveDomain()

    # ==================================================================
    # Required: handler + router
    # ==================================================================

    def handler(self, input: TaskMoveInput) -> ApiResponse[TaskMoveOutput]:
        """
        Main handler. Delegates to execute() and attaches HTTP status codes.

        Returns 200 on success, 400/404/500 on failure.
        """
        result = self.execute(input)

        if result.success:
            result.status_code = 200
            return result

        error_code = result.error.code if result.error else None
        result.status_code = _map_error_code_to_status(error_code)
        return result

    def router(self) -> dict[str, Any]:
        """Declare PATCH /tasks/:taskId/status for the backend host."""
        return {
            "method": "PATCH",
            "path": "/tasks/:taskId/status",
            "handler": self.handler,
        }

    # ==================================================================
    # Protected hooks
    # ==================================================================

    def _validate(self, input: TaskMoveInput) -> None:
        """Delegate input validation to the domain surface."""
        self._domain.validate(input)

    def _service(self, input: TaskMoveInput) -> TaskMoveOutput:
        """
        Move the task in the store.

        Steps:
        1. Find the task by taskId — raise NOT_FOUND if missing.
        2. Assert record integrity via assert_task_record.
        3. If already at targetStatus (idempotent) — return unchanged, log.
        4. Otherwise — update status + updatedAt, persist, log transition.
        5. Return TaskMoveOutput with the (possibly updated) task.

        Corrupted store data is caught and returned as INTERNAL error
        so the handler never throws through.
        """
        task_store = self._resolve_task_store()
        output: TaskMoveOutput | None = None
        previous_status: str | None = None

        def _updater(tasks: list[Any]) -> list[Any]:
            nonlocal output, previous_status

            task_index = next(
                (i for i, t in enumerate(tasks) if isinstance(t, dict) and t.get("id") == input["taskId"]),
                -1,
            )

            if task_index < 0:
                raise AppCaseError(
                    "NOT_FOUND",
                    f"Task {input['taskId']} was not found",
                )

            current_task = tasks[task_index]

            # Guard against corrupted persisted data.
            assert_task_record(current_task, "task_move.persisted_task")

            # Idempotent move: status unchanged, return task as-is.
            if current_task["status"] == input["targetStatus"]:
                output = {"task": dict(current_task)}  # type: ignore[assignment]
                return tasks

            # Non-idempotent move: update status and updatedAt.
            previous_status = current_task["status"]
            updated_task: dict[str, Any] = {
                "id": current_task["id"],
                "title": current_task["title"],
                "status": input["targetStatus"],
                "createdAt": current_task["createdAt"],
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }

            output = {"task": updated_task}  # type: ignore[assignment]

            updated_tasks = list(tasks)
            updated_tasks[task_index] = updated_task
            return updated_tasks

        task_store.update(_updater)

        if output is None:
            raise AppCaseError("INTERNAL", "task_move did not produce an output")

        if previous_status is None:
            # Idempotent path.
            self.ctx["logger"].info(
                "task_move: idempotent move (status unchanged)",
                {"taskId": input["taskId"], "status": input["targetStatus"]},
            )
        else:
            self.ctx["logger"].info(
                "task_move: task status updated",
                {
                    "taskId": output["task"]["id"],
                    "from": previous_status,
                    "to": output["task"]["status"],
                },
            )

        return output

    # ==================================================================
    # Internal helpers
    # ==================================================================

    def _resolve_task_store(self) -> Any:
        """
        Resolve the task store from ctx.extra.

        Raises INTERNAL if the store is missing.
        """
        extra = self.ctx.get("extra") or {}
        task_store = extra.get("task_store")
        if task_store is None:
            raise AppCaseError(
                "INTERNAL",
                "task_move requires a configured task_store in ctx.extra",
            )
        return task_store

    # ==================================================================
    # Test
    # ==================================================================

    def test(self) -> None:
        """Self-contained API surface test."""
        task_store = self._resolve_task_store()

        now = datetime.now(timezone.utc).isoformat()
        task_id = str(uuid.uuid4())

        # Seed the store with one task in todo.
        task_store.write([
            {
                "id": task_id,
                "title": "Ship the Python example",
                "status": "todo",
                "createdAt": now,
                "updatedAt": now,
            }
        ])

        # --- Test 1: successful move to doing ---
        result = self.handler({"taskId": task_id, "targetStatus": "doing"})
        if not result.success or result.data is None:
            raise AssertionError("test: move to doing must succeed")
        if result.data["task"]["status"] != "doing":
            raise AssertionError("test: task status must change to doing")
        if result.status_code != 200:
            raise AssertionError("test: success must return status_code 200")

        moved_updated_at = result.data["task"]["updatedAt"]

        # --- Test 2: idempotent move (same status, updatedAt unchanged) ---
        result_idempotent = self.handler({"taskId": task_id, "targetStatus": "doing"})
        if not result_idempotent.success or result_idempotent.data is None:
            raise AssertionError("test: idempotent move must succeed")
        if result_idempotent.data["task"]["updatedAt"] != moved_updated_at:
            raise AssertionError("test: idempotent move must not change updatedAt")

        # --- Test 3: task not found ---
        result_not_found = self.handler({"taskId": "missing_task_id", "targetStatus": "done"})
        if result_not_found.success:
            raise AssertionError("test: missing task must return failure")
        if result_not_found.error is None or result_not_found.error.code != "NOT_FOUND":
            raise AssertionError("test: missing task must return NOT_FOUND error code")
        if result_not_found.status_code != 404:
            raise AssertionError("test: NOT_FOUND must map to status_code 404")

        # --- Test 4: corrupted data returns INTERNAL (500) ---
        corrupted_id = str(uuid.uuid4())
        task_store.write([
            {
                "id": corrupted_id,
                "title": "",  # empty title — fails assert_task_record
                "status": "todo",
                "createdAt": now,
                "updatedAt": now,
            }
        ])
        result_corrupted = self.handler({"taskId": corrupted_id, "targetStatus": "doing"})
        if result_corrupted.success:
            raise AssertionError("test: corrupted data must return failure")
        if result_corrupted.error is None or result_corrupted.error.code != "INTERNAL":
            raise AssertionError("test: corrupted data must return INTERNAL error code")
        if result_corrupted.status_code != 500:
            raise AssertionError("test: INTERNAL must map to status_code 500")
