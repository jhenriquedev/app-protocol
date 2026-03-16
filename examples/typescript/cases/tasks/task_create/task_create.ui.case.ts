/* ========================================================================== *
 * Example: task_create — UI Surface
 * --------------------------------------------------------------------------
 * Grammar: view <-> _viewmodel <-> _service <-> _repository
 * ========================================================================== */

import { BaseUiCase, UiContext, UIState } from "../../../core/ui.case";
import { TaskCreateInput, TaskCreateOutput } from "./task_create.domain.case";

/* --------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------ */

interface TaskCreateState extends UIState {
  title: string;
  description: string;
  result: TaskCreateOutput | null;
  loading: boolean;
  error: string | null;
}

/* --------------------------------------------------------------------------
 * UI Case
 * ------------------------------------------------------------------------ */

export class TaskCreateUi extends BaseUiCase<TaskCreateState> {
  constructor(ctx: UiContext) {
    super(ctx, {
      title: "",
      description: "",
      result: null,
      loading: false,
      error: null,
    });
  }

  public view(): unknown {
    const vm = this._viewmodel();

    return {
      type: "form",
      title: "Create Task",
      fields: vm.fields,
      submitLabel: vm.submitLabel,
      feedback: vm.feedback,
      onSubmit: () => this._service(),
    };
  }

  public async test(): Promise<void> {
    this.setState({ title: "Test task", description: "A test" });
    await this._service();
    const vm = this._viewmodel();
    if (!vm.feedback || vm.feedback.type !== "success") {
      throw new Error("Expected task creation to succeed for valid input");
    }
  }

  protected _viewmodel() {
    const { title, description, result, loading, error } = this.state;

    return {
      fields: [
        { name: "title", value: title, label: "Title", type: "text", required: true },
        { name: "description", value: description, label: "Description", type: "textarea" },
      ],
      submitLabel: loading ? "Creating..." : "Create Task",
      feedback: error
        ? { type: "error" as const, message: error }
        : result
          ? { type: "success" as const, message: `Task "${result.task.title}" created` }
          : null,
    };
  }

  protected async _service(): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const input: TaskCreateInput = {
        title: this.state.title,
        description: this.state.description || undefined,
      };

      const result = await this._repository(input);
      this.setState({ result, loading: false, title: "", description: "" });
    } catch (err) {
      this.setState({ error: (err as Error).message, loading: false });
    }
  }

  protected async _repository(
    input: TaskCreateInput
  ): Promise<TaskCreateOutput> {
    const response = await this.ctx.api?.request({
      method: "POST",
      url: "/tasks",
      body: input,
    });

    return response as TaskCreateOutput;
  }
}
