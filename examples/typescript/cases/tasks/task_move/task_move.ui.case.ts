import { BaseUiCase, type UiContext } from "../../../core/ui.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";
import type { TaskMoveInput } from "./task_move.domain.case";

type TaskBoardStatus = TaskMoveInput["targetStatus"];

interface TaskMoveItem {
  id: string;
  status: TaskBoardStatus;
}

interface DesignSystemContract {
  MoveControls(props: {
    actionPath: string;
    itemId: string;
    currentStatus: TaskBoardStatus;
    errorMessage?: string;
  }): string;
}

type ExpectedPackagesMap = {
  designSystem?: DesignSystemContract;
};

function getDesignSystem(ctx: UiContext): DesignSystemContract {
  const designSystem = (ctx.packages as ExpectedPackagesMap | undefined)?.designSystem;
  if (!designSystem) {
    throw new AppCaseError(
      "INTERNAL",
      "task_move.ui requires ctx.packages.designSystem"
    );
  }

  return designSystem;
}

function getItem(ctx: UiContext): TaskMoveItem {
  const item = ctx.extra?.item as TaskMoveItem | undefined;
  if (!item) {
    throw new AppCaseError("INTERNAL", "task_move.ui requires ctx.extra.item");
  }

  return item;
}

export class TaskMoveUi extends BaseUiCase {
  constructor(ctx: UiContext) {
    super(ctx);
  }

  public view(): string {
    const actionPath =
      typeof this.ctx.extra?.actionPath === "string"
        ? this.ctx.extra.actionPath
        : "/actions/task-move";
    const item = getItem(this.ctx);
    const errorMessage =
      typeof this.ctx.extra?.errorMessage === "string"
        ? this.ctx.extra.errorMessage
        : undefined;

    return getDesignSystem(this.ctx).MoveControls({
      actionPath,
      itemId: item.id,
      currentStatus: item.status,
      errorMessage,
    });
  }

  public async test(): Promise<void> {
    const ui = new TaskMoveUi({
      correlationId: "test-task-move-ui",
      logger: console,
      packages: {
        designSystem: {
          MoveControls: ({ itemId }: { itemId: string }) => `<div>${itemId}</div>`,
        },
      },
      extra: {
        item: {
          id: "item_move",
          status: "active",
        },
      },
    });

    if (!ui.view().includes("item_move")) {
      throw new Error("task_move.ui test expected the current item id");
    }
  }
}
