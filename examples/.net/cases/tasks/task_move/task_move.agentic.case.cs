using AppProtocol.Example.DotNet.Core;
using AppProtocol.Example.DotNet.Core.Shared;

namespace AppProtocol.Example.DotNet.Cases.Tasks.TaskMove;

public sealed class TaskMoveAgentic : BaseAgenticCase<TaskMoveInput, TaskMoveOutput>
{
    public TaskMoveAgentic(AgenticContext context)
        : base(context)
    {
    }

    protected override BaseDomainCase<TaskMoveInput, TaskMoveOutput> Domain() => new TaskMoveDomain();

    public override AgenticDiscovery Discovery() => new()
    {
        Name = DomainCaseName() ?? "task_move",
        Description = DomainDescription() ?? "Move an existing task card to another board column.",
        Category = "tasks",
        Tags = new[] { "tasks", "move", "status" },
        Aliases = new[] { "move_task", "change_task_status", "advance_task" },
        Capabilities = new[] { "task_move", "board_mutation" },
        Intents = new[] { "move a task", "change task status", "advance work on the board" },
    };

    public override AgenticExecutionContext Context() => new()
    {
        RequiresAuth = false,
        Dependencies = new[] { "task_move.domain", "task_move.api", "task_list.agentic" },
        Preconditions = new[] { "A concrete taskId and a valid targetStatus are required." },
        Constraints = new[]
        {
            "Use task_list first when the user refers to a task ambiguously.",
            "Execution must delegate to the canonical API surface.",
        },
        Notes = new[]
        {
            "Moving a task is a mutating action and should be confirmed by the host runtime.",
        },
    };

    public override AgenticPrompt Prompt() => new()
    {
        Purpose = "Move an existing task to todo, doing, or done by task id.",
        WhenToUse = new[]
        {
            "When the user explicitly wants to move an existing task card.",
            "When the user wants to update the progress status of known work.",
        },
        WhenNotToUse = new[]
        {
            "When the user wants to create a task.",
            "When the user has not provided enough information to identify the task.",
        },
        Constraints = new[]
        {
            "Do not invent a taskId.",
            "Require confirmation before mutating the board.",
        },
        ReasoningHints = new[]
        {
            "If the task is ambiguous, list current tasks first and ask the user to confirm the intended card.",
        },
        ExpectedOutcome = "The updated task object with the requested target status persisted.",
    };

    public override AgenticToolContract Tool()
    {
        var inputSchema = DomainInputSchema() ?? throw new InvalidOperationException("task_move.agentic requires domain schemas");
        var outputSchema = DomainOutputSchema() ?? throw new InvalidOperationException("task_move.agentic requires domain schemas");

        return new AgenticToolContract
        {
            Name = "task_move",
            Description = "Move a task through the canonical API execution flow.",
            InputSchema = inputSchema,
            OutputSchema = outputSchema,
            IsMutating = true,
            RequiresConfirmation = true,
            ExecuteAsync = async (input, ctx) =>
            {
                var handler = ResolveApiHandler(ctx);
                var responseObject = await handler(Materialize<TaskMoveInput>(input));
                var response = Materialize<ApiResponse<TaskMoveOutput>>(responseObject);
                if (!response.Success || response.Data is null)
                {
                    throw AppCaseErrors.ToAppCaseError(response.Error, "task_move API failed");
                }

                return response.Data;
            },
        };
    }

    public override AgenticMcpContract Mcp() => new()
    {
        Enabled = true,
        Name = "task_move",
        Title = "Move Task",
        Description = "Move a task between board columns through the canonical APP task_move API flow.",
        Metadata = new Dictionary<string, object?>
        {
            ["category"] = "tasks",
            ["mutating"] = true,
        },
    };

    public override AgenticRagContract Rag() => new()
    {
        Topics = new[] { "task_management", "status_transitions", "board_mutation" },
        Resources = new[]
        {
            new AgenticKnowledgeResource
            {
                Kind = "case",
                Ref = "tasks/task_move",
                Description = "Canonical board mutation capability for changing task status.",
            },
            new AgenticKnowledgeResource
            {
                Kind = "case",
                Ref = "tasks/task_list",
                Description = "Grounding capability used to identify persisted task ids before moving them.",
            },
        },
        Hints = new[]
        {
            "Use task_list to ground ambiguous references before proposing or executing a move.",
            "Preserve explicit confirmation because task_move mutates persisted board state.",
        },
        Scope = "project",
        Mode = "recommended",
    };

    public override AgenticPolicy Policy() => new()
    {
        RequireConfirmation = true,
        RiskLevel = "medium",
        ExecutionMode = "manual-approval",
        Limits = new[]
        {
            "Do not execute a move without explicit confirmation from the host runtime.",
        },
    };

    public override async Task TestAsync()
    {
        ValidateDefinition();
        var example = Examples()?.FirstOrDefault(item => item.Name == "move_todo_to_doing")
            ?? throw new InvalidOperationException("test: task_move example must exist");

        var mockCtx = new AgenticContext
        {
            CorrelationId = "task-move-agentic-test",
            Logger = Ctx.Logger,
            Cases = new Dictionary<string, IDictionary<string, IDictionary<string, object>>>
            {
                ["tasks"] = new Dictionary<string, IDictionary<string, object>>
                {
                    ["task_move"] = new Dictionary<string, object>
                    {
                        ["api"] = new Func<object?, Task<object?>>(_ => Task.FromResult<object?>(
                            ApiResponse<TaskMoveOutput>.Ok(Materialize<TaskMoveOutput>(example.Output)))),
                    },
                },
            },
        };

        var result = Materialize<TaskMoveOutput>(await Tool().ExecuteAsync(example.Input, mockCtx));
        if (result.Task.Status != Materialize<TaskMoveOutput>(example.Output).Task.Status)
        {
            throw new InvalidOperationException("test: task_move tool must return the moved task");
        }

        try
        {
            await Tool().ExecuteAsync(example.Input, new AgenticContext
            {
                CorrelationId = "task-move-agentic-failure-test",
                Logger = Ctx.Logger,
                Cases = new Dictionary<string, IDictionary<string, IDictionary<string, object>>>
                {
                    ["tasks"] = new Dictionary<string, IDictionary<string, object>>
                    {
                        ["task_move"] = new Dictionary<string, object>
                        {
                            ["api"] = new Func<object?, Task<object?>>(_ => Task.FromResult<object?>(
                                ApiResponse<TaskMoveOutput>.Failure(new AppError("NOT_FOUND", "Task missing was not found"), 404))),
                        },
                    },
                },
            });
        }
        catch (AppCaseError error) when (error.Code == "NOT_FOUND")
        {
            return;
        }

        throw new InvalidOperationException("test: task_move must propagate NOT_FOUND from API");
    }

    private static Func<object?, Task<object?>> ResolveApiHandler(AgenticContext context)
    {
        if (context.Cases is null ||
            !context.Cases.TryGetValue("tasks", out var taskCases) ||
            !taskCases.TryGetValue("task_move", out var surfaces) ||
            !surfaces.TryGetValue("api", out var apiSurface) ||
            apiSurface is not Func<object?, Task<object?>> handler)
        {
            throw new AppCaseError("NOT_FOUND", "task_move API surface is not available in ctx.cases");
        }

        return handler;
    }
}
