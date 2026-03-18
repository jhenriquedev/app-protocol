import type { CSSProperties, FormEvent, PropsWithChildren, ReactNode } from "react";

export type TaskStatus = "todo" | "doing" | "done";

function DesignSystemStyles() {
  return (
    <style>{`
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

      .task-board {
        align-items: start;
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .task-column {
        min-height: 320px;
      }

      .task-card__header {
        align-items: flex-start;
        display: flex;
        gap: 0.75rem;
        justify-content: space-between;
        margin-bottom: 0.65rem;
      }

      .task-card__title {
        overflow-wrap: anywhere;
      }

      .move-task-action {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .task-form-modal__panel {
        max-height: calc(100vh - 2rem);
        overflow: auto;
        width: min(100%, 480px);
      }

      .task-form-modal__field {
        display: grid;
        gap: 0.35rem;
      }

      .task-form-modal__field-input {
        box-sizing: border-box;
        width: 100%;
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
          padding: 1.25rem 0.9rem 1.75rem !important;
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
          font-size: 1.95rem !important;
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
          align-items: flex-end !important;
          padding: 0.75rem !important;
        }

        .task-form-modal__panel {
          border-radius: 18px !important;
          max-height: calc(100vh - 1.5rem);
          width: 100%;
        }

        .task-form-modal__actions {
          flex-direction: column-reverse;
        }

        .task-form-modal__actions button {
          width: 100%;
        }

        .create-task-button {
          width: 100%;
        }

        .move-task-action button {
          flex: 1 1 calc(50% - 0.45rem);
        }
      }

      @media (max-width: 480px) {
        .app-shell__title {
          font-size: 1.7rem !important;
        }

        .task-card {
          padding: 0.85rem !important;
        }

        .move-task-action button {
          flex-basis: 100%;
        }
      }
    `}</style>
  );
}

const surfaceStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d8dde6",
  borderRadius: "20px",
  boxShadow: "0 20px 45px rgba(18, 26, 41, 0.08)",
};

const buttonStyle: CSSProperties = {
  border: "none",
  borderRadius: "999px",
  cursor: "pointer",
  fontSize: "0.95rem",
  fontWeight: 600,
  padding: "0.8rem 1.1rem",
};

const statusStyles: Record<TaskStatus, CSSProperties> = {
  todo: {
    background: "#fff4cc",
    color: "#7a5d00",
  },
  doing: {
    background: "#d9efff",
    color: "#005a91",
  },
  done: {
    background: "#dff7e4",
    color: "#0c6a36",
  },
};

export interface AppShellProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AppShell(props: AppShellProps) {
  return (
    <div
      className="app-shell"
      style={{
        background:
          "linear-gradient(180deg, #f5f7fb 0%, #edf1f7 48%, #fdfefe 100%)",
        color: "#1f2430",
        fontFamily:
          "\"IBM Plex Sans\", \"Avenir Next\", \"Segoe UI\", sans-serif",
        minHeight: "100vh",
        padding: "2.5rem 1.5rem 3rem",
      }}
    >
      <DesignSystemStyles />
      <div style={{ margin: "0 auto", maxWidth: "1120px" }}>
        <header className="app-shell__header">
          <div>
            <div
              style={{
                color: "#637083",
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                marginBottom: "0.55rem",
                textTransform: "uppercase",
              }}
            >
              APP React Example
            </div>
            <h1
              className="app-shell__title"
              style={{ fontSize: "2.5rem", lineHeight: 1.05, margin: 0 }}
            >
              {props.title}
            </h1>
            {props.subtitle ? (
              <p
                style={{
                  color: "#5f646d",
                  fontSize: "1rem",
                  margin: "0.7rem 0 0",
                  maxWidth: "52rem",
                }}
              >
                {props.subtitle}
              </p>
            ) : null}
          </div>

          {props.actions ? (
            <div className="app-shell__actions">{props.actions}</div>
          ) : null}
        </header>

        {props.children}
      </div>
    </div>
  );
}

export interface BoardHeaderProps {
  title: string;
  subtitle?: string;
}

export function BoardHeader(props: BoardHeaderProps) {
  return (
    <section
      style={{
        ...surfaceStyle,
        marginBottom: "1.5rem",
        padding: "1.15rem 1.25rem",
      }}
    >
      <h2 style={{ fontSize: "1.1rem", margin: 0 }}>{props.title}</h2>
      {props.subtitle ? (
        <p style={{ color: "#5f646d", margin: "0.45rem 0 0" }}>{props.subtitle}</p>
      ) : null}
    </section>
  );
}

export interface CreateTaskButtonProps {
  disabled?: boolean;
  onClick?: () => void;
}

export function CreateTaskButton(props: CreateTaskButtonProps) {
  return (
    <button
      className="create-task-button"
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        ...buttonStyle,
        background: props.disabled ? "#cfd5df" : "#1f2430",
        color: "#ffffff",
        justifyContent: "center",
        opacity: props.disabled ? 0.72 : 1,
      }}
    >
      New Task
    </button>
  );
}

export function TaskBoard(props: PropsWithChildren) {
  return (
    <section className="task-board">
      {props.children}
    </section>
  );
}

export interface TaskColumnProps extends PropsWithChildren {
  title: string;
  count: number;
}

export function TaskColumn(props: TaskColumnProps) {
  return (
    <section
      className="task-column"
      style={{
        ...surfaceStyle,
        padding: "1rem",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "0.9rem",
        }}
      >
        <h3 style={{ fontSize: "1rem", margin: 0 }}>{props.title}</h3>
        <span
          style={{
            background: "#edf1f7",
            borderRadius: "999px",
            color: "#425166",
            fontSize: "0.8rem",
            fontWeight: 700,
            minWidth: "2rem",
            padding: "0.2rem 0.55rem",
            textAlign: "center",
          }}
        >
          {props.count}
        </span>
      </div>

      <div style={{ display: "grid", gap: "0.85rem" }}>{props.children}</div>
    </section>
  );
}

export interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export function TaskStatusBadge(props: TaskStatusBadgeProps) {
  return (
    <span
      style={{
        ...statusStyles[props.status],
        borderRadius: "999px",
        display: "inline-flex",
        fontSize: "0.75rem",
        fontWeight: 700,
        padding: "0.35rem 0.65rem",
        textTransform: "uppercase",
      }}
    >
      {props.status}
    </span>
  );
}

export interface TaskCardProps {
  title: string;
  description?: string;
  status: TaskStatus;
  actions?: ReactNode;
}

export function TaskCard(props: TaskCardProps) {
  return (
    <article
      className="task-card"
      style={{
        background: "#fdfefe",
        border: "1px solid #e5eaf1",
        borderRadius: "16px",
        padding: "0.95rem",
      }}
    >
      <div className="task-card__header">
        <h4
          className="task-card__title"
          style={{ fontSize: "1rem", margin: 0 }}
        >
          {props.title}
        </h4>
        <TaskStatusBadge status={props.status} />
      </div>

      {props.description ? (
        <p style={{ color: "#5f646d", fontSize: "0.94rem", margin: 0 }}>
          {props.description}
        </p>
      ) : null}

      {props.actions ? <div style={{ marginTop: "0.85rem" }}>{props.actions}</div> : null}
    </article>
  );
}

export interface MoveTaskActionProps {
  currentStatus: TaskStatus;
  submitting?: boolean;
  onMove?: (nextStatus: TaskStatus) => void;
}

export function MoveTaskAction(props: MoveTaskActionProps) {
  return (
    <div className="move-task-action">
      {TASK_STATUSES.map((status) => (
        <button
          className="move-task-action__button"
          key={status}
          type="button"
          disabled={props.submitting || status === props.currentStatus}
          onClick={() => props.onMove?.(status)}
          style={{
            ...buttonStyle,
            background:
              props.submitting || status === props.currentStatus
                ? "#d6dce5"
                : "#edf1f7",
            color: "#2f3745",
            fontSize: "0.8rem",
            opacity: props.submitting ? 0.72 : 1,
            padding: "0.45rem 0.7rem",
          }}
        >
          Move to {status}
        </button>
      ))}
    </div>
  );
}

export interface TaskFormModalProps {
  open: boolean;
  titleValue: string;
  descriptionValue: string;
  submitting?: boolean;
  onTitleChange?: (value: string) => void;
  onDescriptionChange?: (value: string) => void;
  onClose?: () => void;
  onSubmit?: () => void;
}

export function TaskFormModal(props: TaskFormModalProps) {
  if (!props.open) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (props.submitting) {
      return;
    }

    props.onSubmit?.();
  }

  return (
    <div
      className="task-form-modal"
      style={{
        alignItems: "center",
        background: "rgba(18, 26, 41, 0.46)",
        display: "flex",
        inset: 0,
        justifyContent: "center",
        padding: "1rem",
        position: "fixed",
      }}
    >
      <form
        className="task-form-modal__panel"
        onSubmit={handleSubmit}
        style={{
          ...surfaceStyle,
          padding: "1.25rem",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Create task</h3>

        <label
          className="task-form-modal__field"
          style={{ marginBottom: "0.85rem" }}
        >
          <span>Title</span>
          <input
            className="task-form-modal__field-input"
            disabled={props.submitting}
            value={props.titleValue}
            onChange={(event) => props.onTitleChange?.(event.target.value)}
            style={{
              border: "1px solid #cad2de",
              borderRadius: "12px",
              font: "inherit",
              padding: "0.8rem 0.9rem",
            }}
          />
        </label>

        <label
          className="task-form-modal__field"
          style={{ marginBottom: "1rem" }}
        >
          <span>Description</span>
          <textarea
            className="task-form-modal__field-input"
            disabled={props.submitting}
            value={props.descriptionValue}
            onChange={(event) => props.onDescriptionChange?.(event.target.value)}
            rows={4}
            style={{
              border: "1px solid #cad2de",
              borderRadius: "12px",
              font: "inherit",
              padding: "0.8rem 0.9rem",
              resize: "vertical",
            }}
          />
        </label>

        <div className="task-form-modal__actions">
          <button
            type="button"
            disabled={props.submitting}
            onClick={props.onClose}
            style={{
              ...buttonStyle,
              background: "#edf1f7",
              color: "#2f3745",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={props.submitting}
            style={{
              ...buttonStyle,
              background: "#1f2430",
              color: "#ffffff",
            }}
          >
            {props.submitting ? "Saving..." : "Save task"}
          </button>
        </div>
      </form>
    </div>
  );
}

export interface EmptyColumnStateProps {
  message: string;
}

export function EmptyColumnState(props: EmptyColumnStateProps) {
  return (
    <div
      style={{
        border: "1px dashed #d1d8e2",
        borderRadius: "14px",
        color: "#637083",
        fontSize: "0.93rem",
        padding: "1rem",
      }}
    >
      {props.message}
    </div>
  );
}

export const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "done"];

export const DesignSystem = {
  AppShell,
  BoardHeader,
  CreateTaskButton,
  TaskBoard,
  TaskColumn,
  TaskCard,
  TaskStatusBadge,
  MoveTaskAction,
  TaskFormModal,
  EmptyColumnState,
  TASK_STATUSES,
} as const;
