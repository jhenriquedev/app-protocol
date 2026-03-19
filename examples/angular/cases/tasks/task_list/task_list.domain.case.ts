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

export interface TaskListInput {
  [key: string]: never;
}

export interface TaskListOutput {
  tasks: Task[];
}

const TASK_STATUS_VALUES: TaskStatus[] = ["todo", "doing", "done"];

function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "string" &&
    TASK_STATUS_VALUES.includes(value as TaskStatus)
  );
}

function assertTaskRecord(
  value: unknown,
  source: string
): asserts value is Task {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${source} must be an object`);
  }

  const record = value as Record<string, unknown>;
  const requiredStringFields = ["id", "title", "createdAt", "updatedAt"] as const;

  for (const field of requiredStringFields) {
    if (
      typeof record[field] !== "string" ||
      (record[field] as string).trim().length === 0
    ) {
      throw new Error(`${source}.${field} must be a non-empty string`);
    }
  }

  if (!isTaskStatus(record.status)) {
    throw new Error(
      `${source}.status must be one of ${TASK_STATUS_VALUES.join(", ")}`
    );
  }

  if (
    record.description !== undefined &&
    typeof record.description !== "string"
  ) {
    throw new Error(`${source}.description must be a string when provided`);
  }
}

export function assertTaskCollection(
  value: unknown,
  source: string
): asserts value is Task[] {
  if (!Array.isArray(value)) {
    throw new Error(`${source} must be an array`);
  }

  value.forEach((task, index) => {
    assertTaskRecord(task, `${source}[${index}]`);
  });
}

export class TaskListDomain extends BaseDomainCase<
  TaskListInput,
  TaskListOutput
> {
  public caseName(): string {
    return "task_list";
  }

  public description(): string {
    return "Lists persisted task cards for board rendering.";
  }

  public inputSchema(): AppSchema {
    return {
      type: "object",
      properties: {},
      additionalProperties: false,
    };
  }

  public outputSchema(): AppSchema {
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
              status: { type: "string", enum: ["todo", "doing", "done"] },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
            required: ["id", "title", "status", "createdAt", "updatedAt"],
            additionalProperties: false,
          },
        },
      },
      required: ["tasks"],
      additionalProperties: false,
    };
  }

  public validate(input: TaskListInput): void {
    if (typeof input !== "object" || input === null) {
      throw new Error("input must be an object");
    }

    if (Object.keys(input).length > 0) {
      throw new Error("task_list does not accept filters in v1");
    }
  }

  public validateOutput(output: TaskListOutput): void {
    assertTaskCollection(output.tasks, "task_list.output.tasks");
  }

  public invariants(): string[] {
    return [
      `Only ${TASK_STATUS_VALUES.join(", ")} are valid task statuses.`,
      "Listing tasks never mutates the persisted store.",
      "The response order is deterministic for the same persisted dataset.",
    ];
  }

  public examples(): DomainExample<TaskListInput, TaskListOutput>[] {
    return [
      {
        name: "empty_board",
        description: "No persisted tasks yet.",
        input: {},
        output: {
          tasks: [],
        },
      },
      {
        name: "board_with_cards",
        description: "Returns tasks already persisted in the board.",
        input: {},
        output: {
          tasks: [
            {
              id: "task_002",
              title: "Prepare release notes",
              status: "todo",
              createdAt: "2026-03-18T12:10:00.000Z",
              updatedAt: "2026-03-18T12:10:00.000Z",
            },
            {
              id: "task_001",
              title: "Ship the Angular example",
              description: "Wire the first APP cases in the portal.",
              status: "doing",
              createdAt: "2026-03-18T12:00:00.000Z",
              updatedAt: "2026-03-18T12:30:00.000Z",
            },
          ],
        },
      },
    ];
  }

  public async test(): Promise<void> {
    this.validate({});

    let threw = false;
    try {
      this.validate({ status: "todo" } as unknown as TaskListInput);
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error("test: task_list input must reject filters");
    }

    const example = this.examples().find((item) => item.name === "board_with_cards");
    if (!example?.output) {
      throw new Error("test: board_with_cards example must exist");
    }

    this.validateOutput(example.output);

    threw = false;
    try {
      this.validateOutput({
        tasks: [
          {
            id: "bad",
            title: "Invalid task",
            status: "invalid",
            createdAt: "2026-03-18T12:00:00.000Z",
            updatedAt: "2026-03-18T12:00:00.000Z",
          } as unknown as Task,
        ],
      });
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error("test: validateOutput must reject invalid task status");
    }
  }
}
