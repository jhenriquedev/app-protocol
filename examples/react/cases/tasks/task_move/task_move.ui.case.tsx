import type { ReactElement } from "react";
import { useState } from "react";

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
      currentStatus: Task["status"];
      submitting?: boolean;
      onMove?: (nextStatus: Task["status"]) => void;
    }): ReactElement;
  };
}

interface UiExtraShape {
  task?: Task;
  onTaskMoved?: (task: Task) => void;
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

  public view(): ReactElement {
    const packages = this.ctx.packages as UiPackages | undefined;
    const DesignSystem = packages?.designSystem;
    const extra = this.ctx.extra as UiExtraShape | undefined;

    if (!DesignSystem) {
      throw new Error("task_move.ui requires packages.designSystem");
    }

    if (!extra?.task) {
      throw new Error("task_move.ui requires extra.task");
    }

    const resolvedDesignSystem = DesignSystem;
    const self = this;
    const task = extra.task;
    const onTaskMoved = extra.onTaskMoved;

    function TaskMoveView(): ReactElement {
      const [state, setState] = useState<ViewState>({
        loading: false,
        error: null,
      });

      async function move(nextStatus: Task["status"]): Promise<void> {
        if (!self._acquireMoveLock()) {
          return;
        }

        setState({
          loading: true,
          error: null,
        });

        try {
          const result = await self._service({
            taskId: task.id,
            targetStatus: nextStatus,
          });

          onTaskMoved?.(result.task);

          setState({
            loading: false,
            error: null,
          });
        } catch (error: unknown) {
          setState({
            loading: false,
            error:
              error instanceof Error ? error.message : "Failed to move task",
          });
        } finally {
          self._releaseMoveLock();
        }
      }

      return (
        <div>
          <resolvedDesignSystem.MoveTaskAction
            currentStatus={task.status}
            submitting={state.loading}
            onMove={(nextStatus) => {
              void move(nextStatus);
            }}
          />
          {state.error ? (
            <div
              style={{
                color: "#9a2d1f",
                fontSize: "0.82rem",
                marginTop: "0.55rem",
              }}
            >
              {state.error}
            </div>
          ) : null}
        </div>
      );
    }

    return <TaskMoveView />;
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
