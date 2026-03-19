using AppProtocol.Example.DotNet.Core;
using AppProtocol.Example.DotNet.Core.Shared;

namespace AppProtocol.Example.DotNet.Cases.Tasks.TaskList;

public sealed class TaskListAgentic : BaseAgenticCase<TaskListInput, TaskListOutput>
{
    public TaskListAgentic(AgenticContext context)
        : base(context)
    {
    }

    protected override BaseDomainCase<TaskListInput, TaskListOutput> Domain() => new TaskListDomain();

    public override AgenticDiscovery Discovery() => new()
    {
        Name = DomainCaseName() ?? "task_list",
        Description = DomainDescription() ?? "List persisted task cards for board rendering.",
        Category = "tasks",
        Tags = new[] { "tasks", "listing", "board" },
        Aliases = new[] { "list_board_tasks", "show_board", "inspect_board_state" },
        Capabilities = new[] { "task_listing", "board_grounding" },
        Intents = new[] { "list tasks", "show the board", "show current tasks" },
    };

    public override AgenticExecutionContext Context() => new()
    {
        RequiresAuth = false,
        Dependencies = new[] { "task_list.domain", "task_list.api" },
        Preconditions = new[] { "The persisted task store must be readable." },
        Constraints = new[]
        {
            "This capability is read-only.",
            "No filters or pagination are supported in v1.",
        },
        Notes = new[]
        {
            "Use this capability to ground follow-up decisions before mutating the board.",
        },
    };

    public override AgenticPrompt Prompt() => new()
    {
        Purpose = "List all persisted tasks so an agent can inspect the board state.",
        WhenToUse = new[]
        {
            "When the user asks to see the board or current tasks.",
            "Before moving a task when the user has not provided an exact task identifier.",
        },
        WhenNotToUse = new[]
        {
            "When the user wants to create a new task.",
            "When the user already provided a precise task id for a direct move operation.",
        },
        Constraints = new[]
        {
            "Do not claim support for filters or search in this v1 example.",
        },
        ReasoningHints = new[]
        {
            "Treat task_list as the canonical grounding step before ambiguous task mutations.",
        },
        ExpectedOutcome = "A flat array of task objects ordered by createdAt descending.",
    };

    public override AgenticToolContract Tool()
    {
        var inputSchema = DomainInputSchema() ?? throw new InvalidOperationException("task_list.agentic requires domain schemas");
        var outputSchema = DomainOutputSchema() ?? throw new InvalidOperationException("task_list.agentic requires domain schemas");

        return new AgenticToolContract
        {
            Name = "task_list",
            Description = "List tasks through the canonical API execution flow.",
            InputSchema = inputSchema,
            OutputSchema = outputSchema,
            IsMutating = false,
            ExecuteAsync = async (input, ctx) =>
            {
                var handler = ResolveApiHandler(ctx);
                var responseObject = await handler(Materialize<TaskListInput>(input));
                var response = Materialize<ApiResponse<TaskListOutput>>(responseObject);
                if (!response.Success || response.Data is null)
                {
                    throw AppCaseErrors.ToAppCaseError(response.Error, "task_list API failed");
                }

                return response.Data;
            },
        };
    }

    public override AgenticMcpContract Mcp() => new()
    {
        Enabled = true,
        Name = "task_list",
        Title = "List Tasks",
        Description = "Inspect the current task board state through the canonical APP task_list API flow.",
        Metadata = new Dictionary<string, object?>
        {
            ["category"] = "tasks",
            ["mutating"] = false,
        },
    };

    public override AgenticRagContract Rag() => new()
    {
        Topics = new[] { "task_management", "board_state", "task_grounding" },
        Resources = new[]
        {
            new AgenticKnowledgeResource
            {
                Kind = "case",
                Ref = "tasks/task_list",
                Description = "Canonical board-state capability used for grounding agent decisions.",
            },
            new AgenticKnowledgeResource
            {
                Kind = "case",
                Ref = "tasks/task_move",
                Description = "Related board mutation capability that depends on accurate task identification.",
            },
            new AgenticKnowledgeResource
            {
                Kind = "case",
                Ref = "tasks/task_create",
                Description = "Related board mutation capability that adds new work into the backlog.",
            },
        },
        Hints = new[]
        {
            "Use task_list before ambiguous mutations so the agent grounds itself on persisted ids and statuses.",
        },
        Scope = "project",
        Mode = "recommended",
    };

    public override AgenticPolicy Policy() => new()
    {
        RequireConfirmation = false,
        RiskLevel = "low",
        ExecutionMode = "direct-execution",
    };

    public override async Task TestAsync()
    {
        ValidateDefinition();
        var example = Examples()?.FirstOrDefault(item => item.Name == "board_with_cards")
            ?? throw new InvalidOperationException("test: task_list example must exist");

        var mockCtx = new AgenticContext
        {
            CorrelationId = "task-list-agentic-test",
            Logger = Ctx.Logger,
            Cases = new Dictionary<string, IDictionary<string, IDictionary<string, object>>>
            {
                ["tasks"] = new Dictionary<string, IDictionary<string, object>>
                {
                    ["task_list"] = new Dictionary<string, object>
                    {
                        ["api"] = new Func<object?, Task<object?>>(_ => Task.FromResult<object?>(
                            ApiResponse<TaskListOutput>.Ok(Materialize<TaskListOutput>(example.Output)))),
                    },
                },
            },
        };

        var result = Materialize<TaskListOutput>(await Tool().ExecuteAsync(example.Input, mockCtx));
        if (result.Tasks.Count != Materialize<TaskListOutput>(example.Output).Tasks.Count)
        {
            throw new InvalidOperationException("test: task_list tool must return the mocked task collection");
        }

        try
        {
            await Tool().ExecuteAsync(example.Input, new AgenticContext
            {
                CorrelationId = "task-list-agentic-failure-test",
                Logger = Ctx.Logger,
                Cases = new Dictionary<string, IDictionary<string, IDictionary<string, object>>>
                {
                    ["tasks"] = new Dictionary<string, IDictionary<string, object>>
                    {
                        ["task_list"] = new Dictionary<string, object>
                        {
                            ["api"] = new Func<object?, Task<object?>>(_ => Task.FromResult<object?>(
                                ApiResponse<TaskListOutput>.Failure(new AppError("INTERNAL", "Persisted task data is invalid"), 500))),
                        },
                    },
                },
            });
        }
        catch (AppCaseError error) when (error.Code == "INTERNAL")
        {
            return;
        }

        throw new InvalidOperationException("test: task_list must propagate AppCaseError failures");
    }

    private static Func<object?, Task<object?>> ResolveApiHandler(AgenticContext context)
    {
        if (context.Cases is null ||
            !context.Cases.TryGetValue("tasks", out var taskCases) ||
            !taskCases.TryGetValue("task_list", out var surfaces) ||
            !surfaces.TryGetValue("api", out var apiSurface) ||
            apiSurface is not Func<object?, Task<object?>> handler)
        {
            throw new AppCaseError("NOT_FOUND", "task_list API surface is not available in ctx.cases");
        }

        return handler;
    }
}
