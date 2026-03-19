package app.protocol.examples.kotlin.cases.tasks.task_create

import app.protocol.examples.kotlin.core.AppSchema
import app.protocol.examples.kotlin.core.BaseDomainCase
import app.protocol.examples.kotlin.core.DomainExample
import kotlinx.serialization.Serializable

const val TASK_STATUS_TODO = "todo"
const val TASK_STATUS_DOING = "doing"
const val TASK_STATUS_DONE = "done"

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
data class TaskCreateInput(
    val title: String,
    val description: String? = null,
)

@Serializable
data class TaskCreateOutput(
    val task: Task,
)

class TaskCreateDomain : BaseDomainCase<TaskCreateInput, TaskCreateOutput>() {
    override fun caseName(): String = "task_create"

    override fun description(): String =
        "Creates a new task card for the board with an initial todo status."

    override fun inputSchema(): AppSchema =
        AppSchema(
            type = "object",
            properties = mapOf(
                "title" to AppSchema(
                    type = "string",
                    description = "Visible task title shown on the card.",
                ),
                "description" to AppSchema(
                    type = "string",
                    description = "Optional complementary task description.",
                ),
            ),
            required = listOf("title"),
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
                        "status" to AppSchema(
                            type = "string",
                            enum = listOf(TASK_STATUS_TODO, TASK_STATUS_DOING, TASK_STATUS_DONE),
                        ),
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

    override fun validate(input: TaskCreateInput) {
        require(input.title.trim().isNotEmpty()) {
            "title must not be empty"
        }
    }

    override fun invariants(): List<String> =
        listOf(
            "Every new task starts with status todo.",
            "The backend is the source of truth for task id and timestamps.",
            "createdAt and updatedAt are equal on first creation.",
        )

    override fun examples(): List<DomainExample<TaskCreateInput, TaskCreateOutput>> =
        listOf(
            DomainExample(
                name = "title_only",
                description = "Create a task with only the required title.",
                input = TaskCreateInput(title = "Ship the Kotlin example"),
                output = TaskCreateOutput(
                    task = Task(
                        id = "task_001",
                        title = "Ship the Kotlin example",
                        status = TASK_STATUS_TODO,
                        createdAt = "2026-03-18T12:00:00Z",
                        updatedAt = "2026-03-18T12:00:00Z",
                    ),
                ),
            ),
            DomainExample(
                name = "title_and_description",
                description = "Create a task with an optional description.",
                input = TaskCreateInput(
                    title = "Prepare release notes",
                    description = "Summarize the scope of the first Kotlin APP example.",
                ),
                output = TaskCreateOutput(
                    task = Task(
                        id = "task_002",
                        title = "Prepare release notes",
                        description = "Summarize the scope of the first Kotlin APP example.",
                        status = TASK_STATUS_TODO,
                        createdAt = "2026-03-18T12:10:00Z",
                        updatedAt = "2026-03-18T12:10:00Z",
                    ),
                ),
            ),
        )

    override suspend fun test() {
        val definition = definition()
        check(definition.caseName == "task_create") {
            "test: caseName must be task_create"
        }
        check(definition.inputSchema.required?.contains("title") == true) {
            "test: inputSchema must require title"
        }

        validate(
            TaskCreateInput(
                title = "Valid task",
                description = "Optional text",
            ),
        )

        val blankTitle = runCatching {
            validate(TaskCreateInput(title = "   "))
        }
        check(blankTitle.isFailure) {
            "test: validate must reject blank title"
        }

        check(examples().isNotEmpty()) {
            "test: examples must be defined"
        }
        examples().forEach { example ->
            validate(example.input)
            check(example.output?.task?.status == TASK_STATUS_TODO) {
                "test: example output must start in todo"
            }
        }
    }
}
