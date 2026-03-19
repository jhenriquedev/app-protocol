@file:Suppress("UnsafeCastFromDynamic")

package app.protocol.examples.kotlin.packages.design_system

import kotlinx.browser.document
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLInputElement
import org.w3c.dom.HTMLTextAreaElement

object DesignSystem {
    private var stylesMounted = false

    fun ensureStyles() {
        if (stylesMounted) return
        stylesMounted = true

        val style = document.createElement("style") as HTMLElement
        style.textContent =
            """
            body {
              margin: 0;
              background: #f5f7fb;
            }
            .app-shell {
              background: linear-gradient(180deg, #f5f7fb 0%, #edf1f7 48%, #fdfefe 100%);
              color: #1f2430;
              font-family: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
              min-height: 100vh;
              padding: 2.5rem 1.5rem 3rem;
              box-sizing: border-box;
            }
            .app-shell__container {
              margin: 0 auto;
              max-width: 1120px;
            }
            .app-shell__header {
              display: flex;
              gap: 1rem;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 2rem;
            }
            .app-shell__eyebrow {
              color: #637083;
              font-size: 0.8rem;
              font-weight: 700;
              letter-spacing: 0.08em;
              margin-bottom: 0.55rem;
              text-transform: uppercase;
            }
            .app-shell__title {
              font-size: 2.5rem;
              line-height: 1.05;
              margin: 0;
            }
            .app-shell__subtitle {
              color: #5f646d;
              font-size: 1rem;
              margin: 0.7rem 0 0;
              max-width: 52rem;
            }
            .surface {
              background: #ffffff;
              border: 1px solid #d8dde6;
              border-radius: 20px;
              box-shadow: 0 20px 45px rgba(18, 26, 41, 0.08);
            }
            .board-header {
              margin-bottom: 1.5rem;
              padding: 1.15rem 1.25rem;
            }
            .task-board {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 1rem;
              align-items: start;
            }
            .task-column {
              min-height: 320px;
              padding: 1rem;
            }
            .task-column__header {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              margin-bottom: 0.9rem;
            }
            .task-card {
              padding: 0.95rem;
              margin-bottom: 0.75rem;
            }
            .task-card__header {
              display: flex;
              justify-content: space-between;
              gap: 0.75rem;
              align-items: flex-start;
              margin-bottom: 0.65rem;
            }
            .task-card__title {
              font-size: 1rem;
              font-weight: 700;
              margin: 0;
              overflow-wrap: anywhere;
            }
            .task-card__description {
              margin: 0.55rem 0 0;
              color: #5f646d;
              white-space: pre-wrap;
            }
            .task-status-badge {
              border-radius: 999px;
              display: inline-flex;
              font-size: 0.74rem;
              font-weight: 700;
              padding: 0.3rem 0.65rem;
              text-transform: uppercase;
            }
            .task-status-badge--todo {
              background: #fff4cc;
              color: #7a5d00;
            }
            .task-status-badge--doing {
              background: #d9efff;
              color: #005a91;
            }
            .task-status-badge--done {
              background: #dff7e4;
              color: #0c6a36;
            }
            .button-pill {
              border: none;
              border-radius: 999px;
              cursor: pointer;
              font-size: 0.95rem;
              font-weight: 600;
              padding: 0.8rem 1.1rem;
            }
            .button-pill:disabled {
              cursor: default;
              opacity: 0.72;
            }
            .button-primary {
              background: #1f2430;
              color: #ffffff;
            }
            .move-task-action {
              display: flex;
              flex-wrap: wrap;
              gap: 0.45rem;
              margin-top: 0.8rem;
            }
            .move-task-action button {
              background: #eef2f7;
              color: #1f2430;
              padding: 0.5rem 0.8rem;
            }
            .empty-column-state {
              color: #637083;
              font-size: 0.9rem;
              padding: 1rem 0;
            }
            .feedback {
              border-radius: 14px;
              margin-top: 1rem;
              padding: 0.9rem 1rem;
            }
            .feedback--success {
              background: #dff7e4;
              color: #0c6a36;
            }
            .feedback--error {
              background: #ffe1dd;
              color: #9a2d1f;
            }
            .task-form-modal {
              position: fixed;
              inset: 0;
              background: rgba(18, 26, 41, 0.42);
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 1rem;
              box-sizing: border-box;
              z-index: 999;
            }
            .task-form-modal__panel {
              background: #ffffff;
              border-radius: 20px;
              box-shadow: 0 20px 45px rgba(18, 26, 41, 0.12);
              max-height: calc(100vh - 2rem);
              overflow: auto;
              padding: 1.25rem;
              width: min(100%, 480px);
              box-sizing: border-box;
            }
            .task-form-modal__field {
              display: grid;
              gap: 0.35rem;
              margin-bottom: 0.9rem;
            }
            .task-form-modal__field label {
              font-size: 0.9rem;
              font-weight: 600;
            }
            .task-form-modal__field input,
            .task-form-modal__field textarea {
              border: 1px solid #c9d1dc;
              border-radius: 12px;
              box-sizing: border-box;
              font: inherit;
              padding: 0.8rem 0.9rem;
              width: 100%;
            }
            .task-form-modal__actions {
              display: flex;
              justify-content: flex-end;
              gap: 0.75rem;
            }
            .button-secondary {
              background: #eef2f7;
              color: #1f2430;
            }
            @media (max-width: 1024px) {
              .task-board {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
            }
            @media (max-width: 760px) {
              .app-shell {
                padding: 1.25rem 0.9rem 1.75rem;
              }
              .app-shell__header {
                align-items: stretch;
                flex-direction: column;
                margin-bottom: 1.4rem;
              }
              .task-board {
                grid-template-columns: minmax(0, 1fr);
              }
              .task-form-modal {
                align-items: flex-end;
                padding: 0.75rem;
              }
              .task-form-modal__panel {
                border-radius: 18px;
                max-height: calc(100vh - 1.5rem);
                width: 100%;
              }
              .task-form-modal__actions {
                flex-direction: column-reverse;
              }
              .task-form-modal__actions button {
                width: 100%;
              }
            }
            """.trimIndent()
        document.head?.appendChild(style)
    }

    fun appShell(
        title: String,
        subtitle: String?,
        children: List<HTMLElement>,
        actions: HTMLElement? = null,
    ): HTMLElement {
        ensureStyles()
        val shell = div("app-shell")
        val container = div("app-shell__container")
        val header = div("app-shell__header")
        val intro = div()
        intro.appendChild(div("app-shell__eyebrow", "APP Kotlin Example"))
        intro.appendChild(h1("app-shell__title", title))
        if (!subtitle.isNullOrBlank()) {
            intro.appendChild(paragraph("app-shell__subtitle", subtitle))
        }
        header.appendChild(intro)
        if (actions != null) {
            header.appendChild(actions)
        }
        container.appendChild(header)
        children.forEach(container::appendChild)
        shell.appendChild(container)
        return shell
    }

    fun boardHeader(title: String, subtitle: String?): HTMLElement {
        val section = div("surface board-header")
        section.appendChild(h2(text = title))
        if (!subtitle.isNullOrBlank()) {
            section.appendChild(paragraph(text = subtitle))
        }
        return section
    }

    fun createTaskButton(disabled: Boolean, onClick: () -> Unit): HTMLElement {
        val button = button("button-pill button-primary", "New Task")
        button.asDynamic().disabled = disabled
        button.onclick = {
            onClick()
        }
        return button
    }

    fun taskBoard(children: List<HTMLElement>): HTMLElement {
        val board = div("task-board")
        children.forEach(board::appendChild)
        return board
    }

    fun taskColumn(title: String, count: Int, children: List<HTMLElement>): HTMLElement {
        val column = div("surface task-column")
        val header = div("task-column__header")
        header.appendChild(h2(text = title))
        header.appendChild(span(text = count.toString()))
        column.appendChild(header)
        children.forEach(column::appendChild)
        return column
    }

    fun taskStatusBadge(status: String): HTMLElement {
        val badge = span("task-status-badge task-status-badge--$status", status)
        return badge
    }

    fun taskCard(
        title: String,
        description: String?,
        status: String,
        actions: HTMLElement? = null,
    ): HTMLElement {
        val card = div("surface task-card")
        val header = div("task-card__header")
        header.appendChild(h3("task-card__title", title))
        header.appendChild(taskStatusBadge(status))
        card.appendChild(header)
        if (!description.isNullOrBlank()) {
            card.appendChild(paragraph("task-card__description", description))
        }
        if (actions != null) {
            card.appendChild(actions)
        }
        return card
    }

    fun emptyColumnState(message: String): HTMLElement =
        div("empty-column-state", message)

    fun moveTaskAction(
        currentStatus: String,
        submitting: Boolean,
        onMove: (String) -> Unit,
    ): HTMLElement {
        val container = div("move-task-action")
        listOf("todo", "doing", "done")
            .filterNot { it == currentStatus }
            .forEach { nextStatus ->
                val button = button("button-pill", nextStatus.replaceFirstChar(Char::uppercase))
                button.asDynamic().disabled = submitting
                button.onclick = {
                    onMove(nextStatus)
                }
                container.appendChild(button)
            }
        return container
    }

    fun taskFormModal(
        open: Boolean,
        titleValue: String,
        descriptionValue: String,
        submitting: Boolean,
        onTitleChange: (String) -> Unit,
        onDescriptionChange: (String) -> Unit,
        onClose: () -> Unit,
        onSubmit: () -> Unit,
    ): HTMLElement? {
        if (!open) return null

        val overlay = div("task-form-modal")
        val panel = div("task-form-modal__panel")
        panel.appendChild(h2(text = "Create Task"))

        val titleField = div("task-form-modal__field")
        titleField.appendChild(label("Title"))
        val titleInput = document.createElement("input") as HTMLInputElement
        titleInput.value = titleValue
        titleInput.placeholder = "What needs to be done?"
        titleInput.oninput = {
            onTitleChange(titleInput.value)
        }
        titleField.appendChild(titleInput)
        panel.appendChild(titleField)

        val descriptionField = div("task-form-modal__field")
        descriptionField.appendChild(label("Description"))
        val descriptionInput = document.createElement("textarea") as HTMLTextAreaElement
        descriptionInput.value = descriptionValue
        descriptionInput.placeholder = "Optional context for the card"
        descriptionInput.rows = 4
        descriptionInput.oninput = {
            onDescriptionChange(descriptionInput.value)
        }
        descriptionField.appendChild(descriptionInput)
        panel.appendChild(descriptionField)

        val actions = div("task-form-modal__actions")
        val cancel = button("button-pill button-secondary", "Cancel")
        cancel.asDynamic().disabled = submitting
        cancel.onclick = { onClose() }

        val submit = button("button-pill button-primary", if (submitting) "Saving..." else "Create Task")
        submit.asDynamic().disabled = submitting
        submit.onclick = { onSubmit() }

        actions.appendChild(cancel)
        actions.appendChild(submit)
        panel.appendChild(actions)
        overlay.appendChild(panel)

        overlay.onclick = { event ->
            if (event.target == overlay) {
                onClose()
            }
        }

        return overlay
    }

    private fun div(className: String? = null, text: String? = null): HTMLElement =
        element("div", className, text)

    private fun span(className: String? = null, text: String? = null): HTMLElement =
        element("span", className, text)

    private fun h1(className: String? = null, text: String? = null): HTMLElement =
        element("h1", className, text)

    private fun h2(className: String? = null, text: String? = null): HTMLElement =
        element("h2", className, text)

    private fun h3(className: String? = null, text: String? = null): HTMLElement =
        element("h3", className, text)

    private fun paragraph(className: String? = null, text: String? = null): HTMLElement =
        element("p", className, text)

    private fun label(text: String): HTMLElement =
        element("label", text = text)

    private fun button(className: String? = null, text: String? = null): HTMLElement =
        element("button", className, text)

    private fun element(tag: String, className: String? = null, text: String? = null): HTMLElement {
        val element = document.createElement(tag) as HTMLElement
        if (!className.isNullOrBlank()) {
            element.className = className
        }
        if (!text.isNullOrBlank()) {
            element.textContent = text
        }
        return element
    }
}
