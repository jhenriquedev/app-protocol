# ==========================================================================
# APP v1.1.4
# cases/tasks/task_list/task_list_api_case.py
# --------------------------------------------------------------------------
# API surface for the task_list Case.
#
# Responsibility:
# - expose the list-tasks capability via GET /tasks
# - delegate input validation to the domain surface
# - read from task_store, assert output integrity, sort by createdAt desc
# - return a structured ApiResponse (never throw on data corruption)
#
# Execution center: _service (atomic — no cross-case composition)
# ==========================================================================

from __future__ import annotations

import uuid
from typing import Any, Literal

from core.api_case import ApiContext, ApiResponse, BaseApiCase
from core.shared.app_structural_contracts import AppCaseError

from cases.tasks.task_list.task_list_domain_case import (
    VALID_STATUSES,
    TaskListDomain,
    assert_task_collection,
)

# ==========================================================================
# Shared types
# --------------------------------------------------------------------------
# Cases are self-contained — types are redefined per file.
# ==========================================================================

TaskStatus = Literal["todo", "doing", "done"]


class Task(dict):  # type: ignore[type-arg]
    """Runtime-typed task record (id, title, status, createdAt, updatedAt)."""


class TaskListInput(dict):  # type: ignore[type-arg]
    """Empty input — no filters accepted."""


class TaskListOutput(dict):  # type: ignore[type-arg]
    """Output containing a list of Task records."""


# ==========================================================================
# TaskListApi
# ==========================================================================

class TaskListApi(BaseApiCase[TaskListInput, TaskListOutput]):
    """API surface for the task_list Case."""

    # ==================================================================
    # Required: handler and router
    # ==================================================================

    def handler(self, input: TaskListInput) -> ApiResponse[TaskListOutput]:
        """
        Main capability handler.

        Delegates to the standard execute() pipeline which calls
        _validate -> _authorize -> _service in sequence.
        Returns 200 on success, or a structured failure response on error.
        """
        response = self.execute(input)
        if response.success:
            return ApiResponse(success=True, data=response.data, status_code=200)
        return response

    def router(self) -> dict[str, Any]:
        """
        Transport binding for GET /tasks.

        The host/adapter collects router() from each Case to mount routes.
        This method never contains business logic — it only maps the transport.
        """
        return {
            "method": "GET",
            "path": "/tasks",
            "handler": self.handler,
        }

    # ==================================================================
    # Protected hooks
    # ==================================================================

    def _validate(self, input: TaskListInput) -> None:
        """
        Delegate input validation to the domain surface.

        Instantiates a fresh TaskListDomain and calls validate().
        Raises AppCaseError("VALIDATION_FAILED", ...) on invalid input.
        """
        domain = TaskListDomain()
        domain.validate(input)

    def _service(self, input: TaskListInput) -> TaskListOutput:
        """
        Main execution logic (atomic Case).

        Steps:
        1. Read all tasks from ctx.extra["task_store"].
        2. Assert structural integrity via assert_task_collection from domain.
        3. Sort tasks by createdAt descending (newest first).
        4. Return TaskListOutput.

        Corrupted data raises AppCaseError("INTERNAL", ...) which the base
        execute() pipeline catches and wraps into ApiResponse(success=False).
        """
        task_store = self.ctx["extra"]["task_store"]
        raw_tasks: Any = task_store.read()

        assert_task_collection(raw_tasks)

        # Sort by createdAt descending — newest first.
        sorted_tasks = sorted(
            raw_tasks,
            key=lambda t: t.get("createdAt", ""),
            reverse=True,
        )

        return {"tasks": sorted_tasks}  # type: ignore[return-value]

    # ==================================================================
    # Test
    # ==================================================================

    def test(self) -> None:
        """
        Self-contained API surface test.

        Covers:
        - empty store returns empty tasks list
        - store with 2 tasks returns them in createdAt descending order
        - corrupted data returns success=False with INTERNAL error (no throw)
        """
        class _InMemoryTaskStore:
            def __init__(self, initial_data: list[dict[str, Any]]) -> None:
                self._data = list(initial_data)

            def read(self) -> list[dict[str, Any]]:
                return list(self._data)

            def write(self, tasks: list[dict[str, Any]]) -> None:
                self._data = list(tasks)

        class _NoopLogger:
            def debug(self, msg: str, meta: Any = None) -> None: pass
            def info(self, msg: str, meta: Any = None) -> None: pass
            def warn(self, msg: str, meta: Any = None) -> None: pass
            def error(self, msg: str, meta: Any = None) -> None: pass

        # ----------------------------------------------------------------
        # Scenario 1: empty store returns empty tasks
        # ----------------------------------------------------------------
        store = _InMemoryTaskStore([])
        ctx: ApiContext = ApiContext(
            correlation_id=str(uuid.uuid4()),
            execution_id=str(uuid.uuid4()),
            logger=_NoopLogger(),
            extra={"task_store": store},
        )
        api = TaskListApi(ctx)

        response = api.handler({})
        assert response.success is True, "Empty store: response must be success"
        assert response.data is not None, "Empty store: data must not be None"
        assert response.data["tasks"] == [], (
            "Empty store: tasks must be an empty list"
        )
        assert response.status_code == 200, "Success response must be 200"

        # ----------------------------------------------------------------
        # Scenario 2: store with 2 tasks — result ordered newest first
        # ----------------------------------------------------------------
        task_older = {
            "id": "task-1",
            "title": "Older task",
            "status": "todo",
            "createdAt": "2024-01-01T08:00:00Z",
            "updatedAt": "2024-01-01T08:00:00Z",
        }
        task_newer = {
            "id": "task-2",
            "title": "Newer task",
            "status": "doing",
            "createdAt": "2024-01-02T10:00:00Z",
            "updatedAt": "2024-01-02T10:00:00Z",
        }
        store.write([task_older, task_newer])

        response2 = api.handler({})
        assert response2.success is True, "Fixture store: response must be success"
        tasks = response2.data["tasks"]  # type: ignore[index]
        assert len(tasks) == 2, "Must return exactly 2 tasks"
        assert tasks[0]["id"] == "task-2", (
            "Newest task (task-2) must appear first"
        )
        assert tasks[1]["id"] == "task-1", (
            "Older task (task-1) must appear second"
        )

        # ----------------------------------------------------------------
        # Scenario 3: corrupted data returns structured failure — no throw
        # ----------------------------------------------------------------
        store_corrupt = _InMemoryTaskStore([{"id": "bad-task"}])  # type: ignore[list-item]

        ctx_corrupt: ApiContext = ApiContext(
            correlation_id=str(uuid.uuid4()),
            execution_id=str(uuid.uuid4()),
            logger=_NoopLogger(),
            extra={"task_store": store_corrupt},
        )
        api_corrupt = TaskListApi(ctx_corrupt)

        response3 = api_corrupt.handler({})
        assert response3.success is False, (
            "Corrupted data: response must be failure (success=False)"
        )
        assert response3.error is not None, (
            "Corrupted data: error must be present"
        )
        assert response3.error.code == "INTERNAL", (
            f"Corrupted data: expected INTERNAL error, got {response3.error.code}"
        )
