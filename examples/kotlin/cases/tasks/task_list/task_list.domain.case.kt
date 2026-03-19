package app.protocol.examples.kotlin.cases.tasks.task_list

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
data object TaskListInput

@Serializable
data class TaskListOutput(
    val tasks: List<Task>,
)

fun assertTaskCollection(value: List<Task>, source: String) {
    value.forEachIndexed { index, task ->
        require(task.id.isNotBlank()) { "$source[$index].id must be a non-empty string" }
        require(task.title.isNotBlank()) { "$source[$index].title must be a non-empty string" }
        require(task.createdAt.isNotBlank()) { "$source[$index].createdAt must be a non-empty string" }
        require(task.updatedAt.isNotBlank()) { "$source[$index].updatedAt must be a non-empty string" }
        require(task.status in taskStatusValues) {
            "$source[$index].status must be one of ${taskStatusValues.joinToString()}"
        }
    }
}

class TaskListDomain : BaseDomainCase<TaskListInput, TaskListOutput>() {
    override fun caseName(): String = "task_list"

    override fun description(): String = "Lists persisted task cards for board rendering."

    override fun inputSchema(): AppSchema =
        AppSchema(
            type = "object",
            properties = emptyMap(),
            additionalProperties = false,
        )

    override fun outputSchema(): AppSchema =
        AppSchema(
            type = "object",
            properties = mapOf(
                "tasks" to AppSchema(
                    type = "array",
                    items = AppSchema(
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
            ),
            required = listOf("tasks"),
            additionalProperties = false,
        )

    override fun validate(input: TaskListInput) {
    }

    fun validateOutput(output: TaskListOutput) {
        assertTaskCollection(output.tasks, "task_list.output.tasks")
    }

    override fun invariants(): List<String> =
        listOf(
            "Only todo, doing, done are valid task statuses.",
            "Listing tasks never mutates the persisted store.",
            "The response order is deterministic for the same persisted dataset.",
        )

    override fun examples(): List<DomainExample<TaskListInput, TaskListOutput>> =
        listOf(
            DomainExample(
                name = "empty_board",
                description = "No persisted tasks yet.",
                input = TaskListInput,
                output = TaskListOutput(tasks = emptyList()),
            ),
            DomainExample(
                name = "board_with_cards",
                description = "Returns tasks already persisted in the board.",
                input = TaskListInput,
                output = TaskListOutput(
                    tasks = listOf(
                        Task(
                            id = "task_002",
                            title = "Prepare release notes",
                            status = "todo",
                            createdAt = "2026-03-18T12:10:00Z",
                            updatedAt = "2026-03-18T12:10:00Z",
                        ),
                        Task(
                            id = "task_001",
                            title = "Ship the Kotlin example",
                            description = "Wire the first APP cases in the portal.",
                            status = "doing",
                            createdAt = "2026-03-18T12:00:00Z",
                            updatedAt = "2026-03-18T12:30:00Z",
                        ),
                    ),
                ),
            ),
        )

    override suspend fun test() {
        validate(TaskListInput)

        val example =
            examples().firstOrNull { it.name == "board_with_cards" }
                ?: error("test: board_with_cards example must exist")
        validateOutput(example.output ?: error("test: board_with_cards output must exist"))

        val invalidStatus =
            runCatching {
                validateOutput(
                    TaskListOutput(
                        tasks = listOf(
                            Task(
                                id = "bad",
                                title = "Invalid task",
                                status = "invalid",
                                createdAt = "2026-03-18T12:00:00Z",
                                updatedAt = "2026-03-18T12:00:00Z",
                            ),
                        ),
                    ),
                )
            }
        check(invalidStatus.isFailure) {
            "test: validateOutput must reject invalid task status"
        }
    }
}
