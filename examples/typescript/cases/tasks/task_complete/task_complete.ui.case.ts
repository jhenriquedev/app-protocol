/* ========================================================================== *
 * Example: task_complete — UI Surface
 * --------------------------------------------------------------------------
 * Grammar: view <-> _viewmodel <-> _service <-> _repository
 * ========================================================================== */

import { BaseUiCase, UiContext, UIState } from "../../../core/ui.case";
import { Task } from "../task_create/task_create.domain.case";
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

    return {
      type: "form",
      title: "Complete Task",
      fields: vm.fields,
      submitLabel: vm.submitLabel,
      feedback: vm.feedback,
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

    return {
      fields: [
        { name: "taskId", value: taskId, label: "Task ID", type: "text", required: true },
      ],
      submitLabel: loading ? "Completing..." : "Complete Task",
      feedback: error
        ? { type: "error" as const, message: error }
        : result
          ? { type: "success" as const, message: `Task "${result.task.title}" marked as done` }
          : null,
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
}
