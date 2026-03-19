package app.protocol.examples.kotlin.apps.portal

import app.protocol.examples.kotlin.cases.tasks.task_create.Task
import app.protocol.examples.kotlin.cases.tasks.task_create.TaskCreateUi
import app.protocol.examples.kotlin.cases.tasks.task_list.TaskListUi
import app.protocol.examples.kotlin.cases.tasks.task_move.TaskMoveUi
import app.protocol.examples.kotlin.core.ui.UiContext
import app.protocol.examples.kotlin.packages.design_system.DesignSystem
import org.w3c.dom.HTMLElement

object PortalRoot {
    fun render(
        registry: PortalRegistry,
        createUiContext: (Map<String, Any?>) -> UiContext,
        rootElement: HTMLElement,
    ) {
        var refreshToken = 0

        fun rerender() {
            val taskCreateContext =
                createUiContext(
                    mapOf(
                        "onTaskCreated" to { _: Task ->
                            refreshToken += 1
                            rerender()
                        },
                    ),
                )

            val taskListContext =
                createUiContext(
                    mapOf(
                        "refreshToken" to refreshToken,
                        "renderCardActions" to { task: app.protocol.examples.kotlin.cases.tasks.task_list.Task ->
                            val moveContext =
                                createUiContext(
                                    mapOf(
                                        "task" to app.protocol.examples.kotlin.cases.tasks.task_move.Task(
                                            id = task.id,
                                            title = task.title,
                                            description = task.description,
                                            status = task.status,
                                            createdAt = task.createdAt,
                                            updatedAt = task.updatedAt,
                                        ),
                                        "onTaskMoved" to { _: app.protocol.examples.kotlin.cases.tasks.task_move.Task ->
                                            refreshToken += 1
                                            rerender()
                                        },
                                    ),
                                )
                            TaskMoveUi(moveContext).view() as HTMLElement
                        },
                    ),
                )

            val taskCreateView =
                (registry._cases["tasks"]?.get("task_create")?.ui?.invoke(taskCreateContext)
                    as? TaskCreateUi
                    ?: TaskCreateUi(taskCreateContext))
                    .view() as HTMLElement
            val taskListView =
                (registry._cases["tasks"]?.get("task_list")?.ui?.invoke(taskListContext)
                    as? TaskListUi
                    ?: TaskListUi(taskListContext))
                    .view() as HTMLElement

            rootElement.innerHTML = ""
            rootElement.appendChild(
                DesignSystem.appShell(
                    title = "Task Board",
                    subtitle = "Kotlin APP example with create, list, and move wired through Cases.",
                    children = listOf(
                        DesignSystem.boardHeader(
                            title = "Board",
                            subtitle = "Tasks load from the backend and each card can move across columns.",
                        ),
                        taskCreateView,
                        taskListView,
                    ),
                ),
            )
        }

        rerender()
    }
}
