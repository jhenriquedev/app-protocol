# ==========================================================================
# APP v1.1.5
# cases/tasks/task_move/task_move_agentic_case.py
# --------------------------------------------------------------------------
# Agentic surface for the task_move Case.
#
# Responsibility:
# - describe the capability to agents via discovery, context, prompt, tool
# - expose MCP, RAG, and policy contracts
# - delegate all real execution to ctx.cases["tasks"]["task_move"]["api"].handler
# - no reimplementation of business logic
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

from cases.tasks.task_move.task_move_domain_case import (
    TaskMoveDomain,
    TaskMoveInput,
    TaskMoveOutput,
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
# TaskMoveAgentic
# ==========================================================================

class TaskMoveAgentic(BaseAgenticCase[TaskMoveInput, TaskMoveOutput]):
    """Agentic surface for the task_move Case."""

    def domain(self) -> TaskMoveDomain:
        """Return a local domain instance for schema and example derivation."""
        return TaskMoveDomain()

    # ==================================================================
    # Required sections
    # ==================================================================

    def discovery(self) -> AgenticDiscovery:
        return AgenticDiscovery(
            name="task_move",
            description=(
                self.domain_description()
                or "Moves a task to a different status column on the board."
            ),
            category="tasks",
            tags=["task", "move", "status"],
            capabilities=["move_task"],
            intents=["move a task", "change task status"],
        )

    def context(self) -> AgenticExecutionContext:
        return AgenticExecutionContext(
            requires_auth=False,
            requires_tenant=False,
            # task_list.agentic is listed as a semantic dependency so the agent
            # can ground ambiguous task references before attempting a move.
            dependencies=["task_list.agentic"],
            preconditions=[
                "A concrete taskId must be known before calling this tool.",
                "targetStatus must be one of: todo, doing, done.",
            ],
            constraints=[
                "Do not invent a taskId — use task_list first if the task is ambiguous.",
                "Execution must delegate to the canonical API surface.",
                "Confirmation is required before mutating the board.",
            ],
            notes=[
                "Moving a task is a mutating action. "
                "The host runtime must present confirmation to the user.",
            ],
        )

    def prompt(self) -> AgenticPrompt:
        return AgenticPrompt(
            purpose="Move an existing task to todo, doing, or done by task id.",
            when_to_use=[
                "When the user explicitly wants to move an existing task card.",
                "When the user wants to update the progress status of known work.",
            ],
            when_not_to_use=[
                "When the user wants to create a new task — use task_create instead.",
                "When the user has not provided enough information to identify the task.",
            ],
            constraints=[
                "Do not invent a taskId.",
                "Require explicit confirmation before mutating the board.",
            ],
            reasoning_hints=[
                "If the task is ambiguous, call task_list first and ask the user "
                "to confirm the intended card before executing the move.",
            ],
            expected_outcome=(
                "The updated task object with the requested target status persisted "
                "in the store and reflected in the API response."
            ),
        )

    def tool(self) -> AgenticToolContract[TaskMoveInput, TaskMoveOutput]:
        input_schema = self.domain_input_schema()
        output_schema = self.domain_output_schema()

        if input_schema is None or output_schema is None:
            raise AppCaseError("INTERNAL", "task_move.agentic requires domain schemas")

        def _execute(input: TaskMoveInput, ctx: AgenticContext) -> TaskMoveOutput:
            """
            Delegate execution to the canonical API surface.

            Resolves ctx.cases["tasks"]["task_move"]["api"].handler(input).
            Propagates AppCaseError on failure.
            """
            cases: Any = ctx.get("cases") or {}
            tasks: Any = cases.get("tasks") or {}
            task_move: Any = tasks.get("task_move") or {}
            api: Any = task_move.get("api")

            if api is None:
                raise AppCaseError(
                    "INTERNAL",
                    "task_move.agentic: ctx.cases['tasks']['task_move']['api'] is not available",
                )

            result = api.handler(input)

            if not result.success or result.data is None:
                raise to_app_case_error(result.error, "task_move API failed")

            return result.data

        return AgenticToolContract(
            name="task_move",
            description=(
                "Move a task through the canonical task_move API execution flow. "
                "Requires confirmation — this action mutates the board."
            ),
            input_schema=input_schema,
            output_schema=output_schema,
            is_mutating=True,
            requires_confirmation=True,
            execute=_execute,
        )

    # ==================================================================
    # Optional sections
    # ==================================================================

    def mcp(self) -> AgenticMcpContract:
        return AgenticMcpContract(
            enabled=True,
            name="task_move",
            title="Move Task",
            description=(
                "Move a task between board columns through the canonical APP task_move API flow."
            ),
            metadata={
                "category": "tasks",
                "mutating": True,
            },
        )

    def rag(self) -> AgenticRagContract:
        return AgenticRagContract(
            topics=["task_management", "task_workflow"],
            resources=[
                RagResource(
                    kind="case",
                    ref="tasks/task_move",
                    description=(
                        "Canonical board mutation capability for changing task status."
                    ),
                ),
                RagResource(
                    kind="case",
                    ref="tasks/task_list",
                    description=(
                        "Grounding capability used to identify persisted task ids "
                        "before moving them."
                    ),
                ),
            ],
            hints=[
                "Use task_list to ground ambiguous task references before proposing a move.",
                "Preserve confirmation because task_move mutates persisted board state.",
            ],
            scope="case-local",
            mode="optional",
        )

    def policy(self) -> AgenticPolicy:
        return AgenticPolicy(
            require_confirmation=True,
            risk_level="medium",
            execution_mode="manual-approval",
            limits=[
                "Do not execute a move without explicit confirmation from the host runtime.",
            ],
        )

    def examples(self) -> list[AgenticExample[TaskMoveInput, TaskMoveOutput]]:
        """Fall back to domain examples converted to agentic format."""
        return super().examples()

    # ==================================================================
    # Test
    # ==================================================================

    def test(self) -> None:
        """Self-contained agentic surface test."""

        # --- Test 1: validate_definition passes ---
        self.validate_definition()

        # --- Test 2: tool.requires_confirmation is True ---
        tool = self.tool()
        if not tool.requires_confirmation:
            raise AssertionError("test: task_move tool must require confirmation")

        # --- Test 3: policy.require_confirmation is True ---
        policy = self.policy()
        if not policy.require_confirmation:
            raise AssertionError("test: task_move policy must require confirmation")

        # --- Test 4: verify definition is consistent ---
        definition = self.definition()
        if definition.policy is None:
            raise AssertionError("test: definition must carry a policy")
        if definition.policy.execution_mode != "manual-approval":
            raise AssertionError("test: task_move must default to manual-approval")
        if not definition.rag or not definition.rag.resources:
            raise AssertionError("test: task_move must publish semantic RAG resources")

        # --- Test 5: tool.execute delegates correctly (mock context) ---
        example = next(
            (ex for ex in self.examples() if ex.name == "move_to_doing"),
            None,
        )
        if example is None:
            raise AssertionError("test: move_to_doing example must exist")

        class _MockApi:
            """Mock API surface that returns the example output."""
            def handler(self, _input: TaskMoveInput) -> Any:
                from core.api_case import ApiResponse
                return ApiResponse(success=True, data=example.output, status_code=200)

        mock_ctx: AgenticContext = {
            "correlation_id": "task-move-agentic-test",
            "logger": self.ctx["logger"],
            "cases": {
                "tasks": {
                    "task_move": {
                        "api": _MockApi(),
                    }
                }
            },
        }

        result = tool.execute(example.input, mock_ctx)
        if result["task"]["status"] != example.output["task"]["status"]:
            raise AssertionError("test: tool.execute must return the moved task")

        # --- Test 6: NOT_FOUND error is propagated correctly ---
        class _FailingApi:
            """Mock API surface that returns a NOT_FOUND failure."""
            def handler(self, _input: TaskMoveInput) -> Any:
                from core.api_case import ApiResponse
                from core.shared.app_structural_contracts import AppError
                return ApiResponse(
                    success=False,
                    error=AppError(code="NOT_FOUND", message="Task missing was not found"),
                )

        fail_ctx: AgenticContext = {
            "correlation_id": "task-move-agentic-fail-test",
            "logger": self.ctx["logger"],
            "cases": {
                "tasks": {
                    "task_move": {
                        "api": _FailingApi(),
                    }
                }
            },
        }

        propagated: Exception | None = None
        try:
            tool.execute(example.input, fail_ctx)
        except Exception as exc:
            propagated = exc

        if not isinstance(propagated, AppCaseError):
            raise AssertionError(
                "test: task_move must propagate AppCaseError on API failure"
            )
        if propagated.code != "NOT_FOUND":
            raise AssertionError(
                "test: task_move must preserve NOT_FOUND code from the API"
            )
