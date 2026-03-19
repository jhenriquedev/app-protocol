package app.protocol.examples.kotlin.cases.tasks.task_move

import app.protocol.examples.kotlin.core.AppSchema
import app.protocol.examples.kotlin.core.BaseDomainCase
import app.protocol.examples.kotlin.core.DomainExample
import kotlinx.serialization.Serializable

private val taskStatusValues = listOf("todo", "doing", "done")

@Serializable
data class Task(
    val id: String,
    val title: String,
    val description: String? = null,
    val status: String,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class TaskMoveInput(
    val taskId: String,
    val targetStatus: String,
)

@Serializable
data class TaskMoveOutput(
    val task: Task,
)

fun assertTaskRecord(task: Task, source: String) {
    require(task.id.isNotBlank()) { "$source.id must be a non-empty string" }
    require(task.title.isNotBlank()) { "$source.title must be a non-empty string" }
    require(task.createdAt.isNotBlank()) { "$source.createdAt must be a non-empty string" }
    require(task.updatedAt.isNotBlank()) { "$source.updatedAt must be a non-empty string" }
    require(task.status in taskStatusValues) {
        "$source.status must be one of ${taskStatusValues.joinToString()}"
    }
}

class TaskMoveDomain : BaseDomainCase<TaskMoveInput, TaskMoveOutput>() {
    override fun caseName(): String = "task_move"

    override fun description(): String =
        "Moves an existing task card to another board column."

    override fun inputSchema(): AppSchema =
        AppSchema(
            type = "object",
            properties = mapOf(
                "taskId" to AppSchema(
                    type = "string",
                    description = "Identifier of the task that will be moved.",
                ),
                "targetStatus" to AppSchema(
                    type = "string",
                    description = "Destination board column for the task.",
                    enum = taskStatusValues,
                ),
            ),
            required = listOf("taskId", "targetStatus"),
            additionalProperties = false,
        )

    override fun outputSchema(): AppSchema =
        AppSchema(
            type = "object",
            properties = mapOf(
                "task" to AppSchema(
                    type = "object",
                    properties = mapOf(
                        "id" to AppSchema(type = "string"),
                        "title" to AppSchema(type = "string"),
                        "description" to AppSchema(type = "string"),
                        "status" to AppSchema(type = "string", enum = taskStatusValues),
                        "createdAt" to AppSchema(type = "string"),
                        "updatedAt" to AppSchema(type = "string"),
                    ),
                    required = listOf("id", "title", "status", "createdAt", "updatedAt"),
                    additionalProperties = false,
                ),
            ),
            required = listOf("task"),
            additionalProperties = false,
        )

    override fun validate(input: TaskMoveInput) {
        require(input.taskId.isNotBlank()) { "taskId is required" }
        require(input.targetStatus in taskStatusValues) {
            "targetStatus must be one of ${taskStatusValues.joinToString()}"
        }
    }

    fun validateOutput(output: TaskMoveOutput) {
        assertTaskRecord(output.task, "task_move.output.task")
    }

    override fun invariants(): List<String> =
        listOf(
            "Moving a task never changes its identity.",
            "A move only updates status and, when applicable, updatedAt.",
            "Moving to the same status is idempotent and returns the unchanged task.",
        )

    override fun examples(): List<DomainExample<TaskMoveInput, TaskMoveOutput>> =
        listOf(
            DomainExample(
                name = "move_todo_to_doing",
                description = "A task leaves todo and enters doing.",
                input = TaskMoveInput(taskId = "task_001", targetStatus = "doing"),
                output = TaskMoveOutput(
                    task = Task(
                        id = "task_001",
                        title = "Ship the Kotlin example",
                        status = "doing",
                        createdAt = "2026-03-18T12:00:00Z",
                        updatedAt = "2026-03-18T12:20:00Z",
                    ),
                ),
            ),
            DomainExample(
                name = "idempotent_move",
                description = "Moving to the same status keeps the task unchanged.",
                input = TaskMoveInput(taskId = "task_002", targetStatus = "done"),
                output = TaskMoveOutput(
                    task = Task(
                        id = "task_002",
                        title = "Prepare release notes",
                        status = "done",
                        createdAt = "2026-03-18T12:10:00Z",
                        updatedAt = "2026-03-18T12:10:00Z",
                    ),
                ),
            ),
        )

    override suspend fun test() {
        validate(TaskMoveInput(taskId = "task_001", targetStatus = "doing"))

        check(
            runCatching { validate(TaskMoveInput(taskId = "", targetStatus = "doing")) }.isFailure,
        ) {
            "test: validate must reject empty taskId"
        }

        check(
            runCatching { validate(TaskMoveInput(taskId = "task_001", targetStatus = "invalid")) }.isFailure,
        ) {
            "test: validate must reject invalid targetStatus"
        }

        validateOutput(
            TaskMoveOutput(
                task = Task(
                    id = "task_001",
                    title = "Valid task",
                    status = "doing",
                    createdAt = "2026-03-18T12:00:00Z",
                    updatedAt = "2026-03-18T12:20:00Z",
                ),
            ),
        )
    }
}
