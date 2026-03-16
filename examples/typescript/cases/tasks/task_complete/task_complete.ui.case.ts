/* ========================================================================== *
 * Example: task_complete — UI Surface
 * --------------------------------------------------------------------------
 * Grammar: view <-> _viewmodel <-> _service <-> _repository
 * ========================================================================== */

import { BaseUiCase, UiContext, UIState } from "../../../core/ui.case";
import { TaskCompleteInput, TaskCompleteOutput } from "./task_complete.domain.case";

/* --------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------ */

interface TaskCompleteState extends UIState {
  taskId: string;
  result: TaskCompleteOutput | null;
  loading: boolean;
  error: string | null;
}

type UiPackages = {
  designSystem?: {
    form(config: {
      title: string;
      fields: Array<{
        name: string;
        value: string;
        label: string;
        type: string;
        required?: boolean;
      }>;
      submitLabel: string;
      feedback: { type: "success" | "error"; message: string } | null;
      meta?: Record<string, unknown>;
      onSubmit: () => void;
    }): unknown;
    feedback(
      type: "success" | "error",
      message: string
    ): { type: "success" | "error"; message: string };
    badge(label: string, tone?: "neutral" | "success" | "danger"): unknown;
  };
  dateUtils?: {
    formatDateTime(date: Date, locale?: string): string;
  };
};

/* --------------------------------------------------------------------------
 * UI Case
 * ------------------------------------------------------------------------ */

export class TaskCompleteUi extends BaseUiCase<TaskCompleteState> {
  constructor(ctx: UiContext) {
    super(ctx, {
      taskId: "",
      result: null,
      loading: false,
      error: null,
    });
  }

  public view(): unknown {
    const vm = this._viewmodel();
    const packages = this.ctx.packages as UiPackages | undefined;
    const form = packages?.designSystem?.form;

    if (form) {
      return form({
        title: "Complete Task",
        fields: vm.fields,
        submitLabel: vm.submitLabel,
        feedback: vm.feedback,
        meta: vm.meta,
        onSubmit: () => this._service(),
      });
    }

    return {
      type: "form",
      title: "Complete Task",
      fields: vm.fields,
      submitLabel: vm.submitLabel,
      feedback: vm.feedback,
      meta: vm.meta,
      onSubmit: () => this._service(),
    };
  }

  public async test(): Promise<void> {
    this.setState({ taskId: "task-1" });
    const vm = this._viewmodel();
    if (!vm.fields || vm.fields.length === 0) {
      throw new Error("Expected at least one field in viewmodel");
    }
  }

  protected _viewmodel() {
    const { taskId, result, loading, error } = this.state;
    const packages = this.ctx.packages as UiPackages | undefined;
    const feedback = error
      ? this.buildFeedback("error", error, packages)
      : result
        ? this.buildFeedback(
            "success",
            `Task "${result.task.title}" marked as done`,
            packages
          )
        : null;
    const completedAt = result
      ? packages?.dateUtils?.formatDateTime(new Date(result.task.createdAt))
        ?? result.task.createdAt
      : null;
    const statusBadge = result
      ? packages?.designSystem?.badge?.(result.task.status, "success")
        ?? result.task.status
      : null;

    return {
      fields: [
        { name: "taskId", value: taskId, label: "Task ID", type: "text", required: true },
      ],
      submitLabel: loading ? "Completing..." : "Complete Task",
      feedback,
      meta: result
        ? {
            status: statusBadge,
            createdAt: completedAt,
          }
        : undefined,
    };
  }

  protected async _service(): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const input: TaskCompleteInput = { taskId: this.state.taskId };
      const result = await this._repository(input);
      this.setState({ result, loading: false, taskId: "" });
    } catch (err) {
      this.setState({ error: (err as Error).message, loading: false });
    }
  }

  protected async _repository(
    input: TaskCompleteInput
  ): Promise<TaskCompleteOutput> {
    const response = await this.ctx.api?.request({
      method: "PATCH",
      url: "/tasks/complete",
      body: input,
    });

    return response as TaskCompleteOutput;
  }

  private buildFeedback(
    type: "success" | "error",
    message: string,
    packages?: UiPackages
  ) {
    return packages?.designSystem?.feedback
      ? packages.designSystem.feedback(type, message)
      : { type, message };
  }
}
