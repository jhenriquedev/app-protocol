# ==========================================================================
# APP v1.1.1
# cases/tasks/task_create/task_create_agentic_case.py
# --------------------------------------------------------------------------
# Agentic surface for the task_create Case.
#
# Responsibility:
# - make the task_create capability understandable by agents
# - expose discovery, context, prompt, tool, MCP, RAG, and policy
# - delegate real execution to the canonical API surface
# - never reimplement the business logic
# ==========================================================================

from __future__ import annotations

from typing import Any, Literal, TypedDict

from core.agentic_case import (
    AgenticContext,
    AgenticDiscovery,
    AgenticExample,
    AgenticExecutionContext,
    AgenticMcpContract,
    AgenticPolicy,
    AgenticPrompt,
    AgenticRagContract,
    AgenticToolContract,
    BaseAgenticCase,
    RagResource,
)
from core.shared.app_structural_contracts import AppCaseError, to_app_case_error

from cases.tasks.task_create.task_create_domain_case import (
    Task,
    TaskCreateDomain,
    TaskCreateInput,
    TaskCreateOutput,
    TaskStatus,
)

# Re-export shared types
__all__ = [
    "TaskCreateAgentic",
    "Task",
    "TaskCreateInput",
    "TaskCreateOutput",
    "TaskStatus",
]


# ==========================================================================
# TaskCreateAgentic
# ==========================================================================

class TaskCreateAgentic(BaseAgenticCase[TaskCreateInput, TaskCreateOutput]):
    """Agentic surface for the task_create Case."""

    def domain(self) -> TaskCreateDomain:
        """Return the local domain instance for schema and example derivation."""
        return TaskCreateDomain()

    def discovery(self) -> AgenticDiscovery:
        return AgenticDiscovery(
            name="task_create",
            description=(
                self.domain_description()
                or "Create a new task card for the board."
            ),
            category="tasks",
            tags=["task", "create"],
            capabilities=["create_task"],
            intents=["create a new task"],
        )

    def context(self) -> AgenticExecutionContext:
        return AgenticExecutionContext(
            requires_auth=False,
            requires_tenant=False,
            dependencies=[],
            preconditions=[],
            constraints=[
                "A non-empty title must be provided.",
                "The caller must not provide id, status, createdAt, or updatedAt.",
            ],
            notes=[
                "New tasks always start in todo.",
                "The backend is the source of truth for identifiers and timestamps.",
            ],
        )

    def prompt(self) -> AgenticPrompt:
        return AgenticPrompt(
            purpose="Create a new task with a required title.",
            when_to_use=[
                "When the user asks to create or add a new task card.",
                "When new work needs to be placed into the board backlog.",
            ],
            when_not_to_use=[
                "When the user wants to inspect existing tasks.",
                "When the user wants to move an existing task between columns.",
            ],
            constraints=[
                "Ask for a title if the user did not provide one.",
                "Do not invent backend-controlled fields.",
            ],
            expected_outcome=(
                "A created task object with status todo and backend-generated identity fields."
            ),
        )

    def tool(self) -> AgenticToolContract[TaskCreateInput, TaskCreateOutput]:
        """
        Tool contract for task_create.

        execute() delegates to ctx.cases["tasks"]["task_create"]["api"].handler(input).
        """
        input_schema = self.domain_input_schema()
        output_schema = self.domain_output_schema()

        if input_schema is None or output_schema is None:
            raise AppCaseError(
                "INTERNAL",
                "task_create.agentic requires domain schemas",
            )

        def execute(input: TaskCreateInput, ctx: AgenticContext) -> TaskCreateOutput:
            cases: Any = ctx.get("cases", {})
            api_handler = (
                cases.get("tasks", {})
                .get("task_create", {})
                .get("api", {})
                .get("handler")
            )

            if not callable(api_handler):
                raise AppCaseError(
                    "INTERNAL",
                    "task_create.agentic: ctx.cases.tasks.task_create.api.handler is not available",
                )

            result = api_handler(input)

            if not result.success or result.data is None:
                raise to_app_case_error(result.error, "task_create API failed")

            return result.data

        return AgenticToolContract(
            name="task_create",
            description=self.domain_description() or "Create a task through the canonical API execution flow.",
            input_schema=input_schema,
            output_schema=output_schema,
            is_mutating=True,
            requires_confirmation=False,
            execute=execute,
        )

    def mcp(self) -> AgenticMcpContract:
        return AgenticMcpContract(
            enabled=True,
            name="task_create",
            title="Create Task",
        )

    def rag(self) -> AgenticRagContract:
        return AgenticRagContract(
            topics=["task_management"],
            resources=[
                RagResource(
                    kind="case",
                    ref="tasks/task_create",
                    description="Canonical task creation capability for new board work.",
                ),
            ],
            scope="case-local",
            mode="optional",
        )

    def policy(self) -> AgenticPolicy:
        return AgenticPolicy(
            require_confirmation=False,
            risk_level="low",
            execution_mode="direct-execution",
        )

    def examples(self) -> list[AgenticExample[TaskCreateInput, TaskCreateOutput]]:
        """Derive examples from the domain surface."""
        return self.domain_examples() or []

    def test(self) -> None:
        """Self-contained agentic surface test."""

        # --- Structural validation ---
        self.validate_definition()

        definition = self.definition()

        if not definition.tool.is_mutating:
            raise AssertionError("test: task_create agentic must be mutating")

        if definition.policy is None or definition.policy.execution_mode != "direct-execution":
            raise AssertionError("test: task_create should default to direct execution")

        if definition.tool.name != "task_create":
            raise AssertionError("test: tool.name must be task_create")

        if not definition.tool.requires_confirmation:
            pass  # Correct — task_create does not require confirmation

        # --- Verify tool execute delegates correctly via mock context ---
        example = next(
            (e for e in self.examples() if e.name == "title_only"),
            None,
        )
        if example is None:
            raise AssertionError("test: title_only example must exist")

        mock_ctx: AgenticContext = {
            "correlation_id": "task-create-agentic-test",
            "logger": self.ctx["logger"],
            "cases": {
                "tasks": {
                    "task_create": {
                        "api": {
                            "handler": lambda _input: _make_success_response(example.output),
                        },
                    },
                },
            },
        }

        result = self.tool().execute(example.input, mock_ctx)
        if result["task"]["status"] != "todo":
            raise AssertionError("test: tool execute must return a todo task")

        # --- Verify errors propagate correctly ---
        propagated_error: AppCaseError | None = None
        try:
            self.tool().execute(
                example.input,
                {
                    "correlation_id": "task-create-agentic-failure-test",
                    "logger": self.ctx["logger"],
                    "cases": {
                        "tasks": {
                            "task_create": {
                                "api": {
                                    "handler": lambda _input: _make_failure_response(
                                        "VALIDATION_FAILED", "title must not be empty"
                                    ),
                                },
                            },
                        },
                    },
                },
            )
        except AppCaseError as exc:
            propagated_error = exc

        if propagated_error is None:
            raise AssertionError("test: task_create must propagate AppCaseError failures")

        if propagated_error.code != "VALIDATION_FAILED":
            raise AssertionError(
                f"test: task_create must preserve error codes, got {propagated_error.code}"
            )


# ==========================================================================
# Test helpers (module-private)
# ==========================================================================

class _FakeApiResponse:
    """Minimal ApiResponse-like object for test mocks."""

    def __init__(
        self,
        success: bool,
        data: TaskCreateOutput | None = None,
        error_code: str | None = None,
        error_message: str | None = None,
    ) -> None:
        self.success = success
        self.data = data
        from core.shared.app_structural_contracts import AppError
        self.error = (
            AppError(code=error_code or "INTERNAL", message=error_message or "")
            if not success
            else None
        )


def _make_success_response(output: TaskCreateOutput) -> _FakeApiResponse:
    return _FakeApiResponse(success=True, data=output)


def _make_failure_response(code: str, message: str) -> _FakeApiResponse:
    return _FakeApiResponse(success=False, error_code=code, error_message=message)
