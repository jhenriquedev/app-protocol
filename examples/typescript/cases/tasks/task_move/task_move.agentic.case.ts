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
  TaskMoveDomain,
  type TaskMoveInput,
  type TaskMoveOutput,
} from "./task_move.domain.case";

type ExpectedCasesMap = {
  tasks?: {
    task_move?: {
      api?: {
        handler(input: TaskMoveInput): Promise<ApiResponse<TaskMoveOutput>>;
      };
    };
  };
};

export class TaskMoveAgentic extends BaseAgenticCase<TaskMoveInput, TaskMoveOutput> {
  protected domain(): TaskMoveDomain {
    return new TaskMoveDomain();
  }

  public discovery(): AgenticDiscovery {
    return {
      name: this.domainCaseName() ?? "task_move",
      description:
        this.domainDescription() ??
        "Move a persisted work item to another board column.",
      category: "tasks",
      tags: ["tasks", "move", "board"],
      intents: ["move a task", "change task status", "advance work"],
      capabilities: ["task_move", "board_write"],
    };
  }

  public context(): AgenticExecutionContext {
    return {
      requiresAuth: false,
      dependencies: ["task_move.domain", "task_move.api", "task_list.agentic"],
      constraints: [
        "The itemId must refer to an existing work item.",
        "Execution must delegate to the canonical API surface.",
      ],
      notes: ["Ask for confirmation before mutating the board."],
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose: "Move an existing work item to backlog, active, or complete.",
      whenToUse: [
        "When the user explicitly wants to change the status of a known work item.",
      ],
      whenNotToUse: [
        "When the user wants to create a new item.",
        "When the target item is ambiguous.",
      ],
      constraints: [
        "Do not invent item ids.",
        "Require explicit confirmation before mutation.",
      ],
      reasoningHints: [
        "If the item is ambiguous, inspect the board first through task_list.",
      ],
      expectedOutcome: "The updated work item persisted in the requested column.",
    };
  }

  public tool(): AgenticToolContract<TaskMoveInput, TaskMoveOutput> {
    const inputSchema = this.domainInputSchema();
    const outputSchema = this.domainOutputSchema();

    if (!inputSchema || !outputSchema) {
      throw new Error("task_move.agentic requires domain schemas");
    }

    return {
      name: "task_move",
      description: "Move a work item through the canonical API flow.",
      inputSchema,
      outputSchema,
      isMutating: true,
      requiresConfirmation: true,
      execute: async (input, ctx) => {
        const result = await (ctx.cases as ExpectedCasesMap | undefined)?.tasks?.task_move?.api?.handler(
          input
        );

        if (!result?.success || !result.data) {
          throw toAppCaseError(result?.error, "task_move API failed");
        }

        return result.data;
      },
    };
  }

  public mcp(): AgenticMcpContract {
    return {
      enabled: true,
      name: "task_move",
      title: "Move Work Item",
      description: "Move a work item between board columns through the APP task_move API flow.",
      metadata: {
        category: "tasks",
        mutating: true,
      },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["task_management", "board_mutation"],
      resources: [
        {
          kind: "case",
          ref: "tasks/task_move",
          description: "Canonical move capability.",
        },
      ],
      hints: ["Prefer task_list first when the user does not provide an exact item id."],
      scope: "project",
      mode: "recommended",
    };
  }

  public policy(): AgenticPolicy {
    return {
      requireConfirmation: true,
      riskLevel: "medium",
      executionMode: "manual-approval",
      limits: ["Only mutate a known item id with an explicit targetStatus."],
    };
  }

  public async test(): Promise<void> {
    this.validateDefinition();

    const surface = new TaskMoveAgentic({
      correlationId: "test-task-move-agentic",
      logger: console,
      cases: {
        tasks: {
          task_move: {
            api: {
              handler: async (input: TaskMoveInput) => ({
                success: true,
                data: {
                  id: input.itemId,
                  title: "Moved item",
                  status: input.targetStatus,
                  createdAt: "2026-03-18T12:00:00.000Z",
                  updatedAt: "2026-03-18T12:55:00.000Z",
                },
              }),
            },
          },
        },
      },
    } as AgenticContext);

    const output = await surface.execute({
      itemId: "item_agentic_move",
      targetStatus: "complete",
    });

    if (output.status !== "complete") {
      throw new Error("task_move.agentic test expected a complete result");
    }
  }
}
