/* ========================================================================== *
 * Example: task_complete — Domain Surface
 * ========================================================================== */

import { AppSchema, BaseDomainCase, DomainExample } from "../../../core/domain.case";
import { Task } from "../task_create/task_create.domain.case";

/* --------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------ */

export interface TaskCompleteInput {
  taskId: string;
}

export interface TaskCompleteOutput {
  task: Task;
}

/* --------------------------------------------------------------------------
 * Domain Case
 * ------------------------------------------------------------------------ */

export class TaskCompleteDomain extends BaseDomainCase<
  TaskCompleteInput,
  TaskCompleteOutput
> {
  caseName(): string {
    return "task_complete";
  }

  description(): string {
    return "Marks an existing task as done.";
  }

  inputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID of the task to complete" },
      },
      required: ["taskId"],
    };
  }

  outputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        task: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["pending", "done"] },
            createdAt: { type: "string" },
          },
          required: ["id", "title", "status", "createdAt"],
        },
      },
      required: ["task"],
    };
  }

  validate(input: TaskCompleteInput): void {
    if (!input.taskId || typeof input.taskId !== "string") {
      throw new Error("taskId is required and must be a string");
    }
  }

  invariants(): string[] {
    return [
      "Task must exist to be completed",
      "Task must not already be done",
      "Completing a task changes status from 'pending' to 'done'",
    ];
  }

  examples(): DomainExample<TaskCompleteInput, TaskCompleteOutput>[] {
    return [
      {
        name: "complete_task",
        description: "Mark a pending task as done",
        input: { taskId: "task-1" },
        output: {
          task: {
            id: "task-1",
            title: "Buy groceries",
            status: "done",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    ];
  }

  async test(): Promise<void> {
    const def = this.definition();
    if (!def.caseName) throw new Error("test: caseName is empty");
    if (!def.inputSchema.properties) throw new Error("test: inputSchema has no properties");

    this.validate!({ taskId: "task-1" });

    let threw = false;
    try { this.validate!({ taskId: "" }); } catch { threw = true; }
    if (!threw) throw new Error("test: validate should reject empty taskId");
  }
}
