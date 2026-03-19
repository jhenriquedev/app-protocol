import {
  BaseAgenticCase,
  type AgenticContext,
  type AgenticDiscovery,
  type AgenticExecutionContext,
  type AgenticMcpContract,
  type AgenticPolicy,
  type AgenticPrompt,
  type AgenticRagContract,
  type AgenticToolContract,
} from "../../../core/agentic.case";
import { type ApiResponse } from "../../../core/api.case";
import { toAppCaseError } from "../../../core/shared/app_structural_contracts";
import {
  TaskListDomain,
  type TaskListInput,
  type TaskListOutput,
} from "./task_list.domain.case";

type ExpectedCasesMap = {
  tasks?: {
    task_list?: {
      api?: {
        handler(input: TaskListInput): Promise<ApiResponse<TaskListOutput>>;
      };
    };
  };
};

export class TaskListAgentic extends BaseAgenticCase<TaskListInput, TaskListOutput> {
  protected domain(): TaskListDomain {
    return new TaskListDomain();
  }

  public discovery(): AgenticDiscovery {
    return {
      name: this.domainCaseName() ?? "task_list",
      description:
        this.domainDescription() ??
        "Load current work items from the task studio board.",
      category: "tasks",
      tags: ["tasks", "list", "board"],
      intents: ["show the board", "list tasks", "inspect work status"],
      capabilities: ["task_list", "board_read"],
    };
  }

  public context(): AgenticExecutionContext {
    return {
      requiresAuth: false,
      dependencies: ["task_list.domain", "task_list.api"],
      constraints: ["Execution must delegate to the canonical API surface."],
      notes: ["Use this before choosing a move target when the user is ambiguous."],
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose: "Load the current work items on the board.",
      whenToUse: [
        "When the user asks for current work status.",
        "When another tool needs the current board state first.",
      ],
      whenNotToUse: ["When the user wants to create or move an item."],
      expectedOutcome: "The full list of work items with their current board status.",
    };
  }

  public tool(): AgenticToolContract<TaskListInput, TaskListOutput> {
    const inputSchema = this.domainInputSchema();
    const outputSchema = this.domainOutputSchema();

    if (!inputSchema || !outputSchema) {
      throw new Error("task_list.agentic requires domain schemas");
    }

    return {
      name: "task_list",
      description: "Load work items through the canonical API flow.",
      inputSchema,
      outputSchema,
      execute: async (input, ctx) => {
        const result = await (ctx.cases as ExpectedCasesMap | undefined)?.tasks?.task_list?.api?.handler(
          input
        );

        if (!result?.success || !result.data) {
          throw toAppCaseError(result?.error, "task_list API failed");
        }

        return result.data;
      },
    };
  }

  public mcp(): AgenticMcpContract {
    return {
      enabled: true,
      name: "task_list",
      title: "List Work Items",
      description: "Load the current board state through the APP task_list API flow.",
      metadata: {
        category: "tasks",
        mutating: false,
      },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["task_management", "board_visibility"],
      resources: [
        {
          kind: "case",
          ref: "tasks/task_list",
          description: "Canonical board read capability.",
        },
      ],
      scope: "project",
      mode: "optional",
    };
  }

  public policy(): AgenticPolicy {
    return {
      requireConfirmation: false,
      riskLevel: "low",
      executionMode: "direct-execution",
    };
  }

  public async test(): Promise<void> {
    this.validateDefinition();

    const surface = new TaskListAgentic({
      correlationId: "test-task-list-agentic",
      logger: console,
      cases: {
        tasks: {
          task_list: {
            api: {
              handler: async () => ({
                success: true,
                data: {
                  items: [
                    {
                      id: "item_agentic_list",
                      title: "Audit the board copy",
                      status: "complete",
                      createdAt: "2026-03-18T12:00:00.000Z",
                      updatedAt: "2026-03-18T12:15:00.000Z",
                    },
                  ],
                },
              }),
            },
          },
        },
      },
    } as AgenticContext);

    const output = await surface.execute({});
    if (output.items.length !== 1) {
      throw new Error("task_list.agentic test expected one returned item");
    }
  }
}
