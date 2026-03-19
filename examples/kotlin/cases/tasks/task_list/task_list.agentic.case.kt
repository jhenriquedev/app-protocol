package app.protocol.examples.kotlin.cases.tasks.task_list

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

class TaskListAgentic(
    ctx: AgenticContext,
) : BaseAgenticCase<TaskListInput, TaskListOutput>(ctx) {
    override fun domain(): TaskListDomain = TaskListDomain()

    override fun discovery(): AgenticDiscovery =
        AgenticDiscovery(
            name = domainCaseName() ?: "task_list",
            description = domainDescription() ?: "List persisted task cards for board rendering.",
            category = "tasks",
            tags = listOf("tasks", "listing", "board"),
            aliases = listOf("list_board_tasks", "show_board", "inspect_board_state"),
            capabilities = listOf("task_listing", "board_grounding"),
            intents = listOf("list tasks", "show the board", "show current tasks"),
        )

    override fun context(): AgenticExecutionContext =
        AgenticExecutionContext(
            requiresAuth = false,
            dependencies = listOf("task_list.domain", "task_list.api"),
            preconditions = listOf("The persisted task store must be readable."),
            constraints = listOf(
                "This capability is read-only.",
                "No filters or pagination are supported in v1.",
            ),
            notes = listOf(
                "Use this capability to ground follow-up decisions before mutating the board.",
            ),
        )

    override fun prompt(): AgenticPrompt =
        AgenticPrompt(
            purpose = "List all persisted tasks so an agent can inspect the board state.",
            whenToUse = listOf(
                "When the user asks to see the board or current tasks.",
                "Before moving a task when the user has not provided an exact task identifier.",
            ),
            whenNotToUse = listOf(
                "When the user wants to create a new task.",
                "When the user already provided a precise task id for a direct move operation.",
            ),
            constraints = listOf(
                "Do not claim support for filters or search in this v1 example.",
            ),
            reasoningHints = listOf(
                "Treat task_list as the canonical grounding step before ambiguous task mutations.",
            ),
            expectedOutcome = "A flat array of task objects ordered by createdAt descending.",
        )

    override fun tool(): AgenticToolContract<TaskListInput, TaskListOutput> {
        val inputSchema = domainInputSchema()
            ?: error("task_list.agentic requires domain input schema")
        val outputSchema = domainOutputSchema()
            ?: error("task_list.agentic requires domain output schema")

        return AgenticToolContract(
            name = "task_list",
            description = "List tasks through the canonical API execution flow.",
            inputSchema = inputSchema,
            outputSchema = outputSchema,
            isMutating = false,
            execute = { input, ctx ->
                val handler = resolveApiHandler(ctx)
                val result = handler(input)
                if (!result.success || result.data == null) {
                    throw toAppCaseError(result.error, "task_list API failed")
                }
                result.data
            },
        )
    }

    override fun mcp(): AgenticMcpContract =
        AgenticMcpContract(
            enabled = true,
            name = "task_list",
            title = "List Tasks",
            description = "Inspect the current task board state through the canonical APP task_list API flow.",
            metadata = mapOf(
                "category" to "tasks",
                "mutating" to false,
            ),
        )

    override fun rag(): AgenticRagContract =
        AgenticRagContract(
            topics = listOf("task_management", "board_state", "task_grounding"),
            resources = listOf(
                RagResource(
                    kind = "case",
                    ref = "tasks/task_list",
                    description = "Canonical board-state capability used for grounding agent decisions.",
                ),
                RagResource(
                    kind = "case",
                    ref = "tasks/task_move",
                    description = "Related board mutation capability that depends on accurate task identification.",
                ),
                RagResource(
                    kind = "case",
                    ref = "tasks/task_create",
                    description = "Related board mutation capability that adds new work into the backlog.",
                ),
            ),
            hints = listOf(
                "Use task_list before ambiguous mutations so the agent grounds itself on persisted ids and statuses.",
            ),
            scope = "project",
            mode = "recommended",
        )

    override fun policy(): AgenticPolicy =
        AgenticPolicy(
            requireConfirmation = false,
            riskLevel = "low",
            executionMode = "direct-execution",
        )

    override suspend fun test() {
        validateDefinition()
        val definition = definition()
        check(definition.tool.isMutating == false) {
            "test: task_list agentic must be read-only"
        }
        check(!definition.rag?.resources.isNullOrEmpty()) {
            "test: task_list should publish semantic RAG resources"
        }

        val example = examples().firstOrNull { it.name == "board_with_cards" }
            ?: error("test: task_list example must exist")
        val successHandler: suspend (TaskListInput) -> ApiResponse<TaskListOutput> =
            { _: TaskListInput ->
                ApiResponse(success = true, data = example.output)
            }
        val failureHandler: suspend (TaskListInput) -> ApiResponse<TaskListOutput> =
            { _: TaskListInput ->
                ApiResponse<TaskListOutput>(
                    success = false,
                    error = app.protocol.examples.kotlin.core.shared.AppError(
                        code = "INTERNAL",
                        message = "Persisted task data is invalid",
                    ),
                )
            }

        val mockCtx =
            object : AgenticContext {
                override val correlationId: String = "task-list-agentic-test"
                override val executionId: String? = null
                override val tenantId: String? = null
                override val userId: String? = null
                override val logger = this@TaskListAgentic.ctx.logger
                override val config = null
                override val packages = null
                override val mcp = null
                override val extra = null
                override val cases =
                    mapOf(
                        "tasks" to mapOf(
                            "task_list" to mapOf(
                                "api" to mapOf(
                                    "handler" to successHandler,
                                ),
                            ),
                        ),
                    )
            }

        val result = tool().execute(example.input, mockCtx)
        check(result.tasks.size == example.output.tasks.size) {
            "test: task_list tool must return the mocked task collection"
        }

        val propagatedError =
            runCatching {
                tool().execute(
                    example.input,
                    object : AgenticContext {
                        override val correlationId: String = "task-list-agentic-failure-test"
                        override val executionId: String? = null
                        override val tenantId: String? = null
                        override val userId: String? = null
                        override val logger = this@TaskListAgentic.ctx.logger
                        override val config = null
                        override val packages = null
                        override val mcp = null
                        override val extra = null
                        override val cases =
                            mapOf(
                                "tasks" to mapOf(
                                    "task_list" to mapOf(
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
            "test: task_list must propagate AppCaseError failures"
        }
        check(propagatedError.code == "INTERNAL") {
            "test: task_list must preserve API error codes"
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun resolveApiHandler(
        ctx: AgenticContext,
    ): suspend (TaskListInput) -> ApiResponse<TaskListOutput> {
        val tasks = ctx.cases?.get("tasks") as? Map<String, Any?>
        val taskList = tasks?.get("task_list") as? Map<String, Any?>
        val api = taskList?.get("api") as? Map<String, Any?>
        val handler = api?.get("handler") as? (suspend (TaskListInput) -> ApiResponse<TaskListOutput>)
        return handler ?: throw AppCaseError(
            code = "NOT_FOUND",
            message = "task_list API surface is not registered in ctx.cases",
        )
    }
}
