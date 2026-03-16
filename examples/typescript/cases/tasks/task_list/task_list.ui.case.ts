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

    return {
      type: "list",
      title: "Task List",
      filter: vm.filter,
      items: vm.items,
      feedback: vm.feedback,
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
        status: t.status,
        createdAt: t.createdAt,
      })),
      loading,
      feedback: error
        ? { type: "error" as const, message: error }
        : null,
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
}
