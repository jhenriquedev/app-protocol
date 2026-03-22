# ==========================================================================
# APP v1.1.4
# cases/tasks/task_list/task_list_domain_case.py
# --------------------------------------------------------------------------
# Domain surface for the task_list Case.
#
# Responsibility:
# - define the semantic contract (schemas, invariants, examples)
# - validate input (no extra keys allowed)
# - provide output assertion helpers for use by other surfaces
# - expose pure value-object helpers (is_task_status, assert_task_record)
#
# This surface MUST NOT:
# - access infrastructure or persistence
# - perform any side effects
# - know about HTTP, databases, queues, or UI
# ==========================================================================

from __future__ import annotations

from typing import Any, Literal

from core.domain_case import AppSchema, BaseDomainCase, DomainExample
from core.shared.app_structural_contracts import AppCaseError

# ==========================================================================
# Shared types
# --------------------------------------------------------------------------
# Cases are self-contained — types are redefined per file.
# ==========================================================================

TaskStatus = Literal["todo", "doing", "done"]
VALID_STATUSES = ("todo", "doing", "done")


class Task(dict):  # type: ignore[type-arg]
    """
    Runtime-typed task record.

    Keys: id, title, status, createdAt, updatedAt.
    Defined as a plain dict subclass so TypedDict semantics are preserved
    at the type-checker level without requiring a TypedDict import chain.
    """


class TaskListInput(dict):  # type: ignore[type-arg]
    """Empty input — no filters accepted."""


class TaskListOutput(dict):  # type: ignore[type-arg]
    """Output containing a list of Task records."""


# ==========================================================================
# Helper functions
# ==========================================================================

def is_task_status(value: Any) -> bool:
    """Return True if value is a valid TaskStatus string."""
    return value in VALID_STATUSES


def assert_task_record(record: Any) -> None:
    """
    Assert that a single record conforms to the Task shape.

    Raises AppCaseError("INTERNAL", ...) if a required field is missing
    or the status value is not a valid TaskStatus.
    """
    if not isinstance(record, dict):
        raise AppCaseError("INTERNAL", "Task record must be a dict")

    required = ("id", "title", "status", "createdAt", "updatedAt")
    for field in required:
        if field not in record:
            raise AppCaseError(
                "INTERNAL",
                f"Task record is missing required field: '{field}'",
            )

    if not is_task_status(record["status"]):
        raise AppCaseError(
            "INTERNAL",
            f"Task record has invalid status: '{record['status']}'. "
            f"Valid values: {VALID_STATUSES}",
        )


def assert_task_collection(records: Any) -> None:
    """
    Assert that every item in a collection conforms to the Task shape.

    Raises AppCaseError("INTERNAL", ...) on the first invalid record.
    """
    if not isinstance(records, list):
        raise AppCaseError("INTERNAL", "Task collection must be a list")

    for index, record in enumerate(records):
        try:
            assert_task_record(record)
        except AppCaseError as err:
            raise AppCaseError(
                "INTERNAL",
                f"Corrupted task at index {index}: {err}",
            ) from err


# ==========================================================================
# TaskListDomain
# ==========================================================================

class TaskListDomain(BaseDomainCase[TaskListInput, TaskListOutput]):
    """Domain surface for the task_list Case."""

    # ==================================================================
    # Required semantic metadata
    # ==================================================================

    def case_name(self) -> str:
        """Canonical Case name."""
        return "task_list"

    def description(self) -> str:
        """Semantic description of the capability."""
        return "Lists all tasks from the board ordered by creation date descending."

    def input_schema(self) -> AppSchema:
        """
        Input schema.

        Empty object — no filters or parameters are accepted.
        additionalProperties: false ensures extra keys are caught structurally.
        """
        return {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        }

    def output_schema(self) -> AppSchema:
        """
        Output schema.

        Returns an object containing a `tasks` array. Each element in the
        array is a full Task record with all required fields.
        """
        task_schema: AppSchema = {
            "type": "object",
            "description": "A single task record.",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Unique task identifier.",
                },
                "title": {
                    "type": "string",
                    "description": "Human-readable task title.",
                },
                "status": {
                    "type": "string",
                    "enum": list(VALID_STATUSES),
                    "description": "Current task status.",
                },
                "createdAt": {
                    "type": "string",
                    "description": "ISO 8601 creation timestamp.",
                },
                "updatedAt": {
                    "type": "string",
                    "description": "ISO 8601 last-update timestamp.",
                },
            },
            "required": ["id", "title", "status", "createdAt", "updatedAt"],
            "additionalProperties": False,
        }

        return {
            "type": "object",
            "properties": {
                "tasks": {
                    "type": "array",
                    "description": "All tasks ordered by createdAt descending.",
                    "items": task_schema,
                },
            },
            "required": ["tasks"],
            "additionalProperties": False,
        }

    # ==================================================================
    # Validation
    # ==================================================================

    def validate(self, input: TaskListInput) -> None:  # type: ignore[override]
        """
        Pure input validation.

        The input must be an empty dict — no filter keys are accepted.
        Raises AppCaseError("VALIDATION_FAILED", ...) if any key is present.
        """
        if not isinstance(input, dict):
            raise AppCaseError(
                "VALIDATION_FAILED",
                "Input must be an empty object.",
            )

        extra_keys = list(input.keys())
        if extra_keys:
            raise AppCaseError(
                "VALIDATION_FAILED",
                f"Input must be empty. Unexpected keys: {extra_keys}",
                {"extra_keys": extra_keys},
            )

    def validate_output(self, output: TaskListOutput) -> None:
        """
        Helper that asserts every task in the output has all required fields.

        This is NOT a domain method — it is a helper used by other surfaces
        (e.g. the API surface) to catch corrupted data before returning a
        response.

        Raises AppCaseError("INTERNAL", ...) on corrupted data.
        """
        if not isinstance(output, dict) or "tasks" not in output:
            raise AppCaseError(
                "INTERNAL",
                "Output must be an object with a 'tasks' key.",
            )
        assert_task_collection(output["tasks"])

    # ==================================================================
    # Invariants
    # ==================================================================

    def invariants(self) -> list[str]:
        """
        Domain invariants for the task_list capability.

        These constraints are normative — any surface that reads task data
        must respect them.
        """
        return [
            "Read-only — no mutations are performed.",
            "Order is always createdAt descending (newest first).",
            "All persisted tasks are returned — no filtering, no pagination.",
            "Corrupted records are never silently dropped or coerced.",
        ]

    # ==================================================================
    # Examples
    # ==================================================================

    def examples(self) -> list[DomainExample[TaskListInput, TaskListOutput]]:
        """
        Semantic domain examples.

        Two scenarios:
        1. empty_board — no tasks exist yet.
        2. board_with_tasks — two tasks in different statuses, newest first.
        """
        empty_board: DomainExample[TaskListInput, TaskListOutput] = DomainExample(
            name="empty_board",
            description="Board with no tasks — returns an empty list.",
            input={},
            output={"tasks": []},
        )

        board_with_tasks: DomainExample[TaskListInput, TaskListOutput] = DomainExample(
            name="board_with_tasks",
            description=(
                "Board with two tasks in different statuses. "
                "Newest task appears first (createdAt descending)."
            ),
            input={},
            output={
                "tasks": [
                    {
                        "id": "task-2",
                        "title": "Write tests",
                        "status": "doing",
                        "createdAt": "2024-01-02T10:00:00Z",
                        "updatedAt": "2024-01-02T11:00:00Z",
                    },
                    {
                        "id": "task-1",
                        "title": "Design schema",
                        "status": "done",
                        "createdAt": "2024-01-01T09:00:00Z",
                        "updatedAt": "2024-01-01T15:00:00Z",
                    },
                ]
            },
            notes=[
                "task-2 appears first because its createdAt is newer.",
                "Both tasks pass the structural assertion (all required fields present).",
            ],
        )

        return [empty_board, board_with_tasks]

    # ==================================================================
    # Test
    # ==================================================================

    def test(self) -> None:
        """
        Self-contained domain surface test.

        Covers:
        - definition() returns a valid contract
        - empty input passes validation
        - input with extra keys is rejected
        - schema integrity (both schemas are non-empty dicts)
        - examples are well-formed
        """
        # Validate definition structure
        defn = self.definition()
        assert defn["case_name"] == "task_list", "case_name must be 'task_list'"
        assert defn["description"], "description must be non-empty"
        assert isinstance(defn["input_schema"], dict), "input_schema must be a dict"
        assert isinstance(defn["output_schema"], dict), "output_schema must be a dict"
        assert isinstance(defn["invariants"], list), "invariants must be a list"
        assert len(defn["invariants"]) > 0, "invariants must not be empty"

        # Empty input passes validation — must not raise
        self.validate({})

        # Input with extra keys must raise VALIDATION_FAILED
        try:
            self.validate({"status": "todo"})  # type: ignore[arg-type]
            raise AssertionError("Expected AppCaseError for input with extra keys")
        except AppCaseError as err:
            assert err.code == "VALIDATION_FAILED", (
                f"Expected VALIDATION_FAILED, got {err.code}"
            )

        # Input that is not a dict must raise VALIDATION_FAILED
        try:
            self.validate(None)  # type: ignore[arg-type]
            raise AssertionError("Expected AppCaseError for non-dict input")
        except AppCaseError as err:
            assert err.code == "VALIDATION_FAILED", (
                f"Expected VALIDATION_FAILED, got {err.code}"
            )

        # input_schema must conform to expected structure
        schema = self.input_schema()
        assert schema.get("type") == "object", "input_schema type must be 'object'"
        assert schema.get("additionalProperties") is False, (
            "input_schema must have additionalProperties: false"
        )

        # output_schema must contain a tasks array
        out_schema = self.output_schema()
        assert out_schema.get("type") == "object", "output_schema type must be 'object'"
        assert "tasks" in out_schema.get("properties", {}), (
            "output_schema must have a 'tasks' property"
        )
        assert out_schema["properties"]["tasks"]["type"] == "array", (
            "output_schema tasks must be an array"
        )

        # Examples are well-formed
        examples = self.examples()
        assert len(examples) == 2, "Must have exactly 2 examples"
        names = [ex.name for ex in examples]
        assert "empty_board" in names, "Must have empty_board example"
        assert "board_with_tasks" in names, "Must have board_with_tasks example"

        # Validate output assertion helper — valid output must not raise
        valid_output: TaskListOutput = {  # type: ignore[assignment]
            "tasks": [
                {
                    "id": "t1",
                    "title": "Sample",
                    "status": "todo",
                    "createdAt": "2024-01-01T00:00:00Z",
                    "updatedAt": "2024-01-01T00:00:00Z",
                }
            ]
        }
        self.validate_output(valid_output)

        # validate_output must raise INTERNAL on corrupted record
        corrupted_output: TaskListOutput = {"tasks": [{"id": "t1"}]}  # type: ignore[assignment]
        try:
            self.validate_output(corrupted_output)
            raise AssertionError("Expected AppCaseError for corrupted output")
        except AppCaseError as err:
            assert err.code == "INTERNAL", f"Expected INTERNAL, got {err.code}"

        # is_task_status helper
        assert is_task_status("todo") is True
        assert is_task_status("doing") is True
        assert is_task_status("done") is True
        assert is_task_status("invalid") is False
        assert is_task_status(None) is False

        # assert_task_record helper — valid record must not raise
        assert_task_record({
            "id": "t1",
            "title": "Test",
            "status": "todo",
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z",
        })

        # assert_task_record must raise INTERNAL for missing field
        try:
            assert_task_record({"id": "t1"})
            raise AssertionError("Expected AppCaseError for missing fields")
        except AppCaseError as err:
            assert err.code == "INTERNAL", f"Expected INTERNAL, got {err.code}"

        # assert_task_collection helper — valid list must not raise
        assert_task_collection([])
        assert_task_collection([
            {
                "id": "t1",
                "title": "A",
                "status": "todo",
                "createdAt": "2024-01-01T00:00:00Z",
                "updatedAt": "2024-01-01T00:00:00Z",
            }
        ])

        # assert_task_collection must raise INTERNAL for corrupted list
        try:
            assert_task_collection([{"id": "bad"}])
            raise AssertionError("Expected AppCaseError for corrupted collection")
        except AppCaseError as err:
            assert err.code == "INTERNAL", f"Expected INTERNAL, got {err.code}"
