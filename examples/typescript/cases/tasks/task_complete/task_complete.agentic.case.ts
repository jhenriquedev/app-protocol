/* ========================================================================== *
 * Example: task_complete — Agentic Surface
 * --------------------------------------------------------------------------
 * Exposes task completion to agents. Execution resolves to the canonical
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
import { TaskCompleteDomain, TaskCompleteInput, TaskCompleteOutput } from "./task_complete.domain.case";

type ExpectedCasesMap = {
  tasks?: {
    task_complete?: {
      api?: {
        handler(input: TaskCompleteInput): Promise<ApiResponse<TaskCompleteOutput>>;
      };
    };
  };
};

export class TaskCompleteAgentic extends BaseAgenticCase<
  TaskCompleteInput,
  TaskCompleteOutput
> {
  protected domain(): TaskCompleteDomain {
    return new TaskCompleteDomain();
  }

  public discovery(): AgenticDiscovery {
    return {
      name: this.domainCaseName() ?? "task_complete",
      description: this.domainDescription() ?? "Mark a task as done.",
      category: "tasks",
      tags: ["tasks", "completion", "status"],
      capabilities: ["task_completion"],
      intents: ["complete a task", "mark task as done", "finish a task"],
    };
  }

  public context(): AgenticExecutionContext {
    return {
      requiresAuth: false,
      dependencies: ["task_complete.domain", "task_complete.api"],
      preconditions: ["Task must exist and be in pending status."],
      constraints: ["Cannot complete a task that is already done."],
      notes: ["This capability mutates persisted task state and should be confirmed by the host runtime."],
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose: "Mark an existing task as done by its ID.",
      whenToUse: ["When a user wants to complete or finish a task."],
      whenNotToUse: ["When creating a new task.", "When listing tasks."],
      constraints: ["Do not invent task ids; ground ambiguous requests before execution."],
      reasoningHints: ["List tasks first when the target task is not uniquely identified."],
      expectedOutcome: "The task object with status changed to 'done'.",
    };
  }

  public tool(): AgenticToolContract<TaskCompleteInput, TaskCompleteOutput> {
    const inputSchema = this.domainInputSchema();
    const outputSchema = this.domainOutputSchema();
    if (!inputSchema || !outputSchema) {
      throw new Error("task_complete agentic requires domain schemas");
    }

    return {
      name: "task_complete",
      description: "Complete a task through the canonical API flow.",
      inputSchema,
      outputSchema,
      isMutating: true,
      execute: async (input, ctx) => {
        const cases = ctx.cases as ExpectedCasesMap | undefined;
        const result = await cases?.tasks?.task_complete?.api?.handler(input);
        if (!result?.success || !result.data) {
          throw toAppCaseError(result?.error, "task_complete API failed");
        }
        return result.data;
      },
    };
  }

  public mcp(): AgenticMcpContract {
    return {
      enabled: true,
      name: "task_complete",
      title: "Complete Task",
      description: "Complete a task through the canonical APP task_complete flow.",
      metadata: { category: "tasks", mutating: true },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["task_management"],
      resources: [
        { kind: "case", ref: "tasks/task_complete", description: "Task completion capability." },
      ],
      hints: ["Treat completion as a mutating task-state transition that may need confirmation."],
      scope: "project",
      mode: "optional",
    };
  }

  public policy(): AgenticPolicy {
    return {
      requireConfirmation: true,
      riskLevel: "medium",
      executionMode: "manual-approval",
    };
  }

  public examples(): AgenticExample<TaskCompleteInput, TaskCompleteOutput>[] {
    return super.examples();
  }

  public async test(): Promise<void> {
    this.validateDefinition();

    const def = this.definition();
    if (def.discovery.name !== "task_complete") {
      throw new Error("Agentic discovery name mismatch");
    }

    const example = this.examples()[0];
    if (!example) {
      throw new Error("task_complete should expose at least one example");
    }

    let propagatedError: unknown;
    try {
      await this.tool().execute(example.input, {
        correlationId: "task-complete-agentic-failure-test",
        logger: this.ctx.logger,
        cases: {
          tasks: {
            task_complete: {
              api: {
                handler: async () => ({
                  success: false,
                  error: {
                    code: "NOT_FOUND",
                    message: "task missing",
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
      throw new Error("task_complete must propagate structured AppCaseError failures");
    }
  }
}
