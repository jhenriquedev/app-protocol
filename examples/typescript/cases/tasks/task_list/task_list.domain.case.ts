/* ========================================================================== *
 * Example: task_list — Domain Surface
 * ========================================================================== */

import { AppSchema, BaseDomainCase, DomainExample } from "../../../core/domain.case";
import { Task } from "../task_create/task_create.domain.case";

/* --------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------ */

export interface TaskListInput {
  status?: "pending" | "done";
}

export interface TaskListOutput {
  tasks: Task[];
}

/* --------------------------------------------------------------------------
 * Domain Case
 * ------------------------------------------------------------------------ */

export class TaskListDomain extends BaseDomainCase<
  TaskListInput,
  TaskListOutput
> {
  caseName(): string {
    return "task_list";
  }

  description(): string {
    return "Lists tasks with optional status filter.";
  }

  inputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "done"],
          description: "Filter by task status",
        },
      },
    };
  }

  outputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          items: {
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
      },
      required: ["tasks"],
    };
  }

  validate(input: TaskListInput): void {
    if (input.status && !["pending", "done"].includes(input.status)) {
      throw new Error("status must be 'pending' or 'done'");
    }
  }

  invariants(): string[] {
    return [
      "Returns all tasks when no filter is provided",
      "When status filter is provided, returns only matching tasks",
    ];
  }

  examples(): DomainExample<TaskListInput, TaskListOutput>[] {
    return [
      {
        name: "list_all",
        description: "List all tasks without filter",
        input: {},
        output: { tasks: [] },
        notes: ["Empty list when no tasks exist"],
      },
      {
        name: "list_pending",
        description: "List only pending tasks",
        input: { status: "pending" },
        output: { tasks: [] },
      },
    ];
  }

  async test(): Promise<void> {
    const def = this.definition();
    if (!def.caseName) throw new Error("test: caseName is empty");
    if (!def.inputSchema.properties) throw new Error("test: inputSchema has no properties");

    this.validate!({});
    this.validate!({ status: "pending" });

    let threw = false;
    try { this.validate!({ status: "invalid" as "pending" }); } catch { threw = true; }
    if (!threw) throw new Error("test: validate should reject invalid status");
  }
}
