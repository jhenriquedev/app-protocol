/* ========================================================================== *
 * Example: task_create — Agentic Surface
 * --------------------------------------------------------------------------
 * Exposes task creation to agents. Execution resolves to the canonical
 * API surface via ctx.cases.
 * ========================================================================== */

import {
  AgenticContext,
  AgenticDiscovery,
  AgenticExecutionContext,
  AgenticExample,
  AgenticMcpContract,
  AgenticPolicy,
  AgenticPrompt,
  AgenticRagContract,
  AgenticToolContract,
  BaseAgenticCase,
} from "../../../core/agentic.case";
import { ApiResponse } from "../../../core/api.case";
import {
  AppCaseError,
  toAppCaseError,
} from "../../../core/shared/app_structural_contracts";
import { TaskCreateDomain, TaskCreateInput, TaskCreateOutput } from "./task_create.domain.case";

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
      description: this.domainDescription() ?? "Create a new task.",
      category: "tasks",
      tags: ["tasks", "creation", "productivity"],
      capabilities: ["task_creation"],
      intents: ["create a task", "add a new task", "make a todo"],
    };
  }

  public context(): AgenticExecutionContext {
    return {
      requiresAuth: false,
      requiresTenant: false,
      dependencies: ["task_create.domain", "task_create.api"],
      preconditions: ["Title must be provided."],
      constraints: ["Execution follows canonical API flow."],
      notes: ["New tasks are created in pending status in this example."],
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose: "Create a new task with a title and optional description.",
      whenToUse: ["When a user wants to create or add a new task."],
      whenNotToUse: ["When updating or completing an existing task."],
      constraints: ["Do not invent persistence-managed fields such as id or createdAt."],
      reasoningHints: ["Keep titles concise and use description only when the user supplied additional detail."],
      expectedOutcome: "A new task object with id, title, status=pending, and createdAt.",
    };
  }

  public tool(): AgenticToolContract<TaskCreateInput, TaskCreateOutput> {
    const inputSchema = this.domainInputSchema();
    const outputSchema = this.domainOutputSchema();
    if (!inputSchema || !outputSchema) {
      throw new Error("task_create agentic requires domain schemas");
    }

    return {
      name: "task_create",
      description: "Create a new task through the canonical API flow.",
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
      description: "Create a task through the canonical APP task_create flow.",
      metadata: { category: "tasks", mutating: true },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["task_management", "productivity"],
      resources: [
        { kind: "case", ref: "tasks/task_create", description: "Task creation capability." },
      ],
      hints: ["Prefer the canonical task creation flow over ad hoc task mutations."],
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

    const def = this.definition();
    if (def.discovery.name !== "task_create") {
      throw new Error("Agentic discovery name mismatch");
    }
    if (!def.tool.inputSchema.properties) {
      throw new Error("Tool must have input schema properties");
    }

    const example = this.examples()[0];
    if (!example) {
      throw new Error("task_create should expose at least one example");
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
                    message: "title is required",
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
      throw new Error("task_create must propagate structured AppCaseError failures");
    }
  }
}
