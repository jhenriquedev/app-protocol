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

export interface TaskMoveInput {
  taskId: string;
  targetStatus: TaskStatus;
}

export interface TaskMoveOutput {
  task: Task;
}

const TASK_STATUS_VALUES: TaskStatus[] = ["todo", "doing", "done"];

function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "string" &&
    TASK_STATUS_VALUES.includes(value as TaskStatus)
  );
}

export function assertTaskRecord(
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

export class TaskMoveDomain extends BaseDomainCase<
  TaskMoveInput,
  TaskMoveOutput
> {
  public caseName(): string {
    return "task_move";
  }

  public description(): string {
    return "Moves an existing task card to another board column.";
  }

  public inputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Identifier of the task that will be moved.",
        },
        targetStatus: {
          type: "string",
          description: "Destination board column for the task.",
          enum: [...TASK_STATUS_VALUES],
        },
      },
      required: ["taskId", "targetStatus"],
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
            status: { type: "string", enum: [...TASK_STATUS_VALUES] },
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

  public validate(input: TaskMoveInput): void {
    if (typeof input !== "object" || input === null) {
      throw new Error("input must be an object");
    }

    if (typeof input.taskId !== "string" || input.taskId.trim().length === 0) {
      throw new Error("taskId is required");
    }

    if (!isTaskStatus(input.targetStatus)) {
      throw new Error(
        `targetStatus must be one of ${TASK_STATUS_VALUES.join(", ")}`
      );
    }
  }

  public validateOutput(output: TaskMoveOutput): void {
    if (typeof output !== "object" || output === null) {
      throw new Error("output must be an object");
    }

    assertTaskRecord(output.task, "task_move.output.task");
  }

  public invariants(): string[] {
    return [
      "Moving a task never changes its identity.",
      "A move only updates status and, when applicable, updatedAt.",
      "Moving to the same status is idempotent and returns the unchanged task.",
    ];
  }

  public examples(): DomainExample<TaskMoveInput, TaskMoveOutput>[] {
    return [
      {
        name: "move_todo_to_doing",
        description: "A task leaves todo and enters doing.",
        input: {
          taskId: "task_001",
          targetStatus: "doing",
        },
        output: {
          task: {
            id: "task_001",
            title: "Ship the Node example",
            status: "doing",
            createdAt: "2026-03-18T12:00:00.000Z",
            updatedAt: "2026-03-18T12:20:00.000Z",
          },
        },
      },
      {
        name: "idempotent_move",
        description: "Moving to the same status keeps the task unchanged.",
        input: {
          taskId: "task_002",
          targetStatus: "done",
        },
        output: {
          task: {
            id: "task_002",
            title: "Prepare release notes",
            status: "done",
            createdAt: "2026-03-18T12:10:00.000Z",
            updatedAt: "2026-03-18T12:10:00.000Z",
          },
        },
      },
    ];
  }

  public async test(): Promise<void> {
    this.validate({
      taskId: "task_001",
      targetStatus: "doing",
    });

    let threw = false;
    try {
      this.validate({
        taskId: "",
        targetStatus: "doing",
      });
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error("test: validate must reject empty taskId");
    }

    threw = false;
    try {
      this.validate({
        taskId: "task_001",
        targetStatus: "invalid" as TaskStatus,
      });
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error("test: validate must reject invalid targetStatus");
    }

    this.validateOutput({
      task: {
        id: "task_001",
        title: "Valid task",
        status: "doing",
        createdAt: "2026-03-18T12:00:00.000Z",
        updatedAt: "2026-03-18T12:20:00.000Z",
      },
    });

    threw = false;
    try {
      this.validateOutput({
        task: {
          id: "task_001",
          title: "Broken task",
          description: 123 as unknown as string,
          status: "doing",
          createdAt: "2026-03-18T12:00:00.000Z",
          updatedAt: "2026-03-18T12:20:00.000Z",
        },
      });
    } catch {
      threw = true;
    }

    if (!threw) {
      throw new Error("test: validateOutput must reject invalid task payloads");
    }
  }
}
