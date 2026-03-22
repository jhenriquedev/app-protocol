# ==========================================================================
# APP v1.1.4
# cases/tasks/task_create/task_create_domain_case.py
# --------------------------------------------------------------------------
# Domain surface for the task_create Case.
#
# Responsibility:
# - define task types and shared contracts
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
# Defined here so each surface file can import what it needs without
# cross-surface coupling. Cases are self-contained.
# ==========================================================================

TaskStatus = Literal["todo", "doing", "done"]


class Task(TypedDict):
    id: str
    title: str
    status: TaskStatus
    createdAt: str
    updatedAt: str


class TaskCreateInput(TypedDict, total=False):
    title: str  # required


class TaskCreateOutput(TypedDict):
    task: Task


# ==========================================================================
# TaskCreateDomain
# ==========================================================================

class TaskCreateDomain(BaseDomainCase[TaskCreateInput, TaskCreateOutput]):
    """Domain surface for the task_create Case."""

    def case_name(self) -> str:
        return "task_create"

    def description(self) -> str:
        return "Creates a new task card for the board with an initial todo status."

    def input_schema(self) -> AppSchema:
        return {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Visible task title shown on the card.",
                },
            },
            "required": ["title"],
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
                            "enum": ["todo", "doing", "done"],
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

    def validate(self, input: TaskCreateInput) -> None:
        """
        Pure input validation. No I/O.

        Raises AppCaseError("VALIDATION_FAILED", ...) on any violation.
        """
        if not isinstance(input, dict):
            raise AppCaseError("VALIDATION_FAILED", "input must be an object")

        title = input.get("title")
        if title is None or not isinstance(title, str):
            raise AppCaseError(
                "VALIDATION_FAILED",
                "title is required and must be a string",
            )

        if title.strip() == "":
            raise AppCaseError("VALIDATION_FAILED", "title must not be empty")

        # Forbidden fields — the backend owns id, status, and timestamps
        forbidden = ["id", "status", "createdAt", "updatedAt"]
        for field in forbidden:
            if field in input:
                raise AppCaseError(
                    "VALIDATION_FAILED",
                    f"{field} must not be provided by the caller",
                )

    def invariants(self) -> list[str]:
        return [
            "Every new task starts with status todo.",
            "The backend is the source of truth for task id and timestamps.",
            "createdAt and updatedAt are equal on first creation.",
        ]

    def examples(self) -> list[DomainExample[TaskCreateInput, TaskCreateOutput]]:
        return [
            DomainExample(
                name="title_only",
                description="Create a task with only the required title.",
                input={"title": "Ship the Python example"},
                output={
                    "task": {
                        "id": "task_001",
                        "title": "Ship the Python example",
                        "status": "todo",
                        "createdAt": "2026-03-18T12:00:00.000000+00:00",
                        "updatedAt": "2026-03-18T12:00:00.000000+00:00",
                    }
                },
            ),
            DomainExample(
                name="title_and_description",
                description="Create a task with a descriptive title.",
                input={"title": "Prepare release notes"},
                output={
                    "task": {
                        "id": "task_002",
                        "title": "Prepare release notes",
                        "status": "todo",
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

        if definition["case_name"] != "task_create":
            raise AssertionError("test: case_name must be task_create")

        input_schema = definition["input_schema"]
        if "title" not in (input_schema.get("required") or []):
            raise AssertionError("test: input_schema must require title")

        if input_schema.get("additionalProperties") is not False:
            raise AssertionError("test: input_schema must set additionalProperties false")

        # --- Valid input accepted ---
        self.validate({"title": "Valid task"})

        # --- Blank title rejected ---
        threw = False
        try:
            self.validate({"title": "   "})
        except AppCaseError:
            threw = True
        if not threw:
            raise AssertionError("test: validate must reject blank title")

        # --- Missing title rejected ---
        threw = False
        try:
            self.validate({})  # type: ignore[arg-type]
        except AppCaseError:
            threw = True
        if not threw:
            raise AssertionError("test: validate must reject missing title")

        # --- Forbidden fields rejected ---
        threw = False
        try:
            self.validate({"title": "Bad task", "status": "todo"})  # type: ignore[typeddict-unknown-key]
        except AppCaseError:
            threw = True
        if not threw:
            raise AssertionError("test: validate must reject forbidden field status")

        threw = False
        try:
            self.validate({"title": "Bad task", "id": "x"})  # type: ignore[typeddict-unknown-key]
        except AppCaseError:
            threw = True
        if not threw:
            raise AssertionError("test: validate must reject forbidden field id")

        # --- Examples validation ---
        examples = self.examples()
        if not examples:
            raise AssertionError("test: examples must be defined")

        for example in examples:
            self.validate(example.input)
            if example.output is None:
                raise AssertionError("test: example output must be present")
            if example.output["task"]["status"] != "todo":
                raise AssertionError("test: example output must start in todo")
            if example.output["task"]["createdAt"] != example.output["task"]["updatedAt"]:
                raise AssertionError("test: example createdAt and updatedAt must be equal on creation")
