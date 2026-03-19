import {
  BaseDomainCase,
  type AppSchema,
  type DomainExample,
} from "../../../core/domain.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";

export type TaskBoardStatus = "backlog" | "active" | "complete";

export interface TaskMoveInput {
  itemId: string;
  targetStatus: TaskBoardStatus;
}

export interface TaskMoveOutput {
  id: string;
  title: string;
  description?: string;
  status: TaskBoardStatus;
  createdAt: string;
  updatedAt: string;
}

export class TaskMoveDomain extends BaseDomainCase<TaskMoveInput, TaskMoveOutput> {
  public caseName(): string {
    return "task_move";
  }

  public description(): string {
    return "Move a persisted work item between board columns.";
  }

  public inputSchema(): AppSchema {
    return {
      type: "object",
      description: "Input required to move a work item to another board column.",
      properties: {
        itemId: {
          type: "string",
          description: "Identifier of the persisted work item.",
        },
        targetStatus: {
          type: "string",
          description: "Destination board column.",
          enum: ["backlog", "active", "complete"],
        },
      },
      required: ["itemId", "targetStatus"],
      additionalProperties: false,
    };
  }

  public outputSchema(): AppSchema {
    return {
      type: "object",
      description: "Updated work item after the move is persisted.",
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

  public validate(input: TaskMoveInput): void {
    if (typeof input.itemId !== "string" || input.itemId.trim().length === 0) {
      throw new AppCaseError(
        "VALIDATION_FAILED",
        "task_move requires a non-empty itemId"
      );
    }

    if (
      input.targetStatus !== "backlog" &&
      input.targetStatus !== "active" &&
      input.targetStatus !== "complete"
    ) {
      throw new AppCaseError(
        "VALIDATION_FAILED",
        "task_move targetStatus must be backlog, active, or complete"
      );
    }
  }

  public invariants(): string[] {
    return [
      "task_move preserves the original item id.",
      "Only the status and updatedAt fields change during a move.",
    ];
  }

  public examples(): DomainExample<TaskMoveInput, TaskMoveOutput>[] {
    return [
      {
        name: "advance_to_active",
        input: {
          itemId: "item_demo",
          targetStatus: "active",
        },
        output: {
          id: "item_demo",
          title: "Review release notes",
          status: "active",
          createdAt: "2026-03-18T12:00:00.000Z",
          updatedAt: "2026-03-18T12:30:00.000Z",
        },
      },
    ];
  }

  public async test(): Promise<void> {
    this.validate({
      itemId: "item_demo",
      targetStatus: "complete",
    });

    let failed = false;
    try {
      this.validate({
        itemId: "",
        targetStatus: "complete",
      });
    } catch (error) {
      failed = error instanceof AppCaseError;
    }

    if (!failed) {
      throw new Error("task_move.domain test expected invalid moves to fail");
    }
  }
}
