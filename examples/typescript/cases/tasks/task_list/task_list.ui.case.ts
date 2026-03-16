/* ========================================================================== *
 * Example: task_list — UI Surface
 * --------------------------------------------------------------------------
 * Grammar: view <-> _viewmodel <-> _service <-> _repository
 * ========================================================================== */

import { BaseUiCase, UiContext, UIState } from "../../../core/ui.case";
import { Task } from "../task_create/task_create.domain.case";
import { TaskListInput, TaskListOutput } from "./task_list.domain.case";

/* --------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------ */

interface TaskListState extends UIState {
  statusFilter: string;
  tasks: Task[];
  loading: boolean;
  error: string | null;
}

type UiPackages = {
  designSystem?: {
    list(config: {
      title: string;
      filter: unknown;
      items: unknown[];
      feedback: { type: "success" | "error"; message: string } | null;
      meta?: Record<string, unknown>;
      onFilter: (value: string) => void;
    }): unknown;
    feedback(
      type: "success" | "error",
      message: string
    ): { type: "success" | "error"; message: string };
    badge(label: string, tone?: "neutral" | "success" | "danger"): unknown;
  };
  dateUtils?: {
    formatDateTime(date: Date, locale?: string): string;
    timeAgo(date: Date, locale?: string): string;
  };
};

/* --------------------------------------------------------------------------
 * UI Case
 * ------------------------------------------------------------------------ */

export class TaskListUi extends BaseUiCase<TaskListState> {
  constructor(ctx: UiContext) {
    super(ctx, {
      statusFilter: "",
      tasks: [],
      loading: false,
      error: null,
    });
  }

  public view(): unknown {
    const vm = this._viewmodel();
    const packages = this.ctx.packages as UiPackages | undefined;
    const list = packages?.designSystem?.list;

    if (list) {
      return list({
        title: "Task List",
        filter: vm.filter,
        items: vm.items,
        feedback: vm.feedback,
        meta: vm.meta,
        onFilter: (status: string) => {
          this.setState({ statusFilter: status });
          void this._service();
        },
      });
    }

    return {
      type: "list",
      title: "Task List",
      filter: vm.filter,
      items: vm.items,
      feedback: vm.feedback,
      meta: vm.meta,
      onFilter: (status: string) => {
        this.setState({ statusFilter: status });
        void this._service();
      },
    };
  }

  public async test(): Promise<void> {
    await this._service();
    const vm = this._viewmodel();
    if (!Array.isArray(vm.items)) {
      throw new Error("Expected items to be an array");
    }
  }

  protected _viewmodel() {
    const { statusFilter, tasks, loading, error } = this.state;
    const packages = this.ctx.packages as UiPackages | undefined;
    const feedback = error
      ? this.buildFeedback("error", error, packages)
      : null;

    return {
      filter: {
        name: "status",
        value: statusFilter,
        options: [
          { label: "All", value: "" },
          { label: "Pending", value: "pending" },
          { label: "Done", value: "done" },
        ],
      },
      items: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: packages?.designSystem?.badge?.(
          t.status,
          t.status === "done" ? "success" : "neutral"
        ) ?? t.status,
        createdAt:
          packages?.dateUtils?.formatDateTime(new Date(t.createdAt))
          ?? t.createdAt,
        createdAgo:
          packages?.dateUtils?.timeAgo?.(new Date(t.createdAt))
          ?? t.createdAt,
      })),
      loading,
      feedback,
      meta: { totalItems: tasks.length },
    };
  }

  protected async _service(): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const input: TaskListInput = {
        status: this.state.statusFilter
          ? (this.state.statusFilter as "pending" | "done")
          : undefined,
      };

      const result = await this._repository(input);
      this.setState({ tasks: result.tasks, loading: false });
    } catch (err) {
      this.setState({ error: (err as Error).message, loading: false });
    }
  }

  protected async _repository(
    input: TaskListInput
  ): Promise<TaskListOutput> {
    const query = input.status ? `?status=${input.status}` : "";
    const response = await this.ctx.api?.request({
      method: "GET",
      url: `/tasks${query}`,
    });

    return response as TaskListOutput;
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
