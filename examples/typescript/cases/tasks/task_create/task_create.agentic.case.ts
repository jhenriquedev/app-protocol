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
  AgenticMcpContract,
  AgenticPolicy,
  AgenticPrompt,
  AgenticRagContract,
  AgenticToolContract,
  BaseAgenticCase,
} from "../../../core/agentic.case";
import { ApiResponse } from "../../../core/api.case";
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
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose: "Create a new task with a title and optional description.",
      whenToUse: ["When a user wants to create or add a new task."],
      whenNotToUse: ["When updating or completing an existing task."],
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
          throw new Error(result?.error?.message ?? "task_create API failed");
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
      metadata: { category: "tasks", mutating: true },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["task_management", "productivity"],
      resources: [
        { kind: "case", ref: "tasks/task_create", description: "Task creation capability." },
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

    const def = this.definition();
    if (def.discovery.name !== "task_create") {
      throw new Error("Agentic discovery name mismatch");
    }
    if (!def.tool.inputSchema.properties) {
      throw new Error("Tool must have input schema properties");
    }
  }
}
