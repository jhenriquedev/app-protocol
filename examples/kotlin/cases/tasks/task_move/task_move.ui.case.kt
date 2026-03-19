@file:Suppress("UnsafeCastFromDynamic")

package app.protocol.examples.kotlin.cases.tasks.task_move

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
    val loading: Boolean = false,
    val error: String? = null,
)

class TaskMoveUi(
    ctx: UiContext,
) : BaseUiCase<ViewState>(
        ctx = ctx,
        initialState = ViewState(),
    ) {
    private val domainCase = TaskMoveDomain()
    private var moveLocked = false

    override fun view(): Any {
        val root = document.createElement("div") as HTMLElement
        val designSystem = resolveDesignSystem()
        val task = ctx.extra?.get("task") as? Task
            ?: error("task_move.ui requires extra.task")
        val onTaskMoved = ctx.extra?.get("onTaskMoved") as? ((Task) -> Unit)

        fun render() {
            root.innerHTML = ""
            root.appendChild(
                    designSystem.moveTaskAction(task.status, state.loading) { nextStatus: String ->
                        uiScope.launch {
                            move(task, nextStatus, onTaskMoved, ::render)
                        }
                    } as HTMLElement,
            )
            if (!state.error.isNullOrBlank()) {
                val error = document.createElement("div") as HTMLElement
                error.textContent = state.error
                error.style.color = "#9a2d1f"
                error.style.fontSize = "0.82rem"
                error.style.marginTop = "0.55rem"
                root.appendChild(error)
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
                TaskMoveInput(
                    taskId = "task_001",
                    targetStatus = "doing",
                ),
            ) as TaskMoveOutput
        check(result.task.status == "doing") {
            "test: ui service must return the moved task"
        }

        check(
            runCatching {
                _service(TaskMoveInput(taskId = "", targetStatus = "done"))
            }.isFailure,
        ) {
            "test: ui service must reject invalid input"
        }

        check(_acquireMoveLock()) {
            "test: first move lock acquisition must succeed"
        }
        check(!_acquireMoveLock()) {
            "test: move lock must reject reentry"
        }
        _releaseMoveLock()
    }

    override suspend fun _service(vararg args: Any?): Any {
        val input = args.firstOrNull() as? TaskMoveInput
            ?: error("task_move.ui requires TaskMoveInput")
        domainCase.validate(input)
        return _repository(input)
    }

    override suspend fun _repository(vararg args: Any?): Any {
        val input = args.firstOrNull() as? TaskMoveInput
            ?: error("task_move.ui requires TaskMoveInput")
        val payload =
            resolveApiClient().request(
                mapOf(
                    "method" to "PATCH",
                    "url" to "/tasks/${input.taskId}/status",
                    "body" to mapOf("targetStatus" to input.targetStatus),
                ),
            ) as? String ?: error("task_move.ui received an invalid move response")

        val envelope = json.parseToJsonElement(payload).jsonObject
        if (envelope["success"]?.jsonPrimitive?.boolean != true) {
            val message =
                envelope["error"]?.jsonObject?.get("message")?.jsonPrimitive?.content
                    ?: "Request failed"
            error(message)
        }

        val data = envelope["data"] ?: error("task_move.ui missing success payload")
        return json.decodeFromJsonElement(TaskMoveOutput.serializer(), data)
    }

    private suspend fun move(
        task: Task,
        nextStatus: String,
        onTaskMoved: ((Task) -> Unit)?,
        render: () -> Unit,
    ) {
        if (!_acquireMoveLock()) {
            return
        }

        setState(state.copy(loading = true, error = null))
        render()

        try {
            val result =
                _service(
                    TaskMoveInput(
                        taskId = task.id,
                        targetStatus = nextStatus,
                    ),
                ) as TaskMoveOutput
            onTaskMoved?.invoke(result.task)
            setState(ViewState())
        } catch (error: Throwable) {
            setState(
                ViewState(
                    loading = false,
                    error = error.message ?: "Failed to move task",
                ),
            )
        } finally {
            _releaseMoveLock()
            render()
        }
    }

    private fun _acquireMoveLock(): Boolean {
        if (moveLocked) return false
        moveLocked = true
        return true
    }

    private fun _releaseMoveLock() {
        moveLocked = false
    }

    private fun resolveApiClient(): AppHttpClient =
        ctx.api ?: error("task_move.ui requires ctx.api")

    private fun resolveDesignSystem(): dynamic {
        val packages = ctx.packages ?: error("task_move.ui requires ctx.packages")
        return packages["designSystem"] ?: error("task_move.ui requires packages.designSystem")
    }
}
