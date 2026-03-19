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
  TaskCreateDomain,
  type TaskCreateInput,
  type TaskCreateOutput,
} from "./task_create.domain.case";

type ExpectedCasesMap = {
  tasks?: {
    task_create?: {
      api?: {
        handler(input: TaskCreateInput): Promise<ApiResponse<TaskCreateOutput>>;
      };
    };
  };
};

export class TaskCreateAgentic extends BaseAgenticCase<
  TaskCreateInput,
  TaskCreateOutput
> {
  protected domain(): TaskCreateDomain {
    return new TaskCreateDomain();
  }

  public discovery(): AgenticDiscovery {
    return {
      name: this.domainCaseName() ?? "task_create",
      description: this.domainDescription() ??
        "Create a new task card for the board.",
      category: "tasks",
      tags: ["tasks", "creation", "board"],
      aliases: ["create_task", "new_task_card", "add_board_task"],
      capabilities: ["task_creation"],
      intents: ["create a task", "add a task", "add work to the board"],
    };
  }

  public context(): AgenticExecutionContext {
    return {
      requiresAuth: false,
      requiresTenant: false,
      dependencies: ["task_create.domain", "task_create.api"],
      preconditions: ["A non-empty title must be provided."],
      constraints: [
        "The caller must not provide id, status, createdAt, or updatedAt.",
        "Execution must delegate to the canonical API surface.",
        "Descriptions stay optional and should only be passed when the user supplied them.",
      ],
      notes: [
        "New tasks always start in todo.",
        "The backend is the source of truth for identifiers and timestamps.",
      ],
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose:
        "Create a new task with a required title and an optional description.",
      whenToUse: [
        "When the user asks to create or add a new task card.",
        "When new work needs to be placed into the board backlog.",
      ],
      whenNotToUse: [
        "When the user wants to inspect existing tasks.",
        "When the user wants to move an existing task between columns.",
      ],
      constraints: [
        "Ask for a title if the user did not provide one.",
        "Do not invent backend-controlled fields.",
      ],
      reasoningHints: [
        "Treat description as optional and pass it only when the user gave enough detail.",
        "Prefer concise titles because they are displayed directly on the board card.",
      ],
      expectedOutcome:
        "A created task object with status todo and backend-generated identity fields.",
    };
  }

  public tool(): AgenticToolContract<TaskCreateInput, TaskCreateOutput> {
    const inputSchema = this.domainInputSchema();
    const outputSchema = this.domainOutputSchema();

    if (!inputSchema || !outputSchema) {
      throw new Error("task_create.agentic requires domain schemas");
    }

    return {
      name: "task_create",
      description: "Create a task through the canonical API execution flow.",
      inputSchema,
      outputSchema,
      isMutating: true,
      execute: async (input, ctx) => {
        const cases = ctx.cases as ExpectedCasesMap | undefined;
        const result = await cases?.tasks?.task_create?.api?.handler(input);

        if (!result?.success || !result.data) {
          throw toAppCaseError(result?.error, "task_create API failed");
        }

        return result.data;
      },
    };
  }

  public mcp(): AgenticMcpContract {
    return {
      enabled: true,
      name: "task_create",
      title: "Create Task",
      description:
        "Create a board task through the canonical APP task_create API flow.",
      metadata: {
        category: "tasks",
        mutating: true,
      },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["task_management", "board_backlog", "task_creation"],
      resources: [
        {
          kind: "case",
          ref: "tasks/task_create",
          description: "Canonical task creation capability for new board work.",
        },
        {
          kind: "case",
          ref: "tasks/task_list",
          description:
            "Board grounding capability for inspecting current tasks before adding related work.",
        },
      ],
      hints: [
        "Prefer the canonical backlog language used by the board.",
        "Keep task titles concise because they render directly on cards.",
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
      limits: ["Use only for explicit task-creation intent."],
    };
  }

  public examples(): AgenticExample<TaskCreateInput, TaskCreateOutput>[] {
    return super.examples();
  }

  public async test(): Promise<void> {
    this.validateDefinition();

    const definition = this.definition();
    if (!definition.tool.isMutating) {
      throw new Error("test: task_create agentic must be mutating");
    }

    if (definition.policy?.executionMode !== "direct-execution") {
      throw new Error("test: task_create should default to direct execution");
    }

    if (!definition.rag?.resources?.length) {
      throw new Error(
        "test: task_create should publish semantic RAG resources",
      );
    }

    const example = this.examples().find((item) => item.name === "title_only");
    if (!example) {
      throw new Error("test: task_create example must exist");
    }

    const mockCtx: AgenticContext = {
      correlationId: "task-create-agentic-test",
      logger: this.ctx.logger,
      cases: {
        tasks: {
          task_create: {
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
    if (result.task.status !== "todo") {
      throw new Error("test: task_create tool must return a todo task");
    }

    let propagatedError: unknown;
    try {
      await this.tool().execute(example.input, {
        correlationId: "task-create-agentic-failure-test",
        logger: this.ctx.logger,
        cases: {
          tasks: {
            task_create: {
              api: {
                handler: async () => ({
                  success: false,
                  error: {
                    code: "VALIDATION_FAILED",
                    message: "title must not be empty",
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
      throw new Error("test: task_create must propagate AppCaseError failures");
    }

    if (propagatedError.code !== "VALIDATION_FAILED") {
      throw new Error("test: task_create must preserve validation error codes");
    }
  }
}
