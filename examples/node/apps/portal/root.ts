import type { UiContext } from "../../core/ui.case";
import type { PortalRegistry } from "./registry";

interface PortalTask {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "done";
  createdAt: string;
  updatedAt: string;
}

interface RenderableUiCase {
  view(): string;
}

interface PortalRootProps {
  registry: PortalRegistry;
  createUiContext: (extra?: Record<string, unknown>) => UiContext;
  taskCreateUi?: RenderableUiCase;
  flash?:
    | {
        type: "success" | "error";
        message: string;
      }
    | null;
  moveError?:
    | {
        taskId: string;
        message: string;
      }
    | null;
}

export async function PortalRoot(props: PortalRootProps): Promise<string> {
  const DesignSystem = props.registry._packages.designSystem;
  const TaskCreateUi = props.registry._cases.tasks.task_create.ui;
  const TaskListUi = props.registry._cases.tasks.task_list.ui;
  const TaskMoveUi = props.registry._cases.tasks.task_move.ui;
  const taskCreateUi =
    props.taskCreateUi ??
    new TaskCreateUi(
      props.createUiContext({
        actionPath: "/actions/task-create",
        dialogId: "create-task-dialog",
      })
    );

  const taskListUi = new TaskListUi(
    props.createUiContext({
      renderCardActions: (task: PortalTask) => {
        return new TaskMoveUi(
          props.createUiContext({
            task,
            actionPath: "/actions/task-move",
            errorMessage:
              props.moveError?.taskId === task.id
                ? props.moveError.message
                : undefined,
          })
        ).view();
      },
    })
  );

  await taskListUi.load({});

  const taskCreateView = taskCreateUi.view();
  const taskListView = taskListUi.view();

  return DesignSystem.renderDocument({
    title: "APP Node Example",
    body: DesignSystem.AppShell({
      title: "Task Board",
      subtitle:
        "Node APP example with create, list, and move wired through canonical Cases.",
      children: [
        props.flash ? DesignSystem.Notice(props.flash) : "",
        DesignSystem.BoardHeader({
          title: "Board",
          subtitle:
            "Tasks load from the backend and each card can move across columns through the UI surfaces.",
        }),
        taskCreateView,
        taskListView,
      ].join(""),
    }),
  });
}
