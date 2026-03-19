package app.protocol.examples.kotlin.cases.tasks.task_create

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

class TaskCreateAgentic(
    ctx: AgenticContext,
) : BaseAgenticCase<TaskCreateInput, TaskCreateOutput>(ctx) {
    override fun domain(): TaskCreateDomain = TaskCreateDomain()

    override fun discovery(): AgenticDiscovery =
        AgenticDiscovery(
            name = domainCaseName() ?: "task_create",
            description = domainDescription() ?: "Create a new task card for the board.",
            category = "tasks",
            tags = listOf("tasks", "creation", "board"),
            aliases = listOf("create_task", "new_task_card", "add_board_task"),
            capabilities = listOf("task_creation"),
            intents = listOf("create a task", "add a task", "add work to the board"),
        )

    override fun context(): AgenticExecutionContext =
        AgenticExecutionContext(
            requiresAuth = false,
            requiresTenant = false,
            dependencies = listOf("task_create.domain", "task_create.api"),
            preconditions = listOf("A non-empty title must be provided."),
            constraints = listOf(
                "The caller must not provide id, status, createdAt, or updatedAt.",
                "Execution must delegate to the canonical API surface.",
                "Descriptions stay optional and should only be passed when the user supplied them.",
            ),
            notes = listOf(
                "New tasks always start in todo.",
                "The backend is the source of truth for identifiers and timestamps.",
            ),
        )

    override fun prompt(): AgenticPrompt =
        AgenticPrompt(
            purpose = "Create a new task with a required title and an optional description.",
            whenToUse = listOf(
                "When the user asks to create or add a new task card.",
                "When new work needs to be placed into the board backlog.",
            ),
            whenNotToUse = listOf(
                "When the user wants to inspect existing tasks.",
                "When the user wants to move an existing task between columns.",
            ),
            constraints = listOf(
                "Ask for a title if the user did not provide one.",
                "Do not invent backend-controlled fields.",
            ),
            reasoningHints = listOf(
                "Treat description as optional and pass it only when the user gave enough detail.",
                "Prefer concise titles because they are displayed directly on the board card.",
            ),
            expectedOutcome = "A created task object with status todo and backend-generated identity fields.",
        )

    override fun tool(): AgenticToolContract<TaskCreateInput, TaskCreateOutput> {
        val inputSchema = domainInputSchema()
            ?: error("task_create.agentic requires domain input schema")
        val outputSchema = domainOutputSchema()
            ?: error("task_create.agentic requires domain output schema")

        return AgenticToolContract(
            name = "task_create",
            description = "Create a task through the canonical API execution flow.",
            inputSchema = inputSchema,
            outputSchema = outputSchema,
            isMutating = true,
            execute = { input, ctx ->
                val handler = resolveApiHandler(ctx)
                val result = handler(input)
                if (!result.success || result.data == null) {
                    throw toAppCaseError(result.error, "task_create API failed")
                }
                result.data
            },
        )
    }

    override fun mcp(): AgenticMcpContract =
        AgenticMcpContract(
            enabled = true,
            name = "task_create",
            title = "Create Task",
            description = "Create a board task through the canonical APP task_create API flow.",
            metadata = mapOf(
                "category" to "tasks",
                "mutating" to true,
            ),
        )

    override fun rag(): AgenticRagContract =
        AgenticRagContract(
            topics = listOf("task_management", "board_backlog", "task_creation"),
            resources = listOf(
                RagResource(
                    kind = "case",
                    ref = "tasks/task_create",
                    description = "Canonical task creation capability for new board work.",
                ),
                RagResource(
                    kind = "case",
                    ref = "tasks/task_list",
                    description = "Board grounding capability for inspecting current tasks before adding related work.",
                ),
            ),
            hints = listOf(
                "Prefer the canonical backlog language used by the board.",
                "Keep task titles concise because they render directly on cards.",
            ),
            scope = "project",
            mode = "recommended",
        )

    override fun policy(): AgenticPolicy =
        AgenticPolicy(
            requireConfirmation = false,
            riskLevel = "low",
            executionMode = "direct-execution",
            limits = listOf("Use only for explicit task-creation intent."),
        )

    override suspend fun test() {
        validateDefinition()
        val definition = definition()
        check(definition.tool.isMutating == true) {
            "test: task_create agentic must be mutating"
        }
        check(definition.policy?.executionMode == "direct-execution") {
            "test: task_create should default to direct execution"
        }
        check(!definition.rag?.resources.isNullOrEmpty()) {
            "test: task_create should publish semantic RAG resources"
        }

        val example = examples().firstOrNull { it.name == "title_only" }
            ?: error("test: task_create example must exist")
        val successHandler: suspend (TaskCreateInput) -> ApiResponse<TaskCreateOutput> =
            { _: TaskCreateInput ->
                ApiResponse(success = true, data = example.output)
            }
        val failureHandler: suspend (TaskCreateInput) -> ApiResponse<TaskCreateOutput> =
            { _: TaskCreateInput ->
                ApiResponse<TaskCreateOutput>(
                    success = false,
                    error = app.protocol.examples.kotlin.core.shared.AppError(
                        code = "VALIDATION_FAILED",
                        message = "title must not be empty",
                    ),
                )
            }

        val mockCtx =
            object : AgenticContext {
                override val correlationId: String = "task-create-agentic-test"
                override val executionId: String? = null
                override val tenantId: String? = null
                override val userId: String? = null
                override val logger = this@TaskCreateAgentic.ctx.logger
                override val config = null
                override val packages = null
                override val mcp = null
                override val extra = null
                override val cases =
                    mapOf(
                        "tasks" to mapOf(
                            "task_create" to mapOf(
                                "api" to mapOf(
                                    "handler" to successHandler,
                                ),
                            ),
                        ),
                    )
            }

        val result = tool().execute(example.input, mockCtx)
        check(result.task.status == TASK_STATUS_TODO) {
            "test: task_create tool must return a todo task"
        }

        val propagatedError =
            runCatching {
                tool().execute(
                    example.input,
                    object : AgenticContext {
                        override val correlationId: String = "task-create-agentic-failure-test"
                        override val executionId: String? = null
                        override val tenantId: String? = null
                        override val userId: String? = null
                        override val logger = this@TaskCreateAgentic.ctx.logger
                        override val config = null
                        override val packages = null
                        override val mcp = null
                        override val extra = null
                        override val cases =
                            mapOf(
                                "tasks" to mapOf(
                                    "task_create" to mapOf(
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
            "test: task_create must propagate AppCaseError failures"
        }
        check(propagatedError.code == "VALIDATION_FAILED") {
            "test: task_create must preserve validation error codes"
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun resolveApiHandler(
        ctx: AgenticContext,
    ): suspend (TaskCreateInput) -> ApiResponse<TaskCreateOutput> {
        val tasks = ctx.cases?.get("tasks") as? Map<String, Any?>
        val taskCreate = tasks?.get("task_create") as? Map<String, Any?>
        val api = taskCreate?.get("api") as? Map<String, Any?>
        val handler = api?.get("handler") as? (suspend (TaskCreateInput) -> ApiResponse<TaskCreateOutput>)
        return handler ?: throw AppCaseError(
            code = "NOT_FOUND",
            message = "task_create API surface is not registered in ctx.cases",
        )
    }
}
