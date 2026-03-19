import {
  AppSchema,
  BaseDomainCase,
  type DomainExample,
} from "../../../core/domain.case";

export type TaskStatus = "todo" | "doing" | "done";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCreateInput {
  title: string;
  description?: string;
}

export interface TaskCreateOutput {
  task: Task;
}

export class TaskCreateDomain extends BaseDomainCase<
  TaskCreateInput,
  TaskCreateOutput
> {
  public caseName(): string {
    return "task_create";
  }

  public description(): string {
    return "Creates a new task card for the board with an initial todo status.";
  }

  public inputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Visible task title shown on the card.",
        },
        description: {
          type: "string",
          description: "Optional complementary task description.",
        },
      },
      required: ["title"],
      additionalProperties: false,
    };
  }

  public outputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        task: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["todo", "doing", "done"] },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
          required: ["id", "title", "status", "createdAt", "updatedAt"],
          additionalProperties: false,
        },
      },
      required: ["task"],
      additionalProperties: false,
    };
  }

  public validate(input: TaskCreateInput): void {
    if (typeof input !== "object" || input === null) {
      throw new Error("input must be an object");
    }

    if (typeof input.title !== "string") {
      throw new Error("title is required and must be a string");
    }

    if (input.title.trim().length === 0) {
      throw new Error("title must not be empty");
    }

    if (
      input.description !== undefined &&
      typeof input.description !== "string"
    ) {
      throw new Error("description must be a string when provided");
    }

    const forbiddenFields = ["id", "status", "createdAt", "updatedAt"];
    const inputRecord = input as unknown as Record<string, unknown>;
    for (const field of forbiddenFields) {
      if (field in inputRecord) {
        throw new Error(`${field} must not be provided by the caller`);
      }
    }
  }

  public invariants(): string[] {
    return [
      "Every new task starts with status todo.",
      "The backend is the source of truth for task id and timestamps.",
      "createdAt and updatedAt are equal on first creation.",
    ];
  }

  public examples(): DomainExample<TaskCreateInput, TaskCreateOutput>[] {
    return [
      {
        name: "title_only",
        description: "Create a task with only the required title.",
        input: {
          title: "Ship the Node example",
        },
        output: {
          task: {
            id: "task_001",
            title: "Ship the Node example",
            status: "todo",
            createdAt: "2026-03-18T12:00:00.000Z",
            updatedAt: "2026-03-18T12:00:00.000Z",
          },
        },
      },
      {
        name: "title_and_description",
        description: "Create a task with an optional description.",
        input: {
          title: "Prepare release notes",
          description: "Summarize the scope of the first Node APP example.",
        },
        output: {
          task: {
            id: "task_002",
            title: "Prepare release notes",
            description: "Summarize the scope of the first Node APP example.",
            status: "todo",
            createdAt: "2026-03-18T12:10:00.000Z",
            updatedAt: "2026-03-18T12:10:00.000Z",
          },
        },
      },
    ];
  }

  public async test(): Promise<void> {
    const definition = this.definition();

    if (definition.caseName !== "task_create") {
      throw new Error("test: caseName must be task_create");
    }

    if (!definition.inputSchema.required?.includes("title")) {
      throw new Error("test: inputSchema must require title");
    }

    this.validate({
      title: "Valid task",
      description: "Optional text",
    });

    let threw = false;
    try {
      this.validate({ title: "   " });
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error("test: validate must reject blank title");
    }

    threw = false;
    try {
      this.validate(
        {
          title: "Bad task",
          status: "todo",
        } as unknown as TaskCreateInput
      );
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error("test: validate must reject forbidden fields");
    }

    const examples = this.examples();
    if (examples.length === 0) {
      throw new Error("test: examples must be defined");
    }

    for (const example of examples) {
      this.validate(example.input);
      if (example.output?.task.status !== "todo") {
        throw new Error("test: example output must start in todo");
      }
    }
  }
}
