/* ========================================================================== *
 * Example: task_list — Agentic Surface
 * --------------------------------------------------------------------------
 * Exposes task listing to agents. Execution resolves to the canonical
 * API surface via ctx.cases.
 * ========================================================================== */

import {
  AgenticContext,
  AgenticDiscovery,
  AgenticExecutionContext,
  AgenticMcpContract,
  AgenticPrompt,
  AgenticRagContract,
  AgenticToolContract,
  BaseAgenticCase,
} from "../../../core/agentic.case";
import { ApiResponse } from "../../../core/api.case";
import { TaskListDomain, TaskListInput, TaskListOutput } from "./task_list.domain.case";

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
      description: this.domainDescription() ?? "List tasks with optional filter.",
      category: "tasks",
      tags: ["tasks", "listing", "query"],
      capabilities: ["task_listing", "task_search"],
      intents: ["list tasks", "show my tasks", "what tasks do I have"],
    };
  }

  public context(): AgenticExecutionContext {
    return {
      requiresAuth: false,
      dependencies: ["task_list.domain", "task_list.api"],
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose: "List tasks, optionally filtered by status (pending or done).",
      whenToUse: [
        "When a user wants to see their tasks.",
        "When searching for pending or completed tasks.",
      ],
      whenNotToUse: ["When creating or modifying tasks."],
      expectedOutcome: "An array of task objects.",
    };
  }

  public tool(): AgenticToolContract<TaskListInput, TaskListOutput> {
    const inputSchema = this.domainInputSchema();
    const outputSchema = this.domainOutputSchema();
    if (!inputSchema || !outputSchema) {
      throw new Error("task_list agentic requires domain schemas");
    }

    return {
      name: "task_list",
      description: "List tasks through the canonical API flow.",
      inputSchema,
      outputSchema,
      isMutating: false,
      execute: async (input, ctx) => {
        const cases = ctx.cases as ExpectedCasesMap | undefined;
        const result = await cases?.tasks?.task_list?.api?.handler(input);
        if (!result?.success || !result.data) {
          throw new Error(result?.error?.message ?? "task_list API failed");
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
      metadata: { category: "tasks" },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["task_management"],
      resources: [
        { kind: "case", ref: "tasks/task_list", description: "Task listing capability." },
        { kind: "case", ref: "tasks/task_create", description: "Related: task creation." },
      ],
      hints: ["Use status filter to narrow results when the user specifies."],
      scope: "project",
      mode: "optional",
    };
  }

  public async test(): Promise<void> {
    this.validateDefinition();

    const def = this.definition();
    if (def.discovery.name !== "task_list") {
      throw new Error("Agentic discovery name mismatch");
    }
    if (def.tool.isMutating !== false) {
      throw new Error("task_list should not be mutating");
    }
  }
}
