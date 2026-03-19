import {
  BaseDomainCase,
  type DomainExample,
  type AppSchema,
} from "../../../core/domain.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";

export interface TaskCreateInput {
  title: string;
  description?: string;
}

export type TaskBoardStatus = "backlog" | "active" | "complete";

export interface TaskCreateOutput {
  id: string;
  title: string;
  description?: string;
  status: TaskBoardStatus;
  createdAt: string;
  updatedAt: string;
}

export class TaskCreateDomain extends BaseDomainCase<
  TaskCreateInput,
  TaskCreateOutput
> {
  public caseName(): string {
    return "task_create";
  }

  public description(): string {
    return "Create a new work item for the task studio board.";
  }

  public inputSchema(): AppSchema {
    return {
      type: "object",
      description: "Input required to create a work item.",
      properties: {
        title: {
          type: "string",
          description: "Visible title of the work item.",
        },
        description: {
          type: "string",
          description: "Optional detail that gives context to the work item.",
        },
      },
      required: ["title"],
      additionalProperties: false,
    };
  }

  public outputSchema(): AppSchema {
    return {
      type: "object",
      description: "Created work item persisted to the studio board.",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: {
          type: "string",
          enum: ["backlog", "active", "complete"],
        },
        createdAt: { type: "string" },
        updatedAt: { type: "string" },
      },
      required: ["id", "title", "status", "createdAt", "updatedAt"],
      additionalProperties: false,
    };
  }

  public validate(input: TaskCreateInput): void {
    if (typeof input.title !== "string" || input.title.trim().length === 0) {
      throw new AppCaseError(
        "VALIDATION_FAILED",
        "task_create requires a non-empty title"
      );
    }

    if (
      input.description !== undefined &&
      typeof input.description !== "string"
    ) {
      throw new AppCaseError(
        "VALIDATION_FAILED",
        "task_create description must be a string when provided"
      );
    }
  }

  public invariants(): string[] {
    return [
      "New items always start in backlog.",
      "The title is mandatory and trimmed before persistence.",
      "createdAt and updatedAt are emitted as ISO timestamps.",
    ];
  }

  public examples(): DomainExample<TaskCreateInput, TaskCreateOutput>[] {
    return [
      {
        name: "new_brief",
        description: "Create a planning item with both title and description.",
        input: {
          title: "Write launch brief",
          description: "Capture the launch narrative for the next release.",
        },
        output: {
          id: "item_demo",
          title: "Write launch brief",
          description: "Capture the launch narrative for the next release.",
          status: "backlog",
          createdAt: "2026-03-18T12:00:00.000Z",
          updatedAt: "2026-03-18T12:00:00.000Z",
        },
      },
    ];
  }

  public async test(): Promise<void> {
    this.validate({
      title: "Draft roadmap",
      description: "Sequence the next quarter initiatives.",
    });

    let failed = false;
    try {
      this.validate({ title: "   " });
    } catch (error: unknown) {
      failed =
        error instanceof AppCaseError && error.code === "VALIDATION_FAILED";
    }

    if (!failed) {
      throw new Error("task_create.domain test expected blank titles to fail");
    }
  }
}
