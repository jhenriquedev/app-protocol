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
  AgenticMcpContract,
  AgenticPolicy,
  AgenticPrompt,
  AgenticRagContract,
  AgenticToolContract,
  BaseAgenticCase,
} from "../../../core/agentic.case";
import { ApiResponse } from "../../../core/api.case";
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
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose: "Mark an existing task as done by its ID.",
      whenToUse: ["When a user wants to complete or finish a task."],
      whenNotToUse: ["When creating a new task.", "When listing tasks."],
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
          throw new Error(result?.error?.message ?? "task_complete API failed");
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
      metadata: { category: "tasks", mutating: true },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["task_management"],
      resources: [
        { kind: "case", ref: "tasks/task_complete", description: "Task completion capability." },
      ],
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

  public async test(): Promise<void> {
    this.validateDefinition();

    const def = this.definition();
    if (def.discovery.name !== "task_complete") {
      throw new Error("Agentic discovery name mismatch");
    }
  }
}
