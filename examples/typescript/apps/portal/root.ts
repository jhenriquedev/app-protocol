import type { UiContext } from "../../core/ui.case";
import type { PortalRegistry } from "./registry";

interface PortalItem {
  id: string;
  title: string;
  description?: string;
  status: "backlog" | "active" | "complete";
  createdAt: string;
  updatedAt: string;
}

interface RenderableUiCase {
  view(): string;
}

interface PortalRootProps {
  registry: PortalRegistry;
  createUiContext: (extra?: Record<string, unknown>) => UiContext;
  flash?:
    | {
        tone: "success" | "error";
        message: string;
      }
    | null;
  createError?: string;
  createValues?: {
    title?: string;
    description?: string;
  };
  moveError?:
    | {
        itemId: string;
        message: string;
      }
    | null;
}

export async function renderPortalRoot(props: PortalRootProps): Promise<string> {
  const designSystem = props.registry._packages.designSystem;
  const TaskCreateUi = props.registry._cases.tasks.task_create.ui;
  const TaskListUi = props.registry._cases.tasks.task_list.ui;
  const TaskMoveUi = props.registry._cases.tasks.task_move.ui;

  const createUi = new TaskCreateUi(
    props.createUiContext({
      actionPath: "/actions/task-create",
      titleValue: props.createValues?.title,
      descriptionValue: props.createValues?.description,
      errorMessage: props.createError,
    })
  ) as RenderableUiCase;

  const listUi = new TaskListUi(
    props.createUiContext({
      renderActions: (item: PortalItem) =>
        new TaskMoveUi(
          props.createUiContext({
            item,
            actionPath: "/actions/task-move",
            errorMessage:
              props.moveError?.itemId === item.id ? props.moveError.message : undefined,
          })
        ).view(),
    })
  ) as RenderableUiCase & {
    load(): Promise<void>;
  };

  await listUi.load();

  const heroBody = props.flash
    ? designSystem.Notice({
        tone: props.flash.tone,
        message: props.flash.message,
      })
    : "";

  return designSystem.renderDocument({
    title: "APP TypeScript Task Studio",
    body: designSystem.AppShell({
      eyebrow: "APP Protocol / 100% TypeScript",
      title: "Task Studio",
      subtitle:
        "A plain TypeScript APP example with canonical backend, portal, and agent hosts.",
      hero: heroBody,
      body: [createUi.view(), listUi.view()].join(""),
    }),
  });
}
