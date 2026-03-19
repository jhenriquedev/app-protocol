package app.protocol.examples.kotlin.cases.tasks.task_list

import app.protocol.examples.kotlin.core.api.ApiContext
import app.protocol.examples.kotlin.core.api.ApiResponse
import app.protocol.examples.kotlin.core.api.BaseApiCase
import app.protocol.examples.kotlin.core.api.RouteBinding
import app.protocol.examples.kotlin.core.shared.AppCaseError
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject

private val json = Json { ignoreUnknownKeys = false }

private data class TaskStore(
    val read: suspend () -> List<JsonObject>,
    val write: suspend (List<JsonObject>) -> Unit,
    val reset: (suspend () -> Unit)?,
)

private fun mapErrorCodeToStatus(code: String?): Int =
    when (code) {
        "VALIDATION_FAILED" -> 400
        else -> 500
    }

class TaskListApi(
    ctx: ApiContext,
) : BaseApiCase<TaskListInput, TaskListOutput>(ctx) {
    private val domainCase = TaskListDomain()

    override val usesService: Boolean = true

    override suspend fun handler(input: TaskListInput): ApiResponse<TaskListOutput> {
        val result = execute(input)
        return if (result.success) {
            result.copy(statusCode = 200)
        } else {
            result.copy(statusCode = mapErrorCodeToStatus(result.error?.code))
        }
    }

    override fun router(): RouteBinding =
        RouteBinding(
            method = "GET",
            path = "/tasks",
            handler = { handler(TaskListInput) },
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
                        title = "Older task",
                        status = "todo",
                        createdAt = "2026-03-18T12:00:00Z",
                        updatedAt = "2026-03-18T12:00:00Z",
                    ),
                ).jsonObject,
                json.encodeToJsonElement(
                    Task.serializer(),
                    Task(
                        id = "task_002",
                        title = "Newer task",
                        status = "doing",
                        createdAt = "2026-03-18T12:30:00Z",
                        updatedAt = "2026-03-18T12:30:00Z",
                    ),
                ).jsonObject,
            ),
        )

        val result = handler(TaskListInput)
        check(result.success && result.data != null) {
            "test: handler should return a successful task list"
        }
        check(result.data.tasks.size == 2) {
            "test: task list should return all persisted tasks"
        }
        check(result.data.tasks.first().id == "task_002") {
            "test: task list should sort by createdAt descending"
        }
    }

    override suspend fun _validate(input: TaskListInput) {
        try {
            domainCase.validate(input)
        } catch (error: IllegalArgumentException) {
            throw AppCaseError(
                code = "VALIDATION_FAILED",
                message = error.message ?: "task_list validation failed",
            )
        }
    }

    override fun _repository(): Any = resolveTaskStore()

    override suspend fun _service(input: TaskListInput): TaskListOutput {
        val taskStore = resolveTaskStore()
        val decodedTasks =
            taskStore.read().map { payload ->
                try {
                    json.decodeFromJsonElement(Task.serializer(), payload)
                } catch (error: Throwable) {
                    throw AppCaseError(
                        code = "INTERNAL",
                        message = error.message ?: "Persisted task data is invalid",
                    )
                }
            }

        assertTaskCollection(decodedTasks, "task_list.persisted_tasks")

        val output =
            TaskListOutput(
                tasks = decodedTasks.sortedByDescending { it.createdAt },
            )
        domainCase.validateOutput(output)
        return output
    }

    @Suppress("UNCHECKED_CAST")
    private fun resolveTaskStore(): TaskStore {
        val providers = ctx.extra?.get("providers") as? Map<String, Any?>
        val rawStore = providers?.get("taskStore") as? Map<String, Any?>
            ?: throw AppCaseError(
                code = "INTERNAL",
                message = "task_list requires a configured taskStore provider",
            )

        return TaskStore(
            read = rawStore["read"] as? (suspend () -> List<JsonObject>)
                ?: throw AppCaseError("INTERNAL", "task_list taskStore.read is missing"),
            write = rawStore["write"] as? (suspend (List<JsonObject>) -> Unit)
                ?: throw AppCaseError("INTERNAL", "task_list taskStore.write is missing"),
            reset = rawStore["reset"] as? (suspend () -> Unit),
        )
    }
}
