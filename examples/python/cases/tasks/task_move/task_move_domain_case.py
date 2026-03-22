# ==========================================================================
# APP v1.1.3
# cases/tasks/task_move/task_move_domain_case.py
# --------------------------------------------------------------------------
# Domain surface for the task_move Case.
#
# Responsibility:
# - define shared types and value contracts
# - validate input (pure, no I/O)
# - expose invariants, examples, and schemas
# - no infrastructure access
# ==========================================================================

from __future__ import annotations

from typing import Literal, TypedDict

from core.domain_case import AppSchema, BaseDomainCase, DomainExample
from core.shared.app_structural_contracts import AppCaseError

# ==========================================================================
# Shared types
# --------------------------------------------------------------------------
# Defined in each surface file so Cases remain self-contained.
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
# Helpers
# ==========================================================================

def is_task_status(value: object) -> bool:
    """Return True if value is a valid TaskStatus string."""
    return isinstance(value, str) and value in VALID_STATUSES


def assert_task_record(record: object, source: str = "task_move") -> None:
    """
    Assert that record is a valid Task dict.

    Raises AppCaseError("INTERNAL", ...) when any required field is missing
    or has the wrong type.
    """
    if not isinstance(record, dict):
        raise AppCaseError("INTERNAL", f"{source} must be a dict")

    required_string_fields = ("id", "title", "createdAt", "updatedAt")
    for field in required_string_fields:
        value = record.get(field)
        if not isinstance(value, str) or not value.strip():
            raise AppCaseError("INTERNAL", f"{source}.{field} must be a non-empty string")

    if not is_task_status(record.get("status")):
        raise AppCaseError(
            "INTERNAL",
            f"{source}.status must be one of {', '.join(VALID_STATUSES)}",
        )


# ==========================================================================
# TaskMoveDomain
# ==========================================================================

class TaskMoveDomain(BaseDomainCase[TaskMoveInput, TaskMoveOutput]):
    """Domain surface for the task_move Case."""

    def case_name(self) -> str:
        return "task_move"

    def description(self) -> str:
        return "Moves a task to a different status column on the board."

    def input_schema(self) -> AppSchema:
        return {
            "type": "object",
            "properties": {
                "taskId": {
                    "type": "string",
                    "description": "Identifier of the task that will be moved.",
                },
                "targetStatus": {
                    "type": "string",
                    "description": "Destination board column for the task.",
                    "enum": list(VALID_STATUSES),
                },
            },
            "required": ["taskId", "targetStatus"],
            "additionalProperties": False,
        }

    def output_schema(self) -> AppSchema:
        return {
            "type": "object",
            "properties": {
                "task": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "title": {"type": "string"},
                        "status": {
                            "type": "string",
                            "enum": list(VALID_STATUSES),
                        },
                        "createdAt": {"type": "string"},
                        "updatedAt": {"type": "string"},
                    },
                    "required": ["id", "title", "status", "createdAt", "updatedAt"],
                    "additionalProperties": False,
                },
            },
            "required": ["task"],
            "additionalProperties": False,
        }

    def validate(self, input: TaskMoveInput) -> None:
        """
        Pure input validation. No I/O.

        Raises AppCaseError("VALIDATION_FAILED", ...) on any violation.
        """
        if not isinstance(input, dict):
            raise AppCaseError("VALIDATION_FAILED", "input must be an object")

        task_id = input.get("taskId")
        if task_id is None or not isinstance(task_id, str):
            raise AppCaseError("VALIDATION_FAILED", "taskId is required and must be a string")

        if not task_id.strip():
            raise AppCaseError("VALIDATION_FAILED", "taskId must not be empty")

        target_status = input.get("targetStatus")
        if not is_task_status(target_status):
            raise AppCaseError(
                "VALIDATION_FAILED",
                f"targetStatus must be one of {', '.join(VALID_STATUSES)}",
            )

    def validate_output(self, output: TaskMoveOutput) -> None:
        """
        Assert that output carries a valid task record.

        Used by the API surface after producing or retrieving a task.
        Raises AppCaseError("INTERNAL", ...) when the output is structurally invalid.
        """
        if not isinstance(output, dict):
            raise AppCaseError("INTERNAL", "task_move output must be a dict")

        assert_task_record(output.get("task"), "task_move.output.task")  # type: ignore[arg-type]

    def invariants(self) -> list[str]:
        return [
            "Valid statuses are todo, doing, and done only.",
            "createdAt is immutable — moving a task never changes it.",
            "updatedAt is refreshed when the move changes the task status (non-idempotent).",
            "Moving a task to its current status is idempotent and returns the task unchanged.",
            "The task must exist in the store before it can be moved.",
        ]

    def examples(self) -> list[DomainExample[TaskMoveInput, TaskMoveOutput]]:
        return [
            DomainExample(
                name="move_to_doing",
                description="Move a task from todo to doing.",
                input={"taskId": "task_001", "targetStatus": "doing"},
                output={
                    "task": {
                        "id": "task_001",
                        "title": "Ship the Python example",
                        "status": "doing",
                        "createdAt": "2026-03-18T12:00:00.000000+00:00",
                        "updatedAt": "2026-03-18T12:20:00.000000+00:00",
                    }
                },
            ),
            DomainExample(
                name="idempotent_move",
                description="Moving to the same status returns the task unchanged.",
                input={"taskId": "task_002", "targetStatus": "done"},
                output={
                    "task": {
                        "id": "task_002",
                        "title": "Prepare release notes",
                        "status": "done",
                        "createdAt": "2026-03-18T12:10:00.000000+00:00",
                        "updatedAt": "2026-03-18T12:10:00.000000+00:00",
                    }
                },
            ),
        ]

    def test(self) -> None:
        """Self-contained domain surface test."""

        # --- Structural validation ---
        definition = self.definition()

        if definition["case_name"] != "task_move":
            raise AssertionError("test: case_name must be task_move")

        input_schema = definition["input_schema"]
        required_fields = input_schema.get("required") or []
        if "taskId" not in required_fields:
            raise AssertionError("test: input_schema must require taskId")
        if "targetStatus" not in required_fields:
            raise AssertionError("test: input_schema must require targetStatus")
        if input_schema.get("additionalProperties") is not False:
            raise AssertionError("test: input_schema must set additionalProperties false")

        # --- Valid input accepted ---
        self.validate({"taskId": "task_001", "targetStatus": "doing"})

        # --- Empty taskId rejected ---
        threw = False
        try:
            self.validate({"taskId": "", "targetStatus": "doing"})
        except AppCaseError:
            threw = True
        if not threw:
            raise AssertionError("test: validate must reject empty taskId")

        # --- Invalid targetStatus rejected ---
        threw = False
        try:
            self.validate({"taskId": "task_001", "targetStatus": "invalid"})  # type: ignore[typeddict-item]
        except AppCaseError:
            threw = True
        if not threw:
            raise AssertionError("test: validate must reject invalid targetStatus")

        # --- Examples validation ---
        examples = self.examples()
        if not examples:
            raise AssertionError("test: examples must be defined")

        for example in examples:
            self.validate(example.input)
            if example.output is None:
                raise AssertionError("test: example output must be present")
            self.validate_output(example.output)

        # --- Verify both named examples exist ---
        names = {ex.name for ex in examples}
        if "move_to_doing" not in names:
            raise AssertionError("test: move_to_doing example must be defined")
        if "idempotent_move" not in names:
            raise AssertionError("test: idempotent_move example must be defined")
