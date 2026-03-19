package app.protocol.examples.kotlin.cases.tasks.task_move

import app.protocol.examples.kotlin.core.api.ApiContext
import app.protocol.examples.kotlin.core.api.ApiResponse
import app.protocol.examples.kotlin.core.api.BaseApiCase
import app.protocol.examples.kotlin.core.api.RouteBinding
import app.protocol.examples.kotlin.core.shared.AppCaseError
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

private val json = Json { ignoreUnknownKeys = false }

private data class TaskStore(
    val read: suspend () -> List<JsonObject>,
    val write: suspend (List<JsonObject>) -> Unit,
    val reset: (suspend () -> Unit)?,
    val update: suspend (suspend (List<JsonObject>) -> List<JsonObject>) -> List<JsonObject>,
)

private fun mapErrorCodeToStatus(code: String?): Int =
    when (code) {
        "VALIDATION_FAILED" -> 400
        "NOT_FOUND" -> 404
        else -> 500
    }

class TaskMoveApi(
    ctx: ApiContext,
) : BaseApiCase<TaskMoveInput, TaskMoveOutput>(ctx) {
    private val domainCase = TaskMoveDomain()

    override val usesService: Boolean = true

    override suspend fun handler(input: TaskMoveInput): ApiResponse<TaskMoveOutput> {
        val result = execute(input)
        return if (result.success) {
            result.copy(statusCode = 200)
        } else {
            result.copy(statusCode = mapErrorCodeToStatus(result.error?.code))
        }
    }

    override fun router(): RouteBinding =
        RouteBinding(
            method = "PATCH",
            path = "/tasks/:taskId/status",
            handler = { request ->
                val body = request.body as? Map<String, Any?>
                handler(
                    TaskMoveInput(
                        taskId = request.params["taskId"].orEmpty(),
                        targetStatus = body?.get("targetStatus") as? String ?: "",
                    ),
                )
            },
        )

    override suspend fun test() {
        val store = resolveTaskStore()
        store.reset?.invoke()
        store.write(
            listOf(
                json.encodeToJsonElement(
                    Task.serializer(),
                    Task(
                        id = "task_001",
                        title = "Ship the Kotlin example",
                        status = "todo",
                        createdAt = "2026-03-18T12:00:00Z",
                        updatedAt = "2026-03-18T12:00:00Z",
                    ),
                ).jsonObject,
            ),
        )

        val movedResult = handler(TaskMoveInput(taskId = "task_001", targetStatus = "doing"))
        check(movedResult.success && movedResult.data != null) {
            "test: move should return success"
        }
        check(movedResult.data.task.status == "doing") {
            "test: task status must change to doing"
        }
        val persisted = store.read()
        val persistedTask = json.decodeFromJsonElement(Task.serializer(), persisted.first())
        check(persistedTask.status == "doing") {
            "test: moved status must persist"
        }
    }

    override suspend fun _validate(input: TaskMoveInput) {
        try {
            domainCase.validate(input)
        } catch (error: IllegalArgumentException) {
            throw AppCaseError(
                code = "VALIDATION_FAILED",
                message = error.message ?: "task_move validation failed",
            )
        }
    }

    override fun _repository(): Any = resolveTaskStore()

    @OptIn(ExperimentalTime::class)
    override suspend fun _service(input: TaskMoveInput): TaskMoveOutput {
        val taskStore = resolveTaskStore()
        var output: TaskMoveOutput? = null
        var previousStatus: String? = null

        taskStore.update { tasks ->
            val taskIndex =
                tasks.indexOfFirst { payload ->
                    runCatching {
                        json.decodeFromJsonElement(Task.serializer(), payload).id == input.taskId
                    }.getOrDefault(false)
                }

            if (taskIndex < 0) {
                throw AppCaseError(
                    code = "NOT_FOUND",
                    message = "Task ${input.taskId} was not found",
                )
            }

            val currentTask =
                try {
                    json.decodeFromJsonElement(Task.serializer(), tasks[taskIndex])
                } catch (error: Throwable) {
                    throw AppCaseError(
                        code = "INTERNAL",
                        message = error.message ?: "Persisted task data is invalid",
                    )
                }

            assertTaskRecord(currentTask, "task_move.persisted_task")

            if (currentTask.status == input.targetStatus) {
                output = TaskMoveOutput(task = currentTask)
                domainCase.validateOutput(output!!)
                return@update tasks
            }

            previousStatus = currentTask.status
            val updatedTask =
                currentTask.copy(
                    status = input.targetStatus,
                    updatedAt = Clock.System.now().toString(),
                )

            output = TaskMoveOutput(task = updatedTask)
            domainCase.validateOutput(output!!)

            val updatedTasks = tasks.toMutableList()
            updatedTasks[taskIndex] = json.encodeToJsonElement(Task.serializer(), updatedTask).jsonObject
            updatedTasks
        }

        val resolvedOutput =
            output ?: throw AppCaseError(
                code = "INTERNAL",
                message = "task_move did not produce an output",
            )

        if (previousStatus != null) {
            ctx.logger.info(
                "task_move: task status updated",
                mapOf(
                    "taskId" to resolvedOutput.task.id,
                    "from" to previousStatus,
                    "to" to resolvedOutput.task.status,
                ),
            )
        }

        return resolvedOutput
    }

    @Suppress("UNCHECKED_CAST")
    private fun resolveTaskStore(): TaskStore {
        val providers = ctx.extra?.get("providers") as? Map<String, Any?>
        val rawStore = providers?.get("taskStore") as? Map<String, Any?>
            ?: throw AppCaseError(
                code = "INTERNAL",
                message = "task_move requires a configured taskStore provider",
            )

        return TaskStore(
            read = rawStore["read"] as? (suspend () -> List<JsonObject>)
                ?: throw AppCaseError("INTERNAL", "task_move taskStore.read is missing"),
            write = rawStore["write"] as? (suspend (List<JsonObject>) -> Unit)
                ?: throw AppCaseError("INTERNAL", "task_move taskStore.write is missing"),
            reset = rawStore["reset"] as? (suspend () -> Unit),
            update = rawStore["update"] as? (suspend (suspend (List<JsonObject>) -> List<JsonObject>) -> List<JsonObject>)
                ?: throw AppCaseError("INTERNAL", "task_move taskStore.update is missing"),
        )
    }
}
