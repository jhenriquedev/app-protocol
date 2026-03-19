package packages.design_system;

public class DesignSystem {
  public String styles() {
    return """
        <style>
          :root {
            color-scheme: light;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
          }

          form {
            margin: 0;
          }

          .app-shell {
            background: linear-gradient(180deg, #f5f7fb 0%, #edf1f7 48%, #fdfefe 100%);
            color: #1f2430;
            font-family: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
            min-height: 100vh;
            padding: 2.5rem 1.5rem 3rem;
          }

          .app-shell__container {
            margin: 0 auto;
            max-width: 1120px;
          }

          .app-shell__header {
            align-items: flex-start;
            display: flex;
            gap: 1rem;
            justify-content: space-between;
            margin-bottom: 2rem;
          }

          .app-shell__actions {
            flex-shrink: 0;
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
            align-items: start;
            display: grid;
            gap: 1rem;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .task-column {
            min-height: 320px;
            padding: 1rem;
          }

          .task-column__header {
            align-items: center;
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.9rem;
          }

          .task-column__count {
            background: #edf1f7;
            border-radius: 999px;
            color: #425065;
            font-size: 0.85rem;
            font-weight: 700;
            padding: 0.25rem 0.55rem;
          }

          .task-column__items {
            display: grid;
            gap: 0.85rem;
          }

          .task-card {
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            padding: 1rem;
          }

          .task-card__header {
            align-items: flex-start;
            display: flex;
            gap: 0.75rem;
            justify-content: space-between;
            margin-bottom: 0.65rem;
          }

          .task-card__title {
            font-size: 1rem;
            font-weight: 700;
            margin: 0;
            overflow-wrap: anywhere;
          }

          .task-card__description {
            color: #526071;
            font-size: 0.94rem;
            margin: 0 0 0.85rem;
            overflow-wrap: anywhere;
          }

          .task-status-badge {
            border-radius: 999px;
            display: inline-flex;
            font-size: 0.8rem;
            font-weight: 700;
            padding: 0.28rem 0.62rem;
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

          .button {
            border: none;
            border-radius: 999px;
            cursor: pointer;
            display: inline-flex;
            font-size: 0.95rem;
            font-weight: 600;
            justify-content: center;
            padding: 0.8rem 1.1rem;
            text-decoration: none;
          }

          .button--primary {
            background: #1f2430;
            color: #ffffff;
          }

          .button--secondary {
            background: #edf1f7;
            color: #1f2430;
          }

          .create-task-row {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 1.5rem;
          }

          .move-task-action {
            display: flex;
            flex-wrap: wrap;
            gap: 0.45rem;
          }

          .move-task-action form {
            margin: 0;
          }

          .move-task-action button {
            background: #eef2f7;
            border: none;
            border-radius: 999px;
            color: #1f2430;
            cursor: pointer;
            font-size: 0.82rem;
            font-weight: 600;
            padding: 0.45rem 0.75rem;
          }

          .move-task-action button[disabled] {
            cursor: default;
            opacity: 0.55;
          }

          .feedback {
            border-radius: 14px;
            margin-bottom: 1rem;
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

          .empty-column-state {
            color: #667488;
            font-size: 0.92rem;
            padding: 0.6rem 0.15rem 0.2rem;
          }

          .task-form-modal {
            align-items: center;
            background: rgba(13, 21, 34, 0.42);
            display: flex;
            inset: 0;
            justify-content: center;
            padding: 1rem;
            position: fixed;
            z-index: 20;
          }

          .task-form-modal__panel {
            max-height: calc(100vh - 2rem);
            overflow: auto;
            padding: 1.3rem;
            width: min(100%, 480px);
          }

          .task-form-modal__field {
            display: grid;
            gap: 0.35rem;
            margin-bottom: 1rem;
          }

          .task-form-modal__field-input,
          .task-form-modal__field-textarea {
            border: 1px solid #d6dde7;
            border-radius: 14px;
            font: inherit;
            padding: 0.85rem 0.95rem;
            width: 100%;
          }

          .task-form-modal__field-textarea {
            min-height: 120px;
            resize: vertical;
          }

          .task-form-modal__actions {
            display: flex;
            gap: 0.75rem;
            justify-content: flex-end;
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

            .app-shell__actions {
              width: 100%;
            }

            .app-shell__title {
              font-size: 1.95rem;
            }

            .task-board {
              grid-template-columns: minmax(0, 1fr);
            }

            .task-column {
              min-height: auto;
            }

            .task-card__header {
              flex-direction: column;
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

            .task-form-modal__actions .button,
            .create-task-row .button {
              width: 100%;
            }

            .move-task-action button {
              flex: 1 1 calc(50% - 0.45rem);
            }
          }
        </style>
        """;
  }

  public String appShell(String title, String subtitle, String actionsHtml, String bodyHtml) {
    return """
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>%s</title>
            %s
          </head>
          <body>
            <div class="app-shell">
              <div class="app-shell__container">
                <header class="app-shell__header">
                  <div>
                    <div class="app-shell__eyebrow">APP Java Example</div>
                    <h1 class="app-shell__title">%s</h1>
                    %s
                  </div>
                  %s
                </header>
                %s
              </div>
            </div>
          </body>
        </html>
        """.formatted(
        escapeHtml(title),
        styles(),
        escapeHtml(title),
        subtitle == null || subtitle.isBlank()
            ? ""
            : "<p class=\"app-shell__subtitle\">" + escapeHtml(subtitle) + "</p>",
        actionsHtml == null || actionsHtml.isBlank()
            ? ""
            : "<div class=\"app-shell__actions\">" + actionsHtml + "</div>",
        bodyHtml == null ? "" : bodyHtml
    );
  }

  public String boardHeader(String title, String subtitle) {
    return """
        <section class="surface board-header">
          <h2 style="font-size: 1.1rem; margin: 0;">%s</h2>
          %s
        </section>
        """.formatted(
        escapeHtml(title),
        subtitle == null || subtitle.isBlank()
            ? ""
            : "<p style=\"color: #5f646d; margin: 0.45rem 0 0;\">" + escapeHtml(subtitle) + "</p>"
    );
  }

  public String createTaskButton(String href, boolean disabled) {
    if (disabled) {
      return "<button class=\"button button--primary\" disabled>New Task</button>";
    }

    return "<a class=\"button button--primary\" href=\"" + escapeHtmlAttribute(href) + "\">New Task</a>";
  }

  public String createTaskRow(String buttonHtml) {
    return "<section class=\"create-task-row\">" + buttonHtml + "</section>";
  }

  public String taskBoard(String columnsHtml) {
    return "<section class=\"task-board\">" + columnsHtml + "</section>";
  }

  public String taskColumn(String title, int count, String itemsHtml) {
    return """
        <section class="surface task-column">
          <header class="task-column__header">
            <h3 style="font-size: 1rem; margin: 0;">%s</h3>
            <span class="task-column__count">%d</span>
          </header>
          <div class="task-column__items">%s</div>
        </section>
        """.formatted(escapeHtml(title), count, itemsHtml == null ? "" : itemsHtml);
  }

  public String taskStatusBadge(String status) {
    return "<span class=\"task-status-badge task-status-badge--"
        + escapeHtmlAttribute(status)
        + "\">"
        + escapeHtml(status)
        + "</span>";
  }

  public String taskCard(String title, String description, String status, String actionsHtml) {
    return """
        <article class="surface task-card">
          <div class="task-card__header">
            <h4 class="task-card__title">%s</h4>
            %s
          </div>
          %s
          %s
        </article>
        """.formatted(
        escapeHtml(title),
        taskStatusBadge(status),
        description == null || description.isBlank()
            ? ""
            : "<p class=\"task-card__description\">" + escapeHtml(description) + "</p>",
        actionsHtml == null ? "" : actionsHtml
    );
  }

  public String moveTaskAction(String buttonsHtml) {
    return "<div class=\"move-task-action\">" + buttonsHtml + "</div>";
  }

  public String feedback(String type, String message) {
    if (message == null || message.isBlank()) {
      return "";
    }

    return "<div class=\"feedback feedback--" + escapeHtmlAttribute(type) + "\">"
        + escapeHtml(message)
        + "</div>";
  }

  public String emptyColumnState(String message) {
    return "<div class=\"empty-column-state\">" + escapeHtml(message) + "</div>";
  }

  public String taskFormModal(
      boolean open,
      String action,
      String titleValue,
      String descriptionValue,
      String errorMessage,
      String cancelHref,
      boolean submitting
  ) {
    if (!open) {
      return "";
    }

    return """
        <div class="task-form-modal">
          <div class="surface task-form-modal__panel">
            <h2 style="font-size: 1.25rem; margin-top: 0;">Create Task</h2>
            %s
            <form method="post" action="%s">
              <label class="task-form-modal__field">
                <span>Title</span>
                <input class="task-form-modal__field-input" type="text" name="title" value="%s" required />
              </label>
              <label class="task-form-modal__field">
                <span>Description</span>
                <textarea class="task-form-modal__field-textarea" name="description">%s</textarea>
              </label>
              <div class="task-form-modal__actions">
                <a class="button button--secondary" href="%s">Cancel</a>
                <button class="button button--primary" type="submit" %s>Create</button>
              </div>
            </form>
          </div>
        </div>
        """.formatted(
        feedback("error", errorMessage),
        escapeHtmlAttribute(action),
        escapeHtmlAttribute(titleValue == null ? "" : titleValue),
        escapeHtml(descriptionValue == null ? "" : descriptionValue),
        escapeHtmlAttribute(cancelHref),
        submitting ? "disabled" : ""
    );
  }

  public String escapeHtml(String value) {
    if (value == null) {
      return "";
    }

    return value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;");
  }

  public String escapeHtmlAttribute(String value) {
    return escapeHtml(value);
  }
}
