/* ========================================================================== *
 * Example: task_complete — API Surface
 * --------------------------------------------------------------------------
 * Atomic Case — uses _service, not _composition.
 * Persistence via ctx.db (injected by host).
 * ========================================================================== */

import { ApiContext, ApiResponse, BaseApiCase } from "../../../core/api.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";
import { Task } from "../task_create/task_create.domain.case";
import { TaskCompleteInput, TaskCompleteOutput } from "./task_complete.domain.case";

/* --------------------------------------------------------------------------
 * DB shape (provided by host via ctx.db)
 * ------------------------------------------------------------------------ */

interface TaskDb {
  tasks: Map<string, Task>;
}

/* --------------------------------------------------------------------------
 * API Case
 * ------------------------------------------------------------------------ */

export class TaskCompleteApi extends BaseApiCase<
  TaskCompleteInput,
  TaskCompleteOutput
> {
  constructor(ctx: ApiContext) {
    super(ctx);
  }

  public async handler(
    input: TaskCompleteInput
  ): Promise<ApiResponse<TaskCompleteOutput>> {
    return this.execute(input);
  }

  public router(): unknown {
    return {
      method: "PATCH",
      path: "/tasks/complete",
      handler: (req: { body: TaskCompleteInput }) => this.handler(req.body),
    };
  }

  public async test(): Promise<void> {
    if (!this._service) {
      throw new Error("test: _service must be implemented (atomic Case)");
    }

    await this._validate!({ taskId: "task-1" });

    let threw = false;
    try { await this._validate!({ taskId: "" }); } catch { threw = true; }
    if (!threw) throw new Error("test: _validate should reject empty taskId");
  }

  protected async _validate(input: TaskCompleteInput): Promise<void> {
    if (!input.taskId || input.taskId.trim().length === 0) {
      throw new AppCaseError("VALIDATION_FAILED", "taskId is required", {
        field: "taskId",
      });
    }
  }

  protected async _service(
    input: TaskCompleteInput
  ): Promise<TaskCompleteOutput> {
    const db = this.ctx.db as TaskDb | undefined;
    const task = db?.tasks.get(input.taskId);

    if (!task) {
      throw new AppCaseError("NOT_FOUND", `Task ${input.taskId} not found`);
    }

    if (task.status === "done") {
      throw new AppCaseError("CONFLICT", `Task ${input.taskId} is already done`);
    }

    const updated: Task = { ...task, status: "done" };
    db?.tasks.set(input.taskId, updated);

    this.ctx.logger.info("Task completed", { taskId: input.taskId });

    return { task: updated };
  }
}
