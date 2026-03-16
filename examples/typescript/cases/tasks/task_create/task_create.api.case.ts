/* ========================================================================== *
 * Example: task_create — API Surface
 * --------------------------------------------------------------------------
 * Atomic Case — uses _service, not _composition.
 * Persistence via ctx.db (injected by host).
 * ========================================================================== */

import { ApiContext, ApiResponse, BaseApiCase } from "../../../core/api.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";
import { Task, TaskCreateInput, TaskCreateOutput } from "./task_create.domain.case";

/* --------------------------------------------------------------------------
 * DB shape (provided by host via ctx.db)
 * ------------------------------------------------------------------------ */

interface TaskDb {
  tasks: Map<string, Task>;
}

/* --------------------------------------------------------------------------
 * API Case
 * ------------------------------------------------------------------------ */

export class TaskCreateApi extends BaseApiCase<
  TaskCreateInput,
  TaskCreateOutput
> {
  constructor(ctx: ApiContext) {
    super(ctx);
  }

  public async handler(
    input: TaskCreateInput
  ): Promise<ApiResponse<TaskCreateOutput>> {
    return this.execute(input);
  }

  public router(): unknown {
    return {
      method: "POST",
      path: "/tasks",
      handler: (req: { body: TaskCreateInput }) => this.handler(req.body),
    };
  }

  public async test(): Promise<void> {
    if (!this._service) {
      throw new Error("test: _service must be implemented (atomic Case)");
    }

    await this._validate!({ title: "Test task" });

    let threw = false;
    try { await this._validate!({ title: "" }); } catch { threw = true; }
    if (!threw) throw new Error("test: _validate should reject empty title");

    const result = await this.handler({ title: "Test task", description: "A test" });
    if (!result.success) throw new Error("test: handler returned failure");
    if (!result.data?.task.id) throw new Error("test: created task must have an id");
    if (result.data.task.status !== "pending") throw new Error("test: new task must be pending");
  }

  protected async _validate(input: TaskCreateInput): Promise<void> {
    if (!input.title || input.title.trim().length === 0) {
      throw new AppCaseError("VALIDATION_FAILED", "title is required", {
        field: "title",
      });
    }
  }

  protected async _service(input: TaskCreateInput): Promise<TaskCreateOutput> {
    const db = this.ctx.db as TaskDb | undefined;
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

    const task: Task = {
      id,
      title: input.title.trim(),
      description: input.description,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    db?.tasks.set(id, task);

    this.ctx.logger.info("Task created", { taskId: id, title: task.title });

    return { task };
  }
}
