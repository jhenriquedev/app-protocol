import {
  type AgenticContext,
  type AgenticDiscovery,
  type AgenticExecutionContext,
  type AgenticExample,
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

export class TaskListAgentic extends BaseAgenticCase<
  TaskListInput,
  TaskListOutput
> {
  protected domain(): TaskListDomain {
    return new TaskListDomain();
  }

  public discovery(): AgenticDiscovery {
    return {
      name: this.domainCaseName() ?? "task_list",
      description:
        this.domainDescription() ??
        "List persisted task cards for board rendering.",
      category: "tasks",
      tags: ["tasks", "listing", "board"],
      aliases: ["list_board_tasks", "show_board", "inspect_board_state"],
      capabilities: ["task_listing", "board_grounding"],
      intents: ["list tasks", "show the board", "show current tasks"],
    };
  }

  public context(): AgenticExecutionContext {
    return {
      requiresAuth: false,
      dependencies: ["task_list.domain", "task_list.api"],
      preconditions: ["The persisted task store must be readable."],
      constraints: [
        "This capability is read-only.",
        "No filters or pagination are supported in v1.",
      ],
      notes: [
        "Use this capability to ground follow-up decisions before mutating the board.",
      ],
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose: "List all persisted tasks so an agent can inspect the board state.",
      whenToUse: [
        "When the user asks to see the board or current tasks.",
        "Before moving a task when the user has not provided an exact task identifier.",
      ],
      whenNotToUse: [
        "When the user wants to create a new task.",
        "When the user already provided a precise task id for a direct move operation.",
      ],
      constraints: [
        "Do not claim support for filters or search in this v1 example.",
      ],
      reasoningHints: [
        "Treat task_list as the canonical grounding step before ambiguous task mutations.",
      ],
      expectedOutcome:
        "A flat array of task objects ordered by createdAt descending.",
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
      description: "List tasks through the canonical API execution flow.",
      inputSchema,
      outputSchema,
      isMutating: false,
      execute: async (input, ctx) => {
        const cases = ctx.cases as ExpectedCasesMap | undefined;
        const result = await cases?.tasks?.task_list?.api?.handler(input);

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
      title: "List Tasks",
      description:
        "Inspect the current task board state through the canonical APP task_list API flow.",
      metadata: {
        category: "tasks",
        mutating: false,
      },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["task_management", "board_state", "task_grounding"],
      resources: [
        {
          kind: "case",
          ref: "tasks/task_list",
          description: "Canonical board-state capability used for grounding agent decisions.",
        },
        {
          kind: "case",
          ref: "tasks/task_move",
          description: "Related board mutation capability that depends on accurate task identification.",
        },
        {
          kind: "case",
          ref: "tasks/task_create",
          description: "Related board mutation capability that adds new work into the backlog.",
        },
      ],
      hints: [
        "Use task_list before ambiguous mutations so the agent grounds itself on persisted ids and statuses.",
      ],
      scope: "project",
      mode: "recommended",
    };
  }

  public policy(): AgenticPolicy {
    return {
      requireConfirmation: false,
      riskLevel: "low",
      executionMode: "direct-execution",
    };
  }

  public examples(): AgenticExample<TaskListInput, TaskListOutput>[] {
    return super.examples();
  }

  public async test(): Promise<void> {
    this.validateDefinition();

    const definition = this.definition();
    if (definition.tool.isMutating) {
      throw new Error("test: task_list agentic must be read-only");
    }

    if (!definition.rag?.resources?.length) {
      throw new Error("test: task_list should publish semantic RAG resources");
    }

    const example = this.examples().find((item) => item.name === "board_with_cards");
    if (!example) {
      throw new Error("test: task_list example must exist");
    }

    const mockCtx: AgenticContext = {
      correlationId: "task-list-agentic-test",
      logger: this.ctx.logger,
      cases: {
        tasks: {
          task_list: {
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
    if (result.tasks.length !== example.output.tasks.length) {
      throw new Error("test: task_list tool must return the mocked task collection");
    }

    let propagatedError: unknown;
    try {
      await this.tool().execute(example.input, {
        correlationId: "task-list-agentic-failure-test",
        logger: this.ctx.logger,
        cases: {
          tasks: {
            task_list: {
              api: {
                handler: async () => ({
                  success: false,
                  error: {
                    code: "INTERNAL",
                    message: "Persisted task data is invalid",
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
      throw new Error("test: task_list must propagate AppCaseError failures");
    }

    if (propagatedError.code !== "INTERNAL") {
      throw new Error("test: task_list must preserve API error codes");
    }
  }
}
