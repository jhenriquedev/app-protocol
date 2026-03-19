@file:Suppress("UnsafeCastFromDynamic")

package app.protocol.examples.kotlin.cases.tasks.task_create

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
    val modalOpen: Boolean = false,
    val title: String = "",
    val description: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val result: TaskCreateOutput? = null,
)

data class ViewModel(
    val feedbackType: String? = null,
    val feedbackMessage: String? = null,
)

class TaskCreateUi(
    ctx: UiContext,
) : BaseUiCase<ViewState>(
        ctx = ctx,
        initialState = ViewState(),
    ) {
    private val domainCase = TaskCreateDomain()
    private var submissionLocked = false

    override fun view(): Any {
        val root = document.createElement("section") as HTMLElement
        val designSystem = resolveDesignSystem()
        val onTaskCreated = ctx.extra?.get("onTaskCreated") as? ((Task) -> Unit)

        fun render() {
            root.innerHTML = ""

            val buttonRow = document.createElement("div") as HTMLElement
            buttonRow.style.display = "flex"
            buttonRow.style.justifyContent = "flex-end"
            buttonRow.appendChild(
                designSystem.createTaskButton(state.loading) {
                    setState(state.copy(modalOpen = true, error = null))
                    render()
                } as HTMLElement,
            )
            root.appendChild(buttonRow)

            val modal =
                designSystem.taskFormModal(
                    state.modalOpen,
                    state.title,
                    state.description,
                    state.loading,
                    { value: String ->
                        setState(state.copy(title = value))
                        render()
                    },
                    { value: String ->
                        setState(state.copy(description = value))
                        render()
                    },
                    {
                        setState(state.copy(modalOpen = false, error = null))
                        render()
                    },
                    {
                        uiScope.launch {
                            submit(onTaskCreated, ::render)
                        }
                    },
                ) as? HTMLElement
            if (modal != null) {
                root.appendChild(modal)
            }

            val viewModel = _viewmodel(state) as ViewModel
            if (!viewModel.feedbackMessage.isNullOrBlank()) {
                val feedback = document.createElement("div") as HTMLElement
                feedback.className = "feedback feedback--${viewModel.feedbackType}"
                feedback.textContent = viewModel.feedbackMessage
                root.appendChild(feedback)
            }
        }

        render()
        return root
    }

    override suspend fun test() {
        val view = view()
        check(view is HTMLElement) {
            "test: view must return a visual unit"
        }

        val result =
            _service(
                TaskCreateInput(
                    title = "Create task UI test",
                    description = "UI surface repository flow",
                ),
            ) as TaskCreateOutput
        check(result.task.id.isNotBlank()) {
            "test: ui service must return a created task id"
        }

        val viewModel =
            _viewmodel(
                ViewState(
                    loading = false,
                    result = result,
                ),
            ) as ViewModel
        check(viewModel.feedbackType == "success") {
            "test: ui viewmodel must expose success feedback"
        }

        check(runCatching { _service(TaskCreateInput(title = "   ")) }.isFailure) {
            "test: ui service must reject blank title"
        }

        check(_acquireSubmissionLock()) {
            "test: first submission lock acquisition must succeed"
        }
        check(!_acquireSubmissionLock()) {
            "test: submission lock must reject reentry"
        }
        _releaseSubmissionLock()
    }

    override fun _viewmodel(vararg args: Any?): Any {
        val current = args.firstOrNull() as? ViewState ?: state
        return when {
            !current.error.isNullOrBlank() ->
                ViewModel(
                    feedbackType = "error",
                    feedbackMessage = current.error,
                )

            current.result != null ->
                ViewModel(
                    feedbackType = "success",
                    feedbackMessage = "Task \"${current.result.task.title}\" created successfully.",
                )

            else -> ViewModel()
        }
    }

    override suspend fun _service(vararg args: Any?): Any {
        val input = args.firstOrNull() as? TaskCreateInput
            ?: error("task_create.ui requires TaskCreateInput")
        domainCase.validate(input)
        return _repository(input)
    }

    override suspend fun _repository(vararg args: Any?): Any {
        val input = args.firstOrNull() as? TaskCreateInput
            ?: error("task_create.ui requires TaskCreateInput")
        val payload =
            resolveApiClient().request(
                mapOf(
                    "method" to "POST",
                    "url" to "/tasks",
                    "body" to mapOf(
                        "title" to input.title,
                        "description" to input.description,
                    ),
                ),
            ) as? String ?: error("task_create.ui received an invalid create response")

        val envelope = json.parseToJsonElement(payload).jsonObject
        if (envelope["success"]?.jsonPrimitive?.boolean != true) {
            val message =
                envelope["error"]?.jsonObject?.get("message")?.jsonPrimitive?.content
                    ?: "Request failed"
            error(message)
        }

        val data = envelope["data"] ?: error("task_create.ui missing success payload")
        return json.decodeFromJsonElement(TaskCreateOutput.serializer(), data)
    }

    private suspend fun submit(onTaskCreated: ((Task) -> Unit)?, render: () -> Unit) {
        if (!_acquireSubmissionLock()) {
            return
        }

        setState(state.copy(loading = true, error = null))
        render()

        try {
            val result =
                _service(
                    TaskCreateInput(
                        title = state.title,
                        description = state.description.takeIf { it.isNotBlank() },
                    ),
                ) as TaskCreateOutput
            onTaskCreated?.invoke(result.task)
            setState(
                ViewState(
                    modalOpen = false,
                    loading = false,
                    result = result,
                ),
            )
        } catch (error: Throwable) {
            setState(
                state.copy(
                    loading = false,
                    error = error.message ?: "Failed to create task",
                ),
            )
        } finally {
            _releaseSubmissionLock()
            render()
        }
    }

    private fun _acquireSubmissionLock(): Boolean {
        if (submissionLocked) return false
        submissionLocked = true
        return true
    }

    private fun _releaseSubmissionLock() {
        submissionLocked = false
    }

    private fun resolveApiClient(): AppHttpClient =
        ctx.api ?: error("task_create.ui requires ctx.api")

    private fun resolveDesignSystem(): dynamic {
        val packages = ctx.packages ?: error("task_create.ui requires ctx.packages")
        return packages["designSystem"] ?: error("task_create.ui requires packages.designSystem")
    }
}
