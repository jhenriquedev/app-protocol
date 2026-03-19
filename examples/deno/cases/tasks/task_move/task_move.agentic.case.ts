import {
  type AgenticContext,
  type AgenticDiscovery,
  type AgenticExample,
  type AgenticExecutionContext,
  type AgenticMcpContract,
  type AgenticPolicy,
  type AgenticPrompt,
  type AgenticRagContract,
  type AgenticToolContract,
  BaseAgenticCase,
} from "../../../core/agentic.case";
import { type ApiResponse } from "../../../core/api.case";
import {
  AppCaseError,
  toAppCaseError,
} from "../../../core/shared/app_structural_contracts";
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

export class TaskMoveAgentic extends BaseAgenticCase<
  TaskMoveInput,
  TaskMoveOutput
> {
  protected domain(): TaskMoveDomain {
    return new TaskMoveDomain();
  }

  public discovery(): AgenticDiscovery {
    return {
      name: this.domainCaseName() ?? "task_move",
      description: this.domainDescription() ??
        "Move an existing task card to another board column.",
      category: "tasks",
      tags: ["tasks", "move", "status"],
      aliases: ["move_task", "change_task_status", "advance_task"],
      capabilities: ["task_move", "board_mutation"],
      intents: [
        "move a task",
        "change task status",
        "advance work on the board",
      ],
    };
  }

  public context(): AgenticExecutionContext {
    return {
      requiresAuth: false,
      dependencies: ["task_move.domain", "task_move.api", "task_list.agentic"],
      preconditions: [
        "A concrete taskId and a valid targetStatus are required.",
      ],
      constraints: [
        "Use task_list first when the user refers to a task ambiguously.",
        "Execution must delegate to the canonical API surface.",
      ],
      notes: [
        "Moving a task is a mutating action and should be confirmed by the host runtime.",
      ],
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose: "Move an existing task to todo, doing, or done by task id.",
      whenToUse: [
        "When the user explicitly wants to move an existing task card.",
        "When the user wants to update the progress status of known work.",
      ],
      whenNotToUse: [
        "When the user wants to create a task.",
        "When the user has not provided enough information to identify the task.",
      ],
      constraints: [
        "Do not invent a taskId.",
        "Require confirmation before mutating the board.",
      ],
      reasoningHints: [
        "If the task is ambiguous, list current tasks first and ask the user to confirm the intended card.",
      ],
      expectedOutcome:
        "The updated task object with the requested target status persisted.",
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
      description: "Move a task through the canonical API execution flow.",
      inputSchema,
      outputSchema,
      isMutating: true,
      requiresConfirmation: true,
      execute: async (input, ctx) => {
        const cases = ctx.cases as ExpectedCasesMap | undefined;
        const result = await cases?.tasks?.task_move?.api?.handler(input);

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
      title: "Move Task",
      description:
        "Move a task between board columns through the canonical APP task_move API flow.",
      metadata: {
        category: "tasks",
        mutating: true,
      },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["task_management", "status_transitions", "board_mutation"],
      resources: [
        {
          kind: "case",
          ref: "tasks/task_move",
          description:
            "Canonical board mutation capability for changing task status.",
        },
        {
          kind: "case",
          ref: "tasks/task_list",
          description:
            "Grounding capability used to identify persisted task ids before moving them.",
        },
      ],
      hints: [
        "Use task_list to ground ambiguous references before proposing or executing a move.",
        "Preserve explicit confirmation because task_move mutates persisted board state.",
      ],
      scope: "project",
      mode: "recommended",
    };
  }

  public policy(): AgenticPolicy {
    return {
      requireConfirmation: true,
      riskLevel: "medium",
      executionMode: "manual-approval",
      limits: [
        "Do not execute a move without explicit confirmation from the host runtime.",
      ],
    };
  }

  public examples(): AgenticExample<TaskMoveInput, TaskMoveOutput>[] {
    return super.examples();
  }

  public async test(): Promise<void> {
    this.validateDefinition();

    const definition = this.definition();
    if (!definition.tool.requiresConfirmation) {
      throw new Error("test: task_move tool must require confirmation");
    }

    if (definition.policy?.executionMode !== "manual-approval") {
      throw new Error("test: task_move should default to manual approval");
    }

    if (!definition.rag?.resources?.length) {
      throw new Error("test: task_move should publish semantic RAG resources");
    }

    const example = this.examples().find((item) =>
      item.name === "move_todo_to_doing"
    );
    if (!example) {
      throw new Error("test: task_move example must exist");
    }

    const mockCtx: AgenticContext = {
      correlationId: "task-move-agentic-test",
      logger: this.ctx.logger,
      cases: {
        tasks: {
          task_move: {
            api: {
              handler: async () => ({
                success: true,
                data: example.output,
              }),
            },
          },
        },
      },
    };

    const result = await this.tool().execute(example.input, mockCtx);
    if (result.task.status !== example.output.task.status) {
      throw new Error("test: task_move tool must return the moved task");
    }

    let propagatedError: unknown;
    try {
      await this.tool().execute(example.input, {
        correlationId: "task-move-agentic-failure-test",
        logger: this.ctx.logger,
        cases: {
          tasks: {
            task_move: {
              api: {
                handler: async () => ({
                  success: false,
                  error: {
                    code: "NOT_FOUND",
                    message: "Task missing was not found",
                  },
                }),
              },
            },
          },
        },
      });
    } catch (error: unknown) {
      propagatedError = error;
    }

    if (!(propagatedError instanceof AppCaseError)) {
      throw new Error("test: task_move must propagate AppCaseError failures");
    }

    if (propagatedError.code !== "NOT_FOUND") {
      throw new Error("test: task_move must preserve NOT_FOUND from API");
    }
  }
}
