/* ========================================================================== *
 * Example: task_create — Domain Surface
 * ========================================================================== */

import { AppSchema, BaseDomainCase, DomainExample } from "../../../core/domain.case";

/* --------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------ */

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "done";
  createdAt: string;
}

export interface TaskCreateInput {
  title: string;
  description?: string;
}

export interface TaskCreateOutput {
  task: Task;
}

/* --------------------------------------------------------------------------
 * Domain Case
 * ------------------------------------------------------------------------ */

export class TaskCreateDomain extends BaseDomainCase<
  TaskCreateInput,
  TaskCreateOutput
> {
  caseName(): string {
    return "task_create";
  }

  description(): string {
    return "Creates a new task with title and optional description.";
  }

  inputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Optional task description" },
      },
      required: ["title"],
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

  validate(input: TaskCreateInput): void {
    if (!input.title || typeof input.title !== "string") {
      throw new Error("title is required and must be a string");
    }
    if (input.title.trim().length === 0) {
      throw new Error("title must not be empty");
    }
  }

  invariants(): string[] {
    return [
      "Title must be a non-empty string",
      "New tasks always start with status 'pending'",
      "createdAt is set at creation time and never changes",
    ];
  }

  examples(): DomainExample<TaskCreateInput, TaskCreateOutput>[] {
    return [
      {
        name: "simple_task",
        description: "Create a task with title only",
        input: { title: "Buy groceries" },
        output: {
          task: {
            id: "example-id",
            title: "Buy groceries",
            status: "pending",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
      {
        name: "task_with_description",
        description: "Create a task with title and description",
        input: { title: "Deploy v2", description: "Deploy the new version to production" },
        output: {
          task: {
            id: "example-id",
            title: "Deploy v2",
            description: "Deploy the new version to production",
            status: "pending",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    ];
  }

  async test(): Promise<void> {
    // Phase 1 — Definition integrity
    const def = this.definition();
    if (!def.caseName) throw new Error("test: caseName is empty");
    if (!def.description) throw new Error("test: description is empty");
    if (!def.inputSchema.properties) throw new Error("test: inputSchema has no properties");
    if (!def.outputSchema.properties) throw new Error("test: outputSchema has no properties");

    // Phase 2 — Validation behavior
    this.validate!({ title: "Valid task" });

    let threw = false;
    try { this.validate!({ title: "" }); } catch { threw = true; }
    if (!threw) throw new Error("test: validate should reject empty title");

    // Phase 3 — Examples consistency
    const examples = this.examples();
    if (!examples || examples.length === 0) throw new Error("test: no examples defined");
    for (const ex of examples) {
      this.validate!(ex.input);
    }
  }
}
