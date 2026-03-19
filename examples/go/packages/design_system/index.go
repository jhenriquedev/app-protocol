package design_system

import (
	"fmt"
	"html/template"
	"strings"
)

type TaskStatus string

const (
	TaskStatusTodo  TaskStatus = "todo"
	TaskStatusDoing TaskStatus = "doing"
	TaskStatusDone  TaskStatus = "done"
)

func escape(value string) string {
	return template.HTMLEscapeString(value)
}

func Styles() template.HTML {
	return template.HTML(`
<style>
body {
  margin: 0;
}

.app-shell {
  background: linear-gradient(180deg, #f5f7fb 0%, #edf1f7 48%, #fdfefe 100%);
  color: #1f2430;
  font-family: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
  min-height: 100vh;
  padding: 2.5rem 1.5rem 3rem;
}

.app-shell__inner {
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

.board-header {
  margin-bottom: 1.25rem;
}

.task-board {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.task-column {
  background: #ffffff;
  border: 1px solid #d8dde6;
  border-radius: 20px;
  box-shadow: 0 20px 45px rgba(18, 26, 41, 0.08);
  min-height: 320px;
  padding: 1rem;
}

.task-column__header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.9rem;
}

.task-card {
  background: #f8fafc;
  border: 1px solid #d9e2ec;
  border-radius: 16px;
  margin-bottom: 0.85rem;
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
  color: #5f646d;
  font-size: 0.92rem;
  margin: 0.4rem 0 0;
}

.task-status-badge {
  border-radius: 999px;
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.35rem 0.6rem;
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
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.8rem 1.1rem;
}

.button--primary {
  background: #1f2430;
  color: #ffffff;
}

.button--secondary {
  background: #e8edf5;
  color: #1f2430;
}

.move-task-action {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.75rem;
}

.empty-column-state {
  color: #6b7280;
  font-size: 0.92rem;
}

.task-form {
  background: #ffffff;
  border: 1px solid #d8dde6;
  border-radius: 20px;
  box-shadow: 0 20px 45px rgba(18, 26, 41, 0.08);
  margin-bottom: 1.5rem;
  padding: 1rem;
}

.task-form__fields {
  display: grid;
  gap: 0.75rem;
}

.task-form__field {
  display: grid;
  gap: 0.35rem;
}

.task-form__field input,
.task-form__field textarea {
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  box-sizing: border-box;
  font: inherit;
  padding: 0.8rem 0.9rem;
  width: 100%;
}

.task-form__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

.feedback {
  border-radius: 14px;
  margin: 1rem 0;
  padding: 0.9rem 1rem;
}

.feedback--error {
  background: #ffe1dd;
  color: #9a2d1f;
}

.feedback--success {
  background: #dff7e4;
  color: #0c6a36;
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

  .task-column {
    min-height: auto;
  }

  .task-form__actions {
    flex-direction: column-reverse;
  }
}
</style>`)
}

func AppShell(title string, subtitle string, actions template.HTML, content template.HTML) template.HTML {
	return template.HTML(fmt.Sprintf(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>%s</title>
  %s
</head>
<body>
  <div class="app-shell">
    <div class="app-shell__inner">
      <header class="app-shell__header">
        <div>
          <div style="color:#637083;font-size:0.8rem;font-weight:700;letter-spacing:0.08em;margin-bottom:0.55rem;text-transform:uppercase;">
            APP Go Example
          </div>
          <h1 style="font-size:2.5rem;line-height:1.05;margin:0;">%s</h1>
          <p style="color:#5f646d;font-size:1rem;margin:0.7rem 0 0;max-width:52rem;">%s</p>
        </div>
        <div class="app-shell__actions">%s</div>
      </header>
      %s
    </div>
  </div>
</body>
</html>`,
		escape(title),
		Styles(),
		escape(title),
		escape(subtitle),
		actions,
		content,
	))
}

func BoardHeader(title string, subtitle string) template.HTML {
	return template.HTML(fmt.Sprintf(`
<section class="board-header">
  <h2 style="font-size:1.35rem;margin:0 0 0.35rem;">%s</h2>
  <p style="color:#5f646d;margin:0;">%s</p>
</section>`,
		escape(title),
		escape(subtitle),
	))
}

func CreateTaskForm(action string, titleValue string, descriptionValue string, errorMessage string) template.HTML {
	feedback := ""
	if errorMessage != "" {
		feedback = fmt.Sprintf(`<div class="feedback feedback--error">%s</div>`, escape(errorMessage))
	}

	return template.HTML(fmt.Sprintf(`
<section class="task-form">
  <form action="%s" method="post">
    <div class="task-form__fields">
      <div class="task-form__field">
        <label for="task-title">Title</label>
        <input id="task-title" name="title" value="%s" required>
      </div>
      <div class="task-form__field">
        <label for="task-description">Description</label>
        <textarea id="task-description" name="description" rows="3">%s</textarea>
      </div>
    </div>
    <div class="task-form__actions">
      <button class="button button--primary" type="submit">Create Task</button>
    </div>
  </form>
  %s
</section>`,
		escape(action),
		escape(titleValue),
		escape(descriptionValue),
		feedback,
	))
}

func TaskBoard(columns []template.HTML) template.HTML {
	return template.HTML(fmt.Sprintf(`<section class="task-board">%s</section>`, strings.Join(htmlSliceToString(columns), "")))
}

func TaskColumn(title string, count int, children []template.HTML) template.HTML {
	return template.HTML(fmt.Sprintf(`
<section class="task-column">
  <div class="task-column__header">
    <h3 style="font-size:1rem;margin:0;">%s</h3>
    <span style="color:#5f646d;font-size:0.88rem;">%d</span>
  </div>
  %s
</section>`,
		escape(title),
		count,
		strings.Join(htmlSliceToString(children), ""),
	))
}

func TaskStatusBadge(status TaskStatus) template.HTML {
	return template.HTML(fmt.Sprintf(
		`<span class="task-status-badge task-status-badge--%s">%s</span>`,
		escape(string(status)),
		escape(strings.ToUpper(strings.ReplaceAll(string(status), "_", " "))),
	))
}

func TaskCard(title string, description string, status TaskStatus, actions template.HTML) template.HTML {
	descriptionHTML := ""
	if description != "" {
		descriptionHTML = fmt.Sprintf(`<p class="task-card__description">%s</p>`, escape(description))
	}

	return template.HTML(fmt.Sprintf(`
<article class="task-card">
  <div class="task-card__header">
    <div>
      <h4 class="task-card__title">%s</h4>
      %s
    </div>
    %s
  </div>
  %s
</article>`,
		escape(title),
		descriptionHTML,
		TaskStatusBadge(status),
		actions,
	))
}

func MoveTaskAction(action string, currentStatus TaskStatus) template.HTML {
	targets := []TaskStatus{TaskStatusTodo, TaskStatusDoing, TaskStatusDone}
	var buttons []string

	for _, target := range targets {
		if target == currentStatus {
			continue
		}

		buttons = append(buttons, fmt.Sprintf(
			`<button class="button button--secondary" type="submit" name="targetStatus" value="%s">Move to %s</button>`,
			escape(string(target)),
			escape(strings.Title(string(target))),
		))
	}

	return template.HTML(fmt.Sprintf(`
<form action="%s" method="post">
  <div class="move-task-action">%s</div>
</form>`,
		escape(action),
		strings.Join(buttons, ""),
	))
}

func EmptyColumnState(message string) template.HTML {
	return template.HTML(fmt.Sprintf(`<p class="empty-column-state">%s</p>`, escape(message)))
}

func Feedback(kind string, message string) template.HTML {
	if message == "" {
		return template.HTML("")
	}

	return template.HTML(fmt.Sprintf(`<div class="feedback feedback--%s">%s</div>`, escape(kind), escape(message)))
}

func htmlSliceToString(values []template.HTML) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		result = append(result, string(value))
	}
	return result
}
