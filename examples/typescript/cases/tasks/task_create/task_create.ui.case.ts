import { BaseUiCase, type UiContext } from "../../../core/ui.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";

interface DesignSystemContract {
  Composer(props: {
    actionPath: string;
    titleValue?: string;
    descriptionValue?: string;
    errorMessage?: string;
  }): string;
}

type ExpectedPackagesMap = {
  designSystem?: DesignSystemContract;
};

type TaskCreateUiState = {
  titleValue?: string;
  descriptionValue?: string;
  errorMessage?: string;
};

function getDesignSystem(ctx: UiContext): DesignSystemContract {
  const designSystem = (ctx.packages as ExpectedPackagesMap | undefined)?.designSystem;
  if (!designSystem) {
    throw new AppCaseError(
      "INTERNAL",
      "task_create.ui requires ctx.packages.designSystem"
    );
  }

  return designSystem;
}

export class TaskCreateUi extends BaseUiCase<TaskCreateUiState> {
  constructor(ctx: UiContext) {
    super(ctx, {
      titleValue: typeof ctx.extra?.titleValue === "string" ? ctx.extra.titleValue : undefined,
      descriptionValue:
        typeof ctx.extra?.descriptionValue === "string"
          ? ctx.extra.descriptionValue
          : undefined,
      errorMessage:
        typeof ctx.extra?.errorMessage === "string" ? ctx.extra.errorMessage : undefined,
    });
  }

  public view(): string {
    const actionPath =
      typeof this.ctx.extra?.actionPath === "string"
        ? this.ctx.extra.actionPath
        : "/actions/task-create";

    return getDesignSystem(this.ctx).Composer({
      actionPath,
      titleValue: this.state.titleValue,
      descriptionValue: this.state.descriptionValue,
      errorMessage: this.state.errorMessage,
    });
  }

  public async test(): Promise<void> {
    const ui = new TaskCreateUi({
      correlationId: "test-task-create-ui",
      logger: console,
      packages: {
        designSystem: {
          Composer: ({ actionPath }: { actionPath: string }) =>
            `<form action="${actionPath}"></form>`,
        },
      },
      extra: {
        actionPath: "/actions/test",
      },
    });

    const rendered = ui.view();
    if (!rendered.includes("/actions/test")) {
      throw new Error("task_create.ui test expected the configured action path");
    }
  }
}
