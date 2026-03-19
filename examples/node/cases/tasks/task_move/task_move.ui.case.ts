import { BaseUiCase, type UIState, type UiContext } from "../../../core/ui.case";
import { type AppHttpClient } from "../../../core/shared/app_infra_contracts";
import {
  TaskMoveDomain,
  type Task,
  type TaskMoveInput,
  type TaskMoveOutput,
} from "./task_move.domain.case";

type ViewState = UIState & {
  loading: boolean;
  error: string | null;
};

interface UiPackages {
  designSystem?: {
    MoveTaskAction(props: {
      taskId: string;
      currentStatus: Task["status"];
      action?: string;
      disabled?: boolean;
      error?: string | null;
    }): string;
  };
}

interface UiExtraShape {
  task?: Task;
  actionPath?: string;
  errorMessage?: string;
}

function createDesignSystemStub(): NonNullable<UiPackages["designSystem"]> {
  return {
    MoveTaskAction: ({ taskId }) => `<div>${taskId}</div>`,
  };
}

export class TaskMoveUi extends BaseUiCase<ViewState> {
  private readonly domainCase = new TaskMoveDomain();
  private moveLocked = false;

  constructor(ctx: UiContext) {
    super(ctx, {
      loading: false,
      error:
        ((ctx.extra as UiExtraShape | undefined)?.errorMessage as string | undefined) ??
        null,
    });
  }

  public view(): string {
    const packages = this.ctx.packages as UiPackages | undefined;
    const DesignSystem = packages?.designSystem;
    const extra = this.ctx.extra as UiExtraShape | undefined;

    if (!DesignSystem) {
      throw new Error("task_move.ui requires packages.designSystem");
    }

    if (!extra?.task) {
      throw new Error("task_move.ui requires extra.task");
    }

    return DesignSystem.MoveTaskAction({
      taskId: extra.task.id,
      currentStatus: extra.task.status,
      action: extra.actionPath ?? "/actions/task-move",
      disabled: this.state.loading,
      error: this.state.error,
    });
  }

  public async submit(input: TaskMoveInput): Promise<TaskMoveOutput> {
    if (!this._acquireMoveLock()) {
      throw new Error("task_move.ui already has a move in flight");
    }

    this.setState({
      loading: true,
      error: null,
    });

    try {
      const result = await this._service(input);
      this.setState({
        loading: false,
        error: null,
      });
      return result;
    } catch (error: unknown) {
      this.setState({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to move task",
      });
      throw error;
    } finally {
      this._releaseMoveLock();
    }
  }

  public async test(): Promise<void> {
    const ui = new TaskMoveUi({
      correlationId: "task-move-ui-test",
      logger: this.ctx.logger,
      api: {
        request: async () => ({
          task: {
            id: "task_001",
            title: "Moved task",
            status: "doing",
            createdAt: "2026-03-18T12:00:00.000Z",
            updatedAt: "2026-03-18T12:20:00.000Z",
          },
        }),
      },
      packages: {
        designSystem: createDesignSystemStub(),
      },
      extra: {
        task: {
          id: "task_001",
          title: "Todo task",
          status: "todo",
          createdAt: "2026-03-18T12:00:00.000Z",
          updatedAt: "2026-03-18T12:00:00.000Z",
        },
      },
    });

    const view = ui.view();
    if (!view.includes("task_001")) {
      throw new Error("test: view must return a visual unit");
    }

    const result = await ui.submit({
      taskId: "task_001",
      targetStatus: "doing",
    });

    if (result.task.status !== "doing") {
      throw new Error("test: ui submit must return the moved task");
    }

    let threw = false;
    try {
      await ui.submit({
        taskId: "",
        targetStatus: "done",
      });
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error("test: ui submit must reject invalid input");
    }

    if (!ui._acquireMoveLock()) {
      throw new Error("test: first move lock acquisition must succeed");
    }

    if (ui._acquireMoveLock()) {
      throw new Error("test: move lock must reject reentry");
    }

    ui._releaseMoveLock();

    if (!ui._acquireMoveLock()) {
      throw new Error("test: move lock must be releasable");
    }

    ui._releaseMoveLock();
  }

  protected async _service(input: TaskMoveInput): Promise<TaskMoveOutput> {
    this.domainCase.validate(input);
    return this._repository(input);
  }

  protected async _repository(
    input: TaskMoveInput
  ): Promise<TaskMoveOutput> {
    const response = await this.resolveApiClient().request({
      method: "PATCH",
      url: `/tasks/${input.taskId}/status`,
      body: {
        targetStatus: input.targetStatus,
      },
    });

    const result = response as TaskMoveOutput;
    if (!result?.task?.id) {
      throw new Error("task_move.ui received an invalid move response");
    }

    return result;
  }

  protected _acquireMoveLock(): boolean {
    if (this.moveLocked) {
      return false;
    }

    this.moveLocked = true;
    return true;
  }

  protected _releaseMoveLock(): void {
    this.moveLocked = false;
  }

  private resolveApiClient(): AppHttpClient {
    if (!this.ctx.api) {
      throw new Error("task_move.ui requires ctx.api");
    }

    return this.ctx.api;
  }
}
