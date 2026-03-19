# ==========================================================================
# APP v1.1.0
# cases/tasks/task_list/task_list_agentic_case.py
# --------------------------------------------------------------------------
# Agentic surface for the task_list Case.
#
# Responsibility:
# - make task_list understandable and executable by agents
# - expose discovery, context, prompt, tool, MCP, RAG, and policy
# - delegate real execution to ctx.cases["tasks"]["task_list"]["api"].handler
#
# Fundamental rule:
# - this surface DOES NOT reimplement the main capability logic
# - it describes and operates the capability via structured contracts
# ==========================================================================

from __future__ import annotations

import uuid
from typing import Any, Literal

from core.agentic_case import (
    AgenticContext,
    AgenticDiscovery,
    AgenticExecutionContext,
    AgenticMcpContract,
    AgenticPolicy,
    AgenticPrompt,
    AgenticRagContract,
    AgenticToolContract,
    BaseAgenticCase,
    RagResource,
)
from core.shared.app_structural_contracts import AppCaseError

from cases.tasks.task_list.task_list_domain_case import TaskListDomain

# ==========================================================================
# Shared types
# --------------------------------------------------------------------------
# Cases are self-contained — types are redefined per file.
# ==========================================================================

TaskStatus = Literal["todo", "doing", "done"]
VALID_STATUSES = ("todo", "doing", "done")


class Task(dict):  # type: ignore[type-arg]
    """Runtime-typed task record (id, title, status, createdAt, updatedAt)."""


class TaskListInput(dict):  # type: ignore[type-arg]
    """Empty input — no filters accepted."""


class TaskListOutput(dict):  # type: ignore[type-arg]
    """Output containing a list of Task records."""


# ==========================================================================
# TaskListAgentic
# ==========================================================================

class TaskListAgentic(BaseAgenticCase[TaskListInput, TaskListOutput]):
    """Agentic surface for the task_list Case."""

    # ==================================================================
    # Optional domain connection
    # ==================================================================

    def domain(self) -> TaskListDomain:
        """Return the local domain instance for schema and description derivation."""
        return TaskListDomain()

    # ==================================================================
    # Required sections
    # ==================================================================

    def discovery(self) -> AgenticDiscovery:
        """
        Discovery metadata.

        Enables agents and tooling to locate and reason about this capability.
        """
        return AgenticDiscovery(
            name="task_list",
            description=self.domain().description(),
            category="tasks",
            tags=["task", "list", "read"],
            capabilities=["list_tasks"],
            intents=[
                "list all tasks",
                "show the board",
            ],
        )

    def context(self) -> AgenticExecutionContext:
        """
        Minimum execution context required for correct operation.

        task_list is a public read — no auth, no tenant, no dependencies.
        """
        return AgenticExecutionContext(
            requires_auth=False,
            requires_tenant=False,
            dependencies=[],
            preconditions=[],
            constraints=[
                "Read-only — does not modify any data.",
                "Returns all tasks; no filtering or pagination is supported.",
            ],
        )

    def prompt(self) -> AgenticPrompt:
        """
        Structured prompt for agents.

        Provides purpose, usage guidance, constraints, and expected outcome
        in natural language so agents can decide when and how to invoke
        this tool without additional context.
        """
        return AgenticPrompt(
            purpose=(
                "List all tasks currently on the board, ordered from newest to oldest. "
                "Returns the full set of tasks across all statuses (todo, doing, done)."
            ),
            when_to_use=[
                "When you need to see the current state of the board.",
                "Before deciding to move a task (to know its current status).",
                "When a user asks to show, list, or display tasks.",
            ],
            when_not_to_use=[
                "When you only need to create a task — use task_create instead.",
                "When you need to move a task — use task_move instead.",
                "When you already have the full task list from a recent call.",
            ],
            constraints=[
                "Read-only — does not create, update, or delete any data.",
                "No filters are accepted — always returns the full task list.",
                "Order is always createdAt descending (newest first); callers must not assume any other order.",
            ],
            reasoning_hints=[
                "If the user asks 'what tasks are there?', call this tool first.",
                "If the tool returns an empty list, the board is empty — do not assume an error.",
            ],
            expected_outcome=(
                "A list of all task records. Each record includes id, title, status, "
                "createdAt, and updatedAt. The list may be empty if no tasks exist."
            ),
        )

    def tool(self) -> AgenticToolContract[TaskListInput, TaskListOutput]:
        """
        Tool contract.

        Execution delegates to the API surface via the cases registry.
        This ensures no shadow logic lives in the agentic surface.
        """
        domain = self.domain()

        def execute(input: TaskListInput, ctx: AgenticContext) -> TaskListOutput:
            """Delegate execution to the canonical API surface."""
            api = ctx["cases"]["tasks"]["task_list"]["api"]
            response = api.handler(input)
            if not response.success:
                error = response.error
                code = error.code if error is not None else "INTERNAL"
                msg = error.message if error is not None else "Unknown error"
                raise AppCaseError(code, msg)
            return response.data  # type: ignore[return-value]

        return AgenticToolContract(
            name="task_list",
            description=domain.description(),
            input_schema=domain.input_schema(),
            output_schema=domain.output_schema(),
            is_mutating=False,
            requires_confirmation=False,
            execute=execute,
        )

    # ==================================================================
    # Optional sections
    # ==================================================================

    def mcp(self) -> AgenticMcpContract:
        """MCP exposure configuration."""
        return AgenticMcpContract(
            enabled=True,
            name="task_list",
            title="List Tasks",
        )

    def rag(self) -> AgenticRagContract:
        """RAG knowledge retrieval contract."""
        return AgenticRagContract(
            topics=["task_management"],
            resources=[
                RagResource(
                    kind="case",
                    ref="tasks/task_list",
                    description="Domain definition and invariants for task_list.",
                ),
                RagResource(
                    kind="file",
                    ref="cases/tasks/task_list/task_list.us.md",
                    description="User story and integration notes for task_list.",
                ),
            ],
            hints=[
                "The list is always ordered by createdAt descending.",
                "An empty list is a valid outcome — it means no tasks exist.",
            ],
            scope="case-local",
            mode="optional",
        )

    def policy(self) -> AgenticPolicy:
        """Execution policy — read-only, low risk, no confirmation required."""
        return AgenticPolicy(
            require_confirmation=False,
            require_auth=False,
            require_tenant=False,
            risk_level="low",
            execution_mode="direct-execution",
        )

    # ==================================================================
    # Test
    # ==================================================================

    def test(self) -> None:
        """
        Self-contained agentic surface test.

        Covers:
        - validate_definition() passes (discovery, tool, prompt are valid)
        - is_mutating is False (read-only contract)
        - tool.execute() delegates correctly to api.handler() with a mock
        """
        # ----------------------------------------------------------------
        # Validate definition
        # ----------------------------------------------------------------
        self.validate_definition()

        # ----------------------------------------------------------------
        # Read-only contract: tool.is_mutating must be False
        # ----------------------------------------------------------------
        tool = self.tool()
        assert tool.is_mutating is False, (
            "task_list tool must not be mutating (read-only operation)"
        )
        assert tool.requires_confirmation is False, (
            "task_list tool must not require confirmation (low-risk read)"
        )

        # ----------------------------------------------------------------
        # MCP is enabled
        # ----------------------------------------------------------------
        mcp = self.mcp()
        assert mcp is not None and mcp.enabled is True, "MCP must be enabled"
        assert mcp.name == "task_list", "MCP name must be 'task_list'"
        assert mcp.title == "List Tasks", "MCP title must be 'List Tasks'"

        # ----------------------------------------------------------------
        # Policy is correct
        # ----------------------------------------------------------------
        policy = self.policy()
        assert policy is not None
        assert policy.risk_level == "low", "Risk level must be 'low'"
        assert policy.execution_mode == "direct-execution", (
            "Execution mode must be 'direct-execution'"
        )
        assert policy.require_confirmation is False, (
            "No confirmation required for read-only operation"
        )

        # ----------------------------------------------------------------
        # tool.execute() delegates to api.handler() — integration test
        # ----------------------------------------------------------------
        from core.api_case import ApiContext
        from cases.tasks.task_list.task_list_api_case import TaskListApi

        class _InMemoryTaskStore:
            def __init__(self, initial_data: list[dict[str, Any]]) -> None:
                self._data = list(initial_data)

            def read(self) -> list[dict[str, Any]]:
                return list(self._data)

            def write(self, tasks: list[dict[str, Any]]) -> None:
                self._data = list(tasks)

        store = _InMemoryTaskStore([
            {
                "id": "task-agentic-1",
                "title": "Agentic test task",
                "status": "todo",
                "createdAt": "2024-06-01T12:00:00Z",
                "updatedAt": "2024-06-01T12:00:00Z",
            }
        ])

        class _NoopLogger:
            def debug(self, msg: str, meta: Any = None) -> None: pass
            def info(self, msg: str, meta: Any = None) -> None: pass
            def warn(self, msg: str, meta: Any = None) -> None: pass
            def error(self, msg: str, meta: Any = None) -> None: pass

        api_ctx: ApiContext = ApiContext(
            correlation_id=str(uuid.uuid4()),
            execution_id=str(uuid.uuid4()),
            logger=_NoopLogger(),
            extra={"task_store": store},
        )
        api_instance = TaskListApi(api_ctx)

        agentic_ctx: AgenticContext = AgenticContext(
            correlation_id=str(uuid.uuid4()),
            execution_id=str(uuid.uuid4()),
            logger=_NoopLogger(),
            cases={
                "tasks": {
                    "task_list": {"api": api_instance},
                }
            },
        )
        agentic = TaskListAgentic(agentic_ctx)

        # Execute via the agentic surface shortcut.
        result = agentic.execute({})
        assert isinstance(result, dict), "execute() must return a dict"
        assert "tasks" in result, "execute() result must have 'tasks' key"
        assert len(result["tasks"]) == 1, "Must return the 1 fixture task"
        assert result["tasks"][0]["id"] == "task-agentic-1", (
            "Must return the correct fixture task"
        )
