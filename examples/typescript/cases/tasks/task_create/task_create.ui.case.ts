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
  };
  dateUtils?: {
    formatDateTime(date: Date, locale?: string): string;
  };
};

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
    const packages = this.ctx.packages as UiPackages | undefined;
    const form = packages?.designSystem?.form;

    if (form) {
      return form({
        title: "Create Task",
        fields: vm.fields,
        submitLabel: vm.submitLabel,
        feedback: vm.feedback,
        meta: vm.meta,
        onSubmit: () => this._service(),
      });
    }

    return {
      type: "form",
      title: "Create Task",
      fields: vm.fields,
      submitLabel: vm.submitLabel,
      feedback: vm.feedback,
      meta: vm.meta,
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
    const packages = this.ctx.packages as UiPackages | undefined;
    const feedback = error
      ? this.buildFeedback("error", error, packages)
      : result
        ? this.buildFeedback(
            "success",
            `Task "${result.task.title}" created`,
            packages
          )
        : null;
    const createdAt = result
      ? packages?.dateUtils?.formatDateTime(new Date(result.task.createdAt))
        ?? result.task.createdAt
      : null;

    return {
      fields: [
        { name: "title", value: title, label: "Title", type: "text", required: true },
        { name: "description", value: description, label: "Description", type: "textarea" },
      ],
      submitLabel: loading ? "Creating..." : "Create Task",
      feedback,
      meta: createdAt ? { createdAt } : undefined,
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
