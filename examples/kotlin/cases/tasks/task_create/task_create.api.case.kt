package app.protocol.examples.kotlin.cases.tasks.task_create

import app.protocol.examples.kotlin.core.api.ApiContext
import app.protocol.examples.kotlin.core.api.ApiResponse
import app.protocol.examples.kotlin.core.api.BaseApiCase
import app.protocol.examples.kotlin.core.api.RouteBinding
import app.protocol.examples.kotlin.core.shared.AppCaseError
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlin.random.Random
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

@OptIn(ExperimentalTime::class)
private fun generateTaskId(): String =
    "task_${Clock.System.now().toEpochMilliseconds()}_${Random.nextLong(0, Long.MAX_VALUE).toString(16)}"

class TaskCreateApi(
    ctx: ApiContext,
) : BaseApiCase<TaskCreateInput, TaskCreateOutput>(ctx) {
    private val domainCase = TaskCreateDomain()

    override val usesService: Boolean = true

    override suspend fun handler(input: TaskCreateInput): ApiResponse<TaskCreateOutput> {
        val result = execute(input)
        return if (result.success) {
            result.copy(statusCode = 201)
        } else {
            result.copy(statusCode = mapErrorCodeToStatus(result.error?.code))
        }
    }

    override fun router(): RouteBinding =
        RouteBinding(
            method = "POST",
            path = "/tasks",
            handler = { request ->
                val body = request.body as? Map<String, Any?>
                handler(
                    TaskCreateInput(
                        title = body?.get("title") as? String ?: "",
                        description = body?.get("description") as? String,
                    ),
                )
            },
        )

    override suspend fun test() {
        val store = resolveTaskStore()
        store.reset?.invoke()

        val result =
            handler(
                TaskCreateInput(
                    title = "Test task",
                    description = "Created by task_create.api test",
                ),
            )
        check(result.success && result.data != null) {
            "test: handler should return success"
        }
        check(result.statusCode == 201) {
            "test: successful create must return statusCode 201"
        }
        check(result.data.task.status == TASK_STATUS_TODO) {
            "test: created task must start in todo"
        }

        val persisted = store.read()
        check(persisted.size == 1) {
            "test: created task must be persisted"
        }

        store.reset?.invoke()

        val concurrentCreates =
            coroutineScope {
                List(4) { index ->
                    async {
                        handler(
                            TaskCreateInput(
                                title = "Concurrent task ${index + 1}",
                            ),
                        )
                    }
                }.awaitAll()
            }
        check(concurrentCreates.all { it.success }) {
            "test: concurrent creates must all succeed"
        }

        val concurrentPersisted = store.read()
        check(concurrentPersisted.size == 4) {
            "test: concurrent creates must persist every task"
        }

        val invalid = runCatching {
            _validate(TaskCreateInput(title = "   "))
        }
        check(invalid.isFailure) {
            "test: _validate must reject blank title"
        }
    }

    override suspend fun _validate(input: TaskCreateInput) {
        try {
            domainCase.validate(input)
        } catch (error: IllegalArgumentException) {
            throw AppCaseError(
                code = "VALIDATION_FAILED",
                message = error.message ?: "task_create validation failed",
            )
        }
    }

    override fun _repository(): Any = resolveTaskStore()

    @OptIn(ExperimentalTime::class)
    override suspend fun _service(input: TaskCreateInput): TaskCreateOutput {
        val taskStore = resolveTaskStore()
        val timestamp = Clock.System.now().toString()
        val task =
            Task(
                id = generateTaskId(),
                title = input.title.trim(),
                description = input.description?.trim()?.takeIf { it.isNotBlank() },
                status = TASK_STATUS_TODO,
                createdAt = timestamp,
                updatedAt = timestamp,
            )

        taskStore.update { tasks: List<JsonObject> ->
            listOf(json.encodeToJsonElement(Task.serializer(), task).jsonObject) + tasks
        }

        ctx.logger.info(
            "task_create: task persisted",
            mapOf(
                "taskId" to task.id,
                "title" to task.title,
            ),
        )

        return TaskCreateOutput(task = task)
    }

    @Suppress("UNCHECKED_CAST")
    private fun resolveTaskStore(): TaskStore {
        val providers = ctx.extra?.get("providers") as? Map<String, Any?>
        val rawStore = providers?.get("taskStore") as? Map<String, Any?>
            ?: throw AppCaseError(
                code = "INTERNAL",
                message = "task_create requires a configured taskStore provider",
            )

        return TaskStore(
            read = rawStore["read"] as? (suspend () -> List<JsonObject>)
                ?: throw AppCaseError("INTERNAL", "task_create taskStore.read is missing"),
            write = rawStore["write"] as? (suspend (List<JsonObject>) -> Unit)
                ?: throw AppCaseError("INTERNAL", "task_create taskStore.write is missing"),
            reset = rawStore["reset"] as? (suspend () -> Unit),
            update = rawStore["update"] as? (suspend (suspend (List<JsonObject>) -> List<JsonObject>) -> List<JsonObject>)
                ?: throw AppCaseError("INTERNAL", "task_create taskStore.update is missing"),
        )
    }
}
