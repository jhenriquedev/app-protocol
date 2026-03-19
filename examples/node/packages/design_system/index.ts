export type TaskStatus = "todo" | "doing" | "done";

type Feedback = {
  type: "success" | "error";
  message: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderIfContent(content?: string): string {
  return content && content.trim().length > 0 ? content : "";
}

function renderFeedback(feedback?: Feedback | null, className = "feedback"): string {
  if (!feedback) {
    return "";
  }

  return `
    <div class="${className} ${className}--${feedback.type}">
      ${escapeHtml(feedback.message)}
    </div>
  `;
}

function renderStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "todo":
      return "To Do";
    case "doing":
      return "Doing";
    case "done":
      return "Done";
  }
}

const documentStyles = `
  :root {
    color-scheme: light;
    --surface-bg: #ffffff;
    --surface-border: #d8dde6;
    --surface-shadow: 0 20px 45px rgba(18, 26, 41, 0.08);
    --shell-bg: linear-gradient(180deg, #f5f7fb 0%, #edf1f7 48%, #fdfefe 100%);
    --ink: #1f2430;
    --muted: #5f646d;
    --todo-bg: #fff4cc;
    --todo-ink: #7a5d00;
    --doing-bg: #d9efff;
    --doing-ink: #005a91;
    --done-bg: #dff7e4;
    --done-ink: #0c6a36;
    --danger-bg: #ffe1dd;
    --danger-ink: #9a2d1f;
    --success-bg: #dff7e4;
    --success-ink: #0c6a36;
    --button-bg: #1f2430;
    --button-ink: #ffffff;
    --button-muted-bg: #cfd5df;
  }

  * {
    box-sizing: border-box;
  }

  body {
    background: var(--shell-bg);
    color: var(--ink);
    font-family: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
    margin: 0;
    min-height: 100vh;
  }

  button,
  input,
  textarea {
    font: inherit;
  }

  .app-shell {
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
    color: var(--muted);
    font-size: 1rem;
    margin: 0.7rem 0 0;
    max-width: 52rem;
  }

  .surface {
    background: var(--surface-bg);
    border: 1px solid var(--surface-border);
    border-radius: 20px;
    box-shadow: var(--surface-shadow);
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
    gap: 0.75rem;
    margin-bottom: 0.9rem;
  }

  .task-column__count {
    background: #eef2f7;
    border-radius: 999px;
    color: #465164;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.3rem 0.65rem;
  }

  .task-column__items {
    display: grid;
    gap: 0.85rem;
  }

  .task-card {
    border: 1px solid #e2e7ef;
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
    margin: 0;
    overflow-wrap: anywhere;
  }

  .task-card__description {
    color: var(--muted);
    font-size: 0.92rem;
    margin: 0 0 0.9rem;
    white-space: pre-wrap;
  }

  .task-status-badge {
    border-radius: 999px;
    display: inline-flex;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.3rem 0.65rem;
    white-space: nowrap;
  }

  .task-status-badge--todo {
    background: var(--todo-bg);
    color: var(--todo-ink);
  }

  .task-status-badge--doing {
    background: var(--doing-bg);
    color: var(--doing-ink);
  }

  .task-status-badge--done {
    background: var(--done-bg);
    color: var(--done-ink);
  }

  .empty-column-state {
    color: var(--muted);
    font-size: 0.92rem;
    margin: 0;
    padding: 0.35rem 0;
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
    background: var(--button-bg);
    color: var(--button-ink);
  }

  .button--disabled {
    background: var(--button-muted-bg);
    color: var(--button-ink);
    cursor: not-allowed;
    opacity: 0.72;
  }

  .create-task {
    margin-bottom: 1.5rem;
  }

  .create-task__actions {
    display: flex;
    justify-content: flex-end;
  }

  .task-form-modal {
    border: none;
    border-radius: 22px;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
    max-height: calc(100vh - 2rem);
    overflow: auto;
    padding: 0;
    width: min(100%, 480px);
  }

  .task-form-modal::backdrop {
    background: rgba(10, 16, 26, 0.5);
  }

  .task-form-modal__panel {
    padding: 1.25rem;
  }

  .task-form-modal__field {
    display: grid;
    gap: 0.35rem;
    margin-bottom: 0.9rem;
  }

  .task-form-modal__field-input {
    border: 1px solid #cdd5e3;
    border-radius: 12px;
    padding: 0.8rem 0.9rem;
    width: 100%;
  }

  .task-form-modal__actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }

  .task-form-modal__secondary {
    background: #e8edf5;
    color: #243042;
  }

  .feedback {
    border-radius: 14px;
    margin-bottom: 1rem;
    padding: 0.9rem 1rem;
  }

  .feedback--success {
    background: var(--success-bg);
    color: var(--success-ink);
  }

  .feedback--error {
    background: var(--danger-bg);
    color: var(--danger-ink);
  }

  .notice {
    border-radius: 16px;
    margin-bottom: 1rem;
    padding: 0.95rem 1rem;
  }

  .notice--success {
    background: var(--success-bg);
    color: var(--success-ink);
  }

  .notice--error {
    background: var(--danger-bg);
    color: var(--danger-ink);
  }

  .move-task-action {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .move-task-action__form {
    margin: 0;
  }

  .move-task-action__button {
    background: #eef2f7;
    color: #243042;
    font-size: 0.82rem;
    padding: 0.55rem 0.75rem;
  }

  .move-task-action__error {
    color: var(--danger-ink);
    font-size: 0.82rem;
    margin-top: 0.55rem;
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

    .app-shell__actions > * {
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

    .create-task__actions button {
      width: 100%;
    }

    .move-task-action__form {
      flex: 1 1 calc(50% - 0.45rem);
    }

    .move-task-action__button {
      width: 100%;
    }
  }

  @media (max-width: 480px) {
    .app-shell__title {
      font-size: 1.7rem;
    }

    .task-card {
      padding: 0.85rem;
    }

    .move-task-action__form {
      flex-basis: 100%;
    }
  }
`;

const dialogScript = `
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const openButton = target.closest("[data-dialog-open]");
    if (openButton instanceof HTMLElement) {
      const dialogId = openButton.getAttribute("data-dialog-open");
      if (!dialogId) {
        return;
      }

      const dialog = document.getElementById(dialogId);
      if (dialog instanceof HTMLDialogElement) {
        dialog.showModal();
      }
      return;
    }

    const closeButton = target.closest("[data-dialog-close]");
    if (closeButton instanceof HTMLElement) {
      const dialogId = closeButton.getAttribute("data-dialog-close");
      if (!dialogId) {
        return;
      }

      const dialog = document.getElementById(dialogId);
      if (dialog instanceof HTMLDialogElement) {
        dialog.close();
      }
    }
  });
`;

export interface RenderDocumentProps {
  title: string;
  body: string;
}

export function renderDocument(props: RenderDocumentProps): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(props.title)}</title>
    <style>${documentStyles}</style>
  </head>
  <body>
    ${props.body}
    <script>${dialogScript}</script>
  </body>
</html>`;
}

export interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: string;
  children?: string;
}

export function AppShell(props: AppShellProps): string {
  return `
    <div class="app-shell">
      <div class="app-shell__inner">
        <header class="app-shell__header">
          <div>
            <div class="app-shell__eyebrow">APP Node Example</div>
            <h1 class="app-shell__title">${escapeHtml(props.title)}</h1>
            ${props.subtitle ? `<p class="app-shell__subtitle">${escapeHtml(props.subtitle)}</p>` : ""}
          </div>
          ${props.actions ? `<div class="app-shell__actions">${props.actions}</div>` : ""}
        </header>
        ${renderIfContent(props.children)}
      </div>
    </div>
  `;
}

export interface BoardHeaderProps {
  title: string;
  subtitle?: string;
}

export function BoardHeader(props: BoardHeaderProps): string {
  return `
    <section class="surface board-header">
      <h2 style="font-size: 1.1rem; margin: 0;">${escapeHtml(props.title)}</h2>
      ${props.subtitle ? `<p style="color: #5f646d; margin: 0.45rem 0 0;">${escapeHtml(props.subtitle)}</p>` : ""}
    </section>
  `;
}

export interface NoticeProps {
  type: "success" | "error";
  message: string;
}

export function Notice(props: NoticeProps): string {
  return `<div class="notice notice--${props.type}">${escapeHtml(props.message)}</div>`;
}

export interface CreateTaskButtonProps {
  disabled?: boolean;
  targetDialogId?: string;
}

export function CreateTaskButton(props: CreateTaskButtonProps): string {
  const className = props.disabled
    ? "button button--disabled"
    : "button button--primary";

  return `
    <button
      class="${className}"
      type="button"
      ${props.disabled ? "disabled" : ""}
      data-dialog-open="${escapeHtml(props.targetDialogId ?? "create-task-dialog")}"
    >
      New Task
    </button>
  `;
}

export interface TaskFormModalProps {
  dialogId?: string;
  titleValue: string;
  descriptionValue: string;
  action?: string;
  submitting?: boolean;
  feedback?: Feedback | null;
  open?: boolean;
}

export function TaskFormModal(props: TaskFormModalProps): string {
  const dialogId = props.dialogId ?? "create-task-dialog";
  const buttonClassName = props.submitting
    ? "button button--disabled"
    : "button button--primary";

  return `
    <dialog
      id="${escapeHtml(dialogId)}"
      class="task-form-modal"
      ${props.open ? "open" : ""}
    >
      <div class="task-form-modal__panel">
        <h3 style="font-size: 1.15rem; margin: 0 0 0.9rem;">Create Task</h3>
        <p style="color: #5f646d; margin: 0 0 1rem;">
          Add a new card to the backlog using the canonical APP flow.
        </p>
        ${renderFeedback(props.feedback, "feedback")}
        <form method="post" action="${escapeHtml(props.action ?? "/actions/task-create")}">
          <label class="task-form-modal__field">
            <span>Title</span>
            <input
              class="task-form-modal__field-input"
              type="text"
              name="title"
              required
              value="${escapeHtml(props.titleValue)}"
            />
          </label>

          <label class="task-form-modal__field">
            <span>Description</span>
            <textarea
              class="task-form-modal__field-input"
              name="description"
              rows="4"
            >${escapeHtml(props.descriptionValue)}</textarea>
          </label>

          <div class="task-form-modal__actions">
            <button
              class="button task-form-modal__secondary"
              type="button"
              data-dialog-close="${escapeHtml(dialogId)}"
            >
              Cancel
            </button>
            <button
              class="${buttonClassName}"
              type="submit"
              ${props.submitting ? "disabled" : ""}
            >
              ${props.submitting ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  `;
}

export interface TaskBoardProps {
  children?: string;
}

export function TaskBoard(props: TaskBoardProps): string {
  return `<section class="task-board">${renderIfContent(props.children)}</section>`;
}

export interface TaskColumnProps {
  title: string;
  count: number;
  children?: string;
}

export function TaskColumn(props: TaskColumnProps): string {
  return `
    <section class="surface task-column">
      <div class="task-column__header">
        <h3 style="font-size: 1rem; margin: 0;">${escapeHtml(props.title)}</h3>
        <span class="task-column__count">${props.count}</span>
      </div>
      <div class="task-column__items">
        ${renderIfContent(props.children)}
      </div>
    </section>
  `;
}

export interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export function TaskStatusBadge(props: TaskStatusBadgeProps): string {
  return `
    <span class="task-status-badge task-status-badge--${props.status}">
      ${escapeHtml(renderStatusLabel(props.status))}
    </span>
  `;
}

export interface TaskCardProps {
  title: string;
  description?: string;
  status: TaskStatus;
  actions?: string;
}

export function TaskCard(props: TaskCardProps): string {
  return `
    <article class="task-card">
      <div class="task-card__header">
        <h4 class="task-card__title">${escapeHtml(props.title)}</h4>
        ${TaskStatusBadge({ status: props.status })}
      </div>
      ${props.description ? `<p class="task-card__description">${escapeHtml(props.description)}</p>` : ""}
      ${renderIfContent(props.actions)}
    </article>
  `;
}

export interface EmptyColumnStateProps {
  message: string;
}

export function EmptyColumnState(props: EmptyColumnStateProps): string {
  return `<p class="empty-column-state">${escapeHtml(props.message)}</p>`;
}

export interface MoveTaskActionProps {
  taskId: string;
  currentStatus: TaskStatus;
  action?: string;
  disabled?: boolean;
  error?: string | null;
}

export function MoveTaskAction(props: MoveTaskActionProps): string {
  const availableTargets = (["todo", "doing", "done"] as const).filter(
    (status) => status !== props.currentStatus
  );

  const forms = availableTargets
    .map((targetStatus) => {
      const disabled = props.disabled ? "disabled" : "";
      const className = props.disabled
        ? "button button--disabled move-task-action__button"
        : "button move-task-action__button";

      return `
        <form class="move-task-action__form" method="post" action="${escapeHtml(props.action ?? "/actions/task-move")}">
          <input type="hidden" name="taskId" value="${escapeHtml(props.taskId)}" />
          <input type="hidden" name="targetStatus" value="${targetStatus}" />
          <button class="${className}" type="submit" ${disabled}>
            Move to ${escapeHtml(renderStatusLabel(targetStatus))}
          </button>
        </form>
      `;
    })
    .join("");

  return `
    <div>
      <div class="move-task-action">${forms}</div>
      ${props.error ? `<div class="move-task-action__error">${escapeHtml(props.error)}</div>` : ""}
    </div>
  `;
}

export const DesignSystem = {
  renderDocument,
  AppShell,
  BoardHeader,
  Notice,
  CreateTaskButton,
  TaskFormModal,
  TaskBoard,
  TaskColumn,
  TaskCard,
  TaskStatusBadge,
  MoveTaskAction,
  EmptyColumnState,
} as const;
