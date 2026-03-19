import { BaseUiCase, type UIState, type UiContext } from "../../../core/ui.case";
import { type AppHttpClient } from "../../../core/shared/app_infra_contracts";
import {
  TaskCreateDomain,
  type TaskCreateInput,
  type TaskCreateOutput,
} from "./task_create.domain.case";

type ViewState = UIState & {
  modalOpen: boolean;
  title: string;
  description: string;
  loading: boolean;
  error: string | null;
  result: TaskCreateOutput | null;
};

interface UiPackages {
  designSystem?: {
    CreateTaskButton(props: {
      disabled?: boolean;
      targetDialogId?: string;
    }): string;
    TaskFormModal(props: {
      dialogId?: string;
      titleValue: string;
      descriptionValue: string;
      action?: string;
      submitting?: boolean;
      feedback?:
        | {
            type: "success" | "error";
            message: string;
          }
        | null;
      open?: boolean;
    }): string;
  };
}

interface UiExtraShape {
  actionPath?: string;
  dialogId?: string;
}

function createDesignSystemStub(): NonNullable<UiPackages["designSystem"]> {
  return {
    CreateTaskButton: () => "<button>Create Task</button>",
    TaskFormModal: () => "<dialog>Create Task</dialog>",
  };
}

export class TaskCreateUi extends BaseUiCase<ViewState> {
  private readonly domainCase = new TaskCreateDomain();
  private submissionLocked = false;

  constructor(ctx: UiContext) {
    super(ctx, {
      modalOpen: false,
      title: "",
      description: "",
      loading: false,
      error: null,
      result: null,
    });
  }

  public view(): string {
    const packages = this.ctx.packages as UiPackages | undefined;
    const DesignSystem = packages?.designSystem;

    if (!DesignSystem) {
      throw new Error("task_create.ui requires packages.designSystem");
    }

    const extra = this.ctx.extra as UiExtraShape | undefined;
    const viewModel = this._viewmodel(this.state);

    return `
      <section class="create-task">
        <div class="create-task__actions">
          ${DesignSystem.CreateTaskButton({
            disabled: this.state.loading,
            targetDialogId: extra?.dialogId ?? "create-task-dialog",
          })}
        </div>
        ${DesignSystem.TaskFormModal({
          dialogId: extra?.dialogId ?? "create-task-dialog",
          action: extra?.actionPath ?? "/actions/task-create",
          titleValue: this.state.title,
          descriptionValue: this.state.description,
          submitting: this.state.loading,
          feedback: viewModel.feedback,
          open: viewModel.open,
        })}
      </section>
    `;
  }

  public async submit(input: TaskCreateInput): Promise<TaskCreateOutput> {
    if (!this._acquireSubmissionLock()) {
      throw new Error("task_create.ui already has a submission in flight");
    }

    this.setState({
      modalOpen: true,
      title: input.title,
      description: input.description ?? "",
      loading: true,
      error: null,
      result: null,
    });

    try {
      const result = await this._service(input);
      this.setState({
        modalOpen: false,
        title: "",
        description: "",
        loading: false,
        error: null,
        result,
      });
      return result;
    } catch (error: unknown) {
      this.setState({
        modalOpen: true,
        title: input.title,
        description: input.description ?? "",
        loading: false,
        error: error instanceof Error ? error.message : "Failed to create task",
        result: null,
      });
      throw error;
    } finally {
      this._releaseSubmissionLock();
    }
  }

  public async test(): Promise<void> {
    const designSystem = createDesignSystemStub();
    const ui = new TaskCreateUi({
      correlationId: "task-create-ui-test",
      logger: this.ctx.logger,
      api: {
        request: async () => ({
          task: {
            id: "task_001",
            title: "Create task UI test",
            description: "UI surface repository flow",
            status: "todo",
            createdAt: "2026-03-18T12:00:00.000Z",
            updatedAt: "2026-03-18T12:00:00.000Z",
          },
        }),
      },
      packages: {
        designSystem,
      },
    });

    const initialView = ui.view();
    if (!initialView.includes("Create Task")) {
      throw new Error("test: view must return a visual unit");
    }

    const result = await ui.submit({
      title: "Create task UI test",
      description: "UI surface repository flow",
    });

    if (!result.task.id) {
      throw new Error("test: ui submit must return a created task id");
    }

    const viewModel = ui._viewmodel({
      modalOpen: false,
      title: "",
      description: "",
      loading: false,
      error: null,
      result,
    });

    if (viewModel.feedback?.type !== "success") {
      throw new Error("test: ui viewmodel must expose success feedback");
    }

    let threw = false;
    try {
      await ui.submit({ title: "   " });
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error("test: ui submit must reject blank title");
    }

    if (!ui._acquireSubmissionLock()) {
      throw new Error("test: first submission lock acquisition must succeed");
    }

    if (ui._acquireSubmissionLock()) {
      throw new Error("test: submission lock must reject reentry");
    }

    ui._releaseSubmissionLock();

    if (!ui._acquireSubmissionLock()) {
      throw new Error("test: submission lock must be releasable");
    }

    ui._releaseSubmissionLock();
  }

  protected _viewmodel(state: ViewState): {
    feedback:
      | {
          type: "success" | "error";
          message: string;
        }
      | null;
    open: boolean;
  } {
    if (state.error) {
      return {
        feedback: {
          type: "error",
          message: state.error,
        },
        open: true,
      };
    }

    if (state.result) {
      return {
        feedback: {
          type: "success",
          message: `Task "${state.result.task.title}" created successfully.`,
        },
        open: false,
      };
    }

    return {
      feedback: null,
      open: state.modalOpen,
    };
  }

  protected async _service(input: TaskCreateInput): Promise<TaskCreateOutput> {
    this.domainCase.validate(input);
    return this._repository(input);
  }

  protected async _repository(
    input: TaskCreateInput
  ): Promise<TaskCreateOutput> {
    const response = await this.resolveApiClient().request({
      method: "POST",
      url: "/tasks",
      body: input,
    });

    const result = response as TaskCreateOutput;
    if (!result?.task?.id) {
      throw new Error("task_create.ui received an invalid create response");
    }

    return result;
  }

  protected _acquireSubmissionLock(): boolean {
    if (this.submissionLocked) {
      return false;
    }

    this.submissionLocked = true;
    return true;
  }

  protected _releaseSubmissionLock(): void {
    this.submissionLocked = false;
  }

  private resolveApiClient(): AppHttpClient {
    if (!this.ctx.api) {
      throw new Error("task_create.ui requires ctx.api");
    }

    return this.ctx.api;
  }
}
