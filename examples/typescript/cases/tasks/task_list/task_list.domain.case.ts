import { BaseDomainCase, type AppSchema, type DomainExample } from "../../../core/domain.case";

export type TaskBoardStatus = "backlog" | "active" | "complete";

export interface TaskListInput {}

export interface TaskListItem {
  id: string;
  title: string;
  description?: string;
  status: TaskBoardStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListOutput {
  items: TaskListItem[];
}

export class TaskListDomain extends BaseDomainCase<TaskListInput, TaskListOutput> {
  public caseName(): string {
    return "task_list";
  }

  public description(): string {
    return "Load the current work items for the studio board.";
  }

  public inputSchema(): AppSchema {
    return {
      type: "object",
      description: "task_list currently does not require filters.",
      properties: {},
      additionalProperties: false,
    };
  }

  public outputSchema(): AppSchema {
    return {
      type: "object",
      description: "Current board items grouped only by the client.",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
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
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    };
  }

  public invariants(): string[] {
    return [
      "task_list is read-only.",
      "Returned items always use one of the three board statuses.",
    ];
  }

  public examples(): DomainExample<TaskListInput, TaskListOutput>[] {
    return [
      {
        name: "filled_board",
        input: {},
        output: {
          items: [
            {
              id: "item_alpha",
              title: "Draft visual direction",
              status: "active",
              createdAt: "2026-03-18T12:00:00.000Z",
              updatedAt: "2026-03-18T12:05:00.000Z",
            },
          ],
        },
      },
    ];
  }

  public async test(): Promise<void> {
    const definition = this.definition();
    if (definition.caseName !== "task_list") {
      throw new Error("task_list.domain test expected canonical name");
    }
  }
}
