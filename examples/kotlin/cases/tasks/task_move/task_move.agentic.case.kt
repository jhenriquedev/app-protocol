package app.protocol.examples.kotlin.cases.tasks.task_move

import app.protocol.examples.kotlin.core.agentic.AgenticContext
import app.protocol.examples.kotlin.core.agentic.AgenticDiscovery
import app.protocol.examples.kotlin.core.agentic.AgenticExecutionContext
import app.protocol.examples.kotlin.core.agentic.AgenticMcpContract
import app.protocol.examples.kotlin.core.agentic.AgenticPolicy
import app.protocol.examples.kotlin.core.agentic.AgenticPrompt
import app.protocol.examples.kotlin.core.agentic.AgenticRagContract
import app.protocol.examples.kotlin.core.agentic.AgenticToolContract
import app.protocol.examples.kotlin.core.agentic.BaseAgenticCase
import app.protocol.examples.kotlin.core.agentic.RagResource
import app.protocol.examples.kotlin.core.api.ApiResponse
import app.protocol.examples.kotlin.core.shared.AppCaseError
import app.protocol.examples.kotlin.core.shared.toAppCaseError

class TaskMoveAgentic(
    ctx: AgenticContext,
) : BaseAgenticCase<TaskMoveInput, TaskMoveOutput>(ctx) {
    override fun domain(): TaskMoveDomain = TaskMoveDomain()

    override fun discovery(): AgenticDiscovery =
        AgenticDiscovery(
            name = domainCaseName() ?: "task_move",
            description = domainDescription() ?: "Move an existing task card to another board column.",
            category = "tasks",
            tags = listOf("tasks", "move", "status"),
            aliases = listOf("move_task", "change_task_status", "advance_task"),
            capabilities = listOf("task_move", "board_mutation"),
            intents = listOf("move a task", "change task status", "advance work on the board"),
        )

    override fun context(): AgenticExecutionContext =
        AgenticExecutionContext(
            requiresAuth = false,
            dependencies = listOf("task_move.domain", "task_move.api", "task_list.agentic"),
            preconditions = listOf("A concrete taskId and a valid targetStatus are required."),
            constraints = listOf(
                "Use task_list first when the user refers to a task ambiguously.",
                "Execution must delegate to the canonical API surface.",
            ),
            notes = listOf(
                "Moving a task is a mutating action and should be confirmed by the host runtime.",
            ),
        )

    override fun prompt(): AgenticPrompt =
        AgenticPrompt(
            purpose = "Move an existing task to todo, doing, or done by task id.",
            whenToUse = listOf(
                "When the user explicitly wants to move an existing task card.",
                "When the user wants to update the progress status of known work.",
            ),
            whenNotToUse = listOf(
                "When the user wants to create a task.",
                "When the user has not provided enough information to identify the task.",
            ),
            constraints = listOf(
                "Do not invent a taskId.",
                "Require confirmation before mutating the board.",
            ),
            reasoningHints = listOf(
                "If the task is ambiguous, list current tasks first and ask the user to confirm the intended card.",
            ),
            expectedOutcome = "The updated task object with the requested target status persisted.",
        )

    override fun tool(): AgenticToolContract<TaskMoveInput, TaskMoveOutput> {
        val inputSchema = domainInputSchema()
            ?: error("task_move.agentic requires domain input schema")
        val outputSchema = domainOutputSchema()
            ?: error("task_move.agentic requires domain output schema")

        return AgenticToolContract(
            name = "task_move",
            description = "Move a task through the canonical API execution flow.",
            inputSchema = inputSchema,
            outputSchema = outputSchema,
            isMutating = true,
            requiresConfirmation = true,
            execute = { input, ctx ->
                val handler = resolveApiHandler(ctx)
                val result = handler(input)
                if (!result.success || result.data == null) {
                    throw toAppCaseError(result.error, "task_move API failed")
                }
                result.data
            },
        )
    }

    override fun mcp(): AgenticMcpContract =
        AgenticMcpContract(
            enabled = true,
            name = "task_move",
            title = "Move Task",
            description = "Move a task between board columns through the canonical APP task_move API flow.",
            metadata = mapOf(
                "category" to "tasks",
                "mutating" to true,
            ),
        )

    override fun rag(): AgenticRagContract =
        AgenticRagContract(
            topics = listOf("task_management", "status_transitions", "board_mutation"),
            resources = listOf(
                RagResource(
                    kind = "case",
                    ref = "tasks/task_move",
                    description = "Canonical board mutation capability for changing task status.",
                ),
                RagResource(
                    kind = "case",
                    ref = "tasks/task_list",
                    description = "Grounding capability used to identify persisted task ids before moving them.",
                ),
            ),
            hints = listOf(
                "Use task_list to ground ambiguous references before proposing or executing a move.",
                "Preserve explicit confirmation because task_move mutates persisted board state.",
            ),
            scope = "project",
            mode = "recommended",
        )

    override fun policy(): AgenticPolicy =
        AgenticPolicy(
            requireConfirmation = true,
            riskLevel = "medium",
            executionMode = "manual-approval",
            limits = listOf(
                "Do not execute a move without explicit confirmation from the host runtime.",
            ),
        )

    override suspend fun test() {
        validateDefinition()
        val definition = definition()
        check(definition.tool.requiresConfirmation == true) {
            "test: task_move tool must require confirmation"
        }
        check(definition.policy?.executionMode == "manual-approval") {
            "test: task_move should default to manual approval"
        }
        check(!definition.rag?.resources.isNullOrEmpty()) {
            "test: task_move should publish semantic RAG resources"
        }

        val example = examples().firstOrNull { it.name == "move_todo_to_doing" }
            ?: error("test: task_move example must exist")
        val successHandler: suspend (TaskMoveInput) -> ApiResponse<TaskMoveOutput> =
            { _: TaskMoveInput ->
                ApiResponse(success = true, data = example.output)
            }
        val failureHandler: suspend (TaskMoveInput) -> ApiResponse<TaskMoveOutput> =
            { _: TaskMoveInput ->
                ApiResponse<TaskMoveOutput>(
                    success = false,
                    error = app.protocol.examples.kotlin.core.shared.AppError(
                        code = "NOT_FOUND",
                        message = "Task missing was not found",
                    ),
                )
            }

        val mockCtx =
            object : AgenticContext {
                override val correlationId: String = "task-move-agentic-test"
                override val executionId: String? = null
                override val tenantId: String? = null
                override val userId: String? = null
                override val logger = this@TaskMoveAgentic.ctx.logger
                override val config = null
                override val packages = null
                override val mcp = null
                override val extra = null
                override val cases =
                    mapOf(
                        "tasks" to mapOf(
                            "task_move" to mapOf(
                                "api" to mapOf(
                                    "handler" to successHandler,
                                ),
                            ),
                        ),
                    )
            }

        val result = tool().execute(example.input, mockCtx)
        check(result.task.status == example.output.task.status) {
            "test: task_move tool must return the moved task"
        }

        val propagatedError =
            runCatching {
                tool().execute(
                    example.input,
                    object : AgenticContext {
                        override val correlationId: String = "task-move-agentic-failure-test"
                        override val executionId: String? = null
                        override val tenantId: String? = null
                        override val userId: String? = null
                        override val logger = this@TaskMoveAgentic.ctx.logger
                        override val config = null
                        override val packages = null
                        override val mcp = null
                        override val extra = null
                        override val cases =
                            mapOf(
                                "tasks" to mapOf(
                                    "task_move" to mapOf(
                                        "api" to mapOf(
                                            "handler" to failureHandler,
                                        ),
                                    ),
                                ),
                            )
                    },
                )
            }.exceptionOrNull()

        check(propagatedError is AppCaseError) {
            "test: task_move must propagate AppCaseError failures"
        }
        check(propagatedError.code == "NOT_FOUND") {
            "test: task_move must preserve NOT_FOUND from API"
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun resolveApiHandler(
        ctx: AgenticContext,
    ): suspend (TaskMoveInput) -> ApiResponse<TaskMoveOutput> {
        val tasks = ctx.cases?.get("tasks") as? Map<String, Any?>
        val taskMove = tasks?.get("task_move") as? Map<String, Any?>
        val api = taskMove?.get("api") as? Map<String, Any?>
        val handler = api?.get("handler") as? (suspend (TaskMoveInput) -> ApiResponse<TaskMoveOutput>)
        return handler ?: throw AppCaseError(
            code = "NOT_FOUND",
            message = "task_move API surface is not registered in ctx.cases",
        )
    }
}
