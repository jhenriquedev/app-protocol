@file:Suppress("UnsafeCastFromDynamic")

package app.protocol.examples.kotlin.cases.tasks.task_list

import app.protocol.examples.kotlin.core.shared.AppHttpClient
import app.protocol.examples.kotlin.core.ui.BaseUiCase
import app.protocol.examples.kotlin.core.ui.UiContext
import kotlinx.browser.document
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.w3c.dom.HTMLElement

private val json = Json { ignoreUnknownKeys = false }
private val uiScope = MainScope()

data class ViewState(
    val tasks: List<Task> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
)

data class ColumnViewModel(
    val status: String,
    val title: String,
    val tasks: List<Task>,
    val emptyMessage: String,
)

data class ViewModel(
    val columns: List<ColumnViewModel>,
    val feedback: String? = null,
)

class TaskListUi(
    ctx: UiContext,
) : BaseUiCase<ViewState>(
        ctx = ctx,
        initialState = ViewState(),
    ) {
    private val domainCase = TaskListDomain()

    override fun view(): Any {
        val root = document.createElement("section") as HTMLElement
        val designSystem = resolveDesignSystem()
        val renderCardActions = ctx.extra?.get("renderCardActions") as? ((Task) -> HTMLElement?)

        fun render() {
            root.innerHTML = ""
            val viewModel = _viewmodel(state) as ViewModel

            if (!viewModel.feedback.isNullOrBlank()) {
                val feedback = document.createElement("div") as HTMLElement
                feedback.className = "feedback feedback--error"
                feedback.textContent = viewModel.feedback
                root.appendChild(feedback)
            }

            val columns =
                viewModel.columns.map { column ->
                    val children =
                        if (column.tasks.isNotEmpty()) {
                            column.tasks.map { task ->
                                designSystem.taskCard(
                                    task.title,
                                    task.description,
                                    task.status,
                                    renderCardActions?.invoke(task),
                                ) as HTMLElement
                            }
                        } else {
                            listOf(
                                designSystem.emptyColumnState(column.emptyMessage) as HTMLElement,
                            )
                        }

                    designSystem.taskColumn(column.title, column.tasks.size, children) as HTMLElement
                }

            root.appendChild(
                designSystem.taskBoard(columns) as HTMLElement,
            )
        }

        render()
        uiScope.launch {
            loadTasks(::render)
        }

        return root
    }

    override suspend fun test() {
        val view = view()
        check(view is HTMLElement) {
            "test: view must return a visual unit"
        }

        val result = _service(TaskListInput) as TaskListOutput
        check(result.tasks.size == 2) {
            "test: ui service must return the mocked task list"
        }

        val viewModel =
            _viewmodel(
                ViewState(
                    tasks = result.tasks,
                    loading = false,
                    error = null,
                ),
            ) as ViewModel
        val todo = viewModel.columns.firstOrNull { it.status == "todo" }
        val doing = viewModel.columns.firstOrNull { it.status == "doing" }
        check(todo?.tasks?.size == 1 && doing?.tasks?.size == 1) {
            "test: ui viewmodel must group tasks by status"
        }
    }

    override fun _viewmodel(vararg args: Any?): Any {
        val current = args.firstOrNull() as? ViewState ?: state
        return ViewModel(
            columns = listOf(
                ColumnViewModel(
                    status = "todo",
                    title = "To Do",
                    tasks = current.tasks.filter { it.status == "todo" },
                    emptyMessage = if (current.loading) "Loading cards..." else "No cards in to do.",
                ),
                ColumnViewModel(
                    status = "doing",
                    title = "Doing",
                    tasks = current.tasks.filter { it.status == "doing" },
                    emptyMessage = if (current.loading) "Loading cards..." else "No cards in doing.",
                ),
                ColumnViewModel(
                    status = "done",
                    title = "Done",
                    tasks = current.tasks.filter { it.status == "done" },
                    emptyMessage = if (current.loading) "Loading cards..." else "No cards in done.",
                ),
            ),
            feedback = current.error,
        )
    }

    override suspend fun _service(vararg args: Any?): Any {
        domainCase.validate(TaskListInput)
        return _repository(TaskListInput)
    }

    override suspend fun _repository(vararg args: Any?): Any {
        val payload =
            resolveApiClient().request(
                mapOf(
                    "method" to "GET",
                    "url" to "/tasks",
                ),
            ) as? String ?: error("task_list.ui received an invalid list response")

        val envelope = json.parseToJsonElement(payload).jsonObject
        if (envelope["success"]?.jsonPrimitive?.boolean != true) {
            val message =
                envelope["error"]?.jsonObject?.get("message")?.jsonPrimitive?.content
                    ?: "Request failed"
            error(message)
        }

        val data = envelope["data"] ?: error("task_list.ui missing success payload")
        return json.decodeFromJsonElement(TaskListOutput.serializer(), data)
    }

    private suspend fun loadTasks(render: () -> Unit) {
        setState(state.copy(loading = true, error = null))
        render()
        try {
            val result = _service(TaskListInput) as TaskListOutput
            setState(
                ViewState(
                    tasks = result.tasks,
                    loading = false,
                    error = null,
                ),
            )
        } catch (error: Throwable) {
            setState(
                ViewState(
                    tasks = emptyList(),
                    loading = false,
                    error = error.message ?: "Failed to load tasks",
                ),
            )
        }
        render()
    }

    private fun resolveApiClient(): AppHttpClient =
        ctx.api ?: error("task_list.ui requires ctx.api")

    private fun resolveDesignSystem(): dynamic {
        val packages = ctx.packages ?: error("task_list.ui requires ctx.packages")
        return packages["designSystem"] ?: error("task_list.ui requires packages.designSystem")
    }
}
