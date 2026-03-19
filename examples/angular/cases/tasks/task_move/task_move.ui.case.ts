import { CommonModule, NgComponentOutlet } from "@angular/common";
import { Component, Input, Type, signal } from "@angular/core";

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

interface AngularViewUnit {
  component: Type<unknown>;
  inputs?: Record<string, unknown>;
}

interface TaskMoveDesignSystem {
  MoveTaskAction: Type<unknown>;
}

interface UiExtraShape {
  task?: Task;
  onTaskMoved?: (task: Task) => void;
}

@Component({
  selector: "app-task-move-view",
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
  template: `
    <div>
      <ng-container
        [ngComponentOutlet]="designSystem.MoveTaskAction"
        [ngComponentOutletInputs]="moveActionInputs"
      />

      <div
        *ngIf="state().error as error"
        style="color: #9a2d1f; font-size: 0.82rem; margin-top: 0.55rem;"
      >
        {{ error }}
      </div>
    </div>
  `,
})
class TaskMoveViewComponent {
  @Input({ required: true }) caseRef!: TaskMoveUi;
  @Input({ required: true }) designSystem!: TaskMoveDesignSystem;
  @Input({ required: true }) task!: Task;

  protected readonly state = signal<ViewState>({
    loading: false,
    error: null,
  });

  protected get moveActionInputs(): Record<string, unknown> {
    const state = this.state();

    return {
      currentStatus: this.task.status,
      submitting: state.loading,
      onMove: (nextStatus: Task["status"]) => {
        void this.move(nextStatus);
      },
    };
  }

  private async move(nextStatus: Task["status"]): Promise<void> {
    if (!this.caseRef.acquireMoveLock()) {
      return;
    }

    this.state.set({
      loading: true,
      error: null,
    });

    try {
      const result = await this.caseRef.runService({
        taskId: this.task.id,
        targetStatus: nextStatus,
      });

      this.caseRef.onTaskMoved(result.task);

      this.state.set({
        loading: false,
        error: null,
      });
    } catch (error: unknown) {
      this.state.set({
        loading: false,
        error:
          error instanceof Error ? error.message : "Failed to move task",
      });
    } finally {
      this.caseRef.releaseMoveLock();
    }
  }
}

export class TaskMoveUi extends BaseUiCase<ViewState> {
  private readonly domainCase = new TaskMoveDomain();
  private moveLocked = false;

  constructor(ctx: UiContext) {
    super(ctx, {
      loading: false,
      error: null,
    });
  }

  public view(): AngularViewUnit {
    const packages = this.ctx.packages as { designSystem?: TaskMoveDesignSystem } | undefined;
    const DesignSystem = packages?.designSystem;
    const extra = this.ctx.extra as UiExtraShape | undefined;

    if (!DesignSystem) {
      throw new Error("task_move.ui requires packages.designSystem");
    }

    if (!extra?.task) {
      throw new Error("task_move.ui requires extra.task");
    }

    return {
      component: TaskMoveViewComponent,
      inputs: {
        caseRef: this,
        designSystem: DesignSystem,
        task: extra.task,
      },
    };
  }

  public async test(): Promise<void> {
    const view = this.view();
    if (!view) {
      throw new Error("test: view must return a visual unit");
    }

    const result = await this._service({
      taskId: "task_001",
      targetStatus: "doing",
    });

    if (result.task.status !== "doing") {
      throw new Error("test: ui service must return the moved task");
    }

    let threw = false;
    try {
      await this._service({
        taskId: "",
        targetStatus: "done",
      });
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error("test: ui service must reject invalid input");
    }

    if (!this._acquireMoveLock()) {
      throw new Error("test: first move lock acquisition must succeed");
    }

    if (this._acquireMoveLock()) {
      throw new Error("test: move lock must reject reentry");
    }

    this._releaseMoveLock();

    if (!this._acquireMoveLock()) {
      throw new Error("test: move lock must be releasable");
    }

    this._releaseMoveLock();
  }

  public async runService(input: TaskMoveInput): Promise<TaskMoveOutput> {
    return this._service(input);
  }

  public onTaskMoved(task: Task): void {
    const extra = this.ctx.extra as UiExtraShape | undefined;
    extra?.onTaskMoved?.(task);
  }

  public acquireMoveLock(): boolean {
    return this._acquireMoveLock();
  }

  public releaseMoveLock(): void {
    this._releaseMoveLock();
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
    this.domainCase.validateOutput(result);
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
