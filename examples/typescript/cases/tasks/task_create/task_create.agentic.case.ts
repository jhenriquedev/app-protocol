import {
  BaseAgenticCase,
  type AgenticContext,
  type AgenticDiscovery,
  type AgenticExecutionContext,
  type AgenticExample,
  type AgenticMcpContract,
  type AgenticPolicy,
  type AgenticPrompt,
  type AgenticRagContract,
  type AgenticToolContract,
} from "../../../core/agentic.case";
import { type ApiResponse } from "../../../core/api.case";
import { AppCaseError, toAppCaseError } from "../../../core/shared/app_structural_contracts";
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
      description:
        this.domainDescription() ??
        "Create a new work item on the studio board.",
      category: "tasks",
      tags: ["tasks", "create", "board"],
      intents: ["create a task", "capture a new work item"],
      capabilities: ["task_create", "board_write"],
    };
  }

  public context(): AgenticExecutionContext {
    return {
      requiresAuth: false,
      dependencies: ["task_create.domain", "task_create.api"],
      constraints: [
        "The title must be explicit and non-empty.",
        "Execution must delegate to the canonical API surface.",
      ],
      notes: ["Creation starts in backlog automatically."],
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose: "Create a new work item on the board.",
      whenToUse: [
        "When the user wants to capture a new work item.",
        "When the user gives a concrete title for planned work.",
      ],
      whenNotToUse: [
        "When the user wants to move an existing item.",
        "When the user has not described the new work item yet.",
      ],
      constraints: ["Do not invent missing titles."],
      expectedOutcome: "A persisted work item in backlog status.",
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
      description: "Create a new work item through the canonical API flow.",
      inputSchema,
      outputSchema,
      execute: async (input, ctx) => {
        const result = await (ctx.cases as ExpectedCasesMap | undefined)?.tasks?.task_create?.api?.handler(
          input
        );

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
      title: "Create Work Item",
      description: "Create a new work item through the APP task_create API flow.",
      metadata: {
        category: "tasks",
        mutating: true,
      },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["task_management", "work_intake"],
      resources: [
        {
          kind: "case",
          ref: "tasks/task_create",
          description: "Canonical create capability.",
        },
      ],
      hints: ["Prefer the provided title and keep the description literal."],
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

  public examples(): AgenticExample<TaskCreateInput, TaskCreateOutput>[] {
    return super.examples();
  }

  public async test(): Promise<void> {
    this.validateDefinition();

    const surface = new TaskCreateAgentic({
      correlationId: "test-task-create-agentic",
      logger: console,
      cases: {
        tasks: {
          task_create: {
            api: {
              handler: async (input: TaskCreateInput) => ({
                success: true,
                data: {
                  id: "item_agentic",
                  title: input.title,
                  description: input.description,
                  status: "backlog",
                  createdAt: "2026-03-18T12:00:00.000Z",
                  updatedAt: "2026-03-18T12:00:00.000Z",
                },
              }),
            },
          },
        },
      },
    } as AgenticContext);

    const output = await surface.execute({
      title: "Shape the public launch notes",
      description: "Describe the public announcement flow.",
    });

    if (output.status !== "backlog") {
      throw new Error("task_create.agentic test expected backlog output");
    }
  }
}
