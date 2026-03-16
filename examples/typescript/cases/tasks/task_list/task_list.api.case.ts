/* ========================================================================== *
 * Example: task_list — API Surface
 * --------------------------------------------------------------------------
 * Atomic Case — uses _service, not _composition.
 * Persistence via ctx.db (injected by host).
 * ========================================================================== */

import { ApiContext, ApiResponse, BaseApiCase } from "../../../core/api.case";
import { Task } from "../task_create/task_create.domain.case";
import { TaskListInput, TaskListOutput } from "./task_list.domain.case";

/* --------------------------------------------------------------------------
 * DB shape (provided by host via ctx.db)
 * ------------------------------------------------------------------------ */

interface TaskDb {
  tasks: Map<string, Task>;
}

/* --------------------------------------------------------------------------
 * API Case
 * ------------------------------------------------------------------------ */

export class TaskListApi extends BaseApiCase<
  TaskListInput,
  TaskListOutput
> {
  constructor(ctx: ApiContext) {
    super(ctx);
  }

  public async handler(
    input: TaskListInput
  ): Promise<ApiResponse<TaskListOutput>> {
    return this.execute(input);
  }

  public router(): unknown {
    return {
      method: "GET",
      path: "/tasks",
      handler: (req: { query: TaskListInput }) => this.handler(req.query),
    };
  }

  public async test(): Promise<void> {
    if (!this._service) {
      throw new Error("test: _service must be implemented (atomic Case)");
    }

    const result = await this.handler({});
    if (!result.success) throw new Error("test: handler returned failure");
    if (!Array.isArray(result.data?.tasks)) throw new Error("test: tasks must be an array");
  }

  protected async _service(input: TaskListInput): Promise<TaskListOutput> {
    const db = this.ctx.db as TaskDb | undefined;
    const allTasks = [...(db?.tasks.values() ?? [])];

    const tasks = input.status
      ? allTasks.filter((t) => t.status === input.status)
      : allTasks;

    return { tasks };
  }
}
