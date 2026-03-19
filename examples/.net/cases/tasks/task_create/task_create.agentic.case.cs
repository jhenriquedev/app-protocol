using AppProtocol.Example.DotNet.Core;
using AppProtocol.Example.DotNet.Core.Shared;

namespace AppProtocol.Example.DotNet.Cases.Tasks.TaskCreate;

public sealed class TaskCreateAgentic : BaseAgenticCase<TaskCreateInput, TaskCreateOutput>
{
    public TaskCreateAgentic(AgenticContext context)
        : base(context)
    {
    }

    protected override BaseDomainCase<TaskCreateInput, TaskCreateOutput> Domain() => new TaskCreateDomain();

    public override AgenticDiscovery Discovery() => new()
    {
        Name = DomainCaseName() ?? "task_create",
        Description = DomainDescription() ?? "Create a new task card for the board.",
        Category = "tasks",
        Tags = new[] { "tasks", "creation", "board" },
        Aliases = new[] { "create_task", "new_task_card", "add_board_task" },
        Capabilities = new[] { "task_creation" },
        Intents = new[] { "create a task", "add a task", "add work to the board" },
    };

    public override AgenticExecutionContext Context() => new()
    {
        RequiresAuth = false,
        RequiresTenant = false,
        Dependencies = new[] { "task_create.domain", "task_create.api" },
        Preconditions = new[] { "A non-empty title must be provided." },
        Constraints = new[]
        {
            "The caller must not provide id, status, createdAt, or updatedAt.",
            "Execution must delegate to the canonical API surface.",
            "Descriptions stay optional and should only be passed when the user supplied them.",
        },
        Notes = new[]
        {
            "New tasks always start in todo.",
            "The backend is the source of truth for identifiers and timestamps.",
        },
    };

    public override AgenticPrompt Prompt() => new()
    {
        Purpose = "Create a new task with a required title and an optional description.",
        WhenToUse = new[]
        {
            "When the user asks to create or add a new task card.",
            "When new work needs to be placed into the board backlog.",
        },
        WhenNotToUse = new[]
        {
            "When the user wants to inspect existing tasks.",
            "When the user wants to move an existing task between columns.",
        },
        Constraints = new[]
        {
            "Ask for a title if the user did not provide one.",
            "Do not invent backend-controlled fields.",
        },
        ReasoningHints = new[]
        {
            "Treat description as optional and pass it only when the user gave enough detail.",
            "Prefer concise titles because they are displayed directly on the board card.",
        },
        ExpectedOutcome = "A created task object with status todo and backend-generated identity fields.",
    };

    public override AgenticToolContract Tool()
    {
        var inputSchema = DomainInputSchema() ?? throw new InvalidOperationException("task_create.agentic requires domain schemas");
        var outputSchema = DomainOutputSchema() ?? throw new InvalidOperationException("task_create.agentic requires domain schemas");

        return new AgenticToolContract
        {
            Name = "task_create",
            Description = "Create a task through the canonical API execution flow.",
            InputSchema = inputSchema,
            OutputSchema = outputSchema,
            IsMutating = true,
            ExecuteAsync = async (input, ctx) =>
            {
                var handler = ResolveApiHandler(ctx);
                var responseObject = await handler(Materialize<TaskCreateInput>(input));
                var response = Materialize<ApiResponse<TaskCreateOutput>>(responseObject);
                if (!response.Success || response.Data is null)
                {
                    throw AppCaseErrors.ToAppCaseError(response.Error, "task_create API failed");
                }

                return response.Data;
            },
        };
    }

    public override AgenticMcpContract Mcp() => new()
    {
        Enabled = true,
        Name = "task_create",
        Title = "Create Task",
        Description = "Create a board task through the canonical APP task_create API flow.",
        Metadata = new Dictionary<string, object?>
        {
            ["category"] = "tasks",
            ["mutating"] = true,
        },
    };

    public override AgenticRagContract Rag() => new()
    {
        Topics = new[] { "task_management", "board_backlog", "task_creation" },
        Resources = new[]
        {
            new AgenticKnowledgeResource
            {
                Kind = "case",
                Ref = "tasks/task_create",
                Description = "Canonical task creation capability for new board work.",
            },
            new AgenticKnowledgeResource
            {
                Kind = "case",
                Ref = "tasks/task_list",
                Description = "Board grounding capability for inspecting current tasks before adding related work.",
            },
        },
        Hints = new[]
        {
            "Prefer the canonical backlog language used by the board.",
            "Keep task titles concise because they render directly on cards.",
        },
        Scope = "project",
        Mode = "recommended",
    };

    public override AgenticPolicy Policy() => new()
    {
        RequireConfirmation = false,
        RiskLevel = "low",
        ExecutionMode = "direct-execution",
        Limits = new[] { "Use only for explicit task-creation intent." },
    };

    public override async Task TestAsync()
    {
        ValidateDefinition();
        var definition = Definition();
        if (definition.Tool.IsMutating != true)
        {
            throw new InvalidOperationException("test: task_create agentic must be mutating");
        }

        var example = Examples()?.FirstOrDefault(item => item.Name == "title_only")
            ?? throw new InvalidOperationException("test: task_create example must exist");

        var mockCtx = new AgenticContext
        {
            CorrelationId = "task-create-agentic-test",
            Logger = Ctx.Logger,
            Cases = new Dictionary<string, IDictionary<string, IDictionary<string, object>>>
            {
                ["tasks"] = new Dictionary<string, IDictionary<string, object>>
                {
                    ["task_create"] = new Dictionary<string, object>
                    {
                        ["api"] = new Func<object?, Task<object?>>(_ => Task.FromResult<object?>(
                            ApiResponse<TaskCreateOutput>.Ok(Materialize<TaskCreateOutput>(example.Output)))),
                    },
                },
            },
        };

        var result = Materialize<TaskCreateOutput>(await Tool().ExecuteAsync(example.Input, mockCtx));
        if (result.Task.Status != "todo")
        {
            throw new InvalidOperationException("test: task_create tool must return a todo task");
        }

        try
        {
            await Tool().ExecuteAsync(example.Input, new AgenticContext
            {
                CorrelationId = "task-create-agentic-failure-test",
                Logger = Ctx.Logger,
                Cases = new Dictionary<string, IDictionary<string, IDictionary<string, object>>>
                {
                    ["tasks"] = new Dictionary<string, IDictionary<string, object>>
                    {
                        ["task_create"] = new Dictionary<string, object>
                        {
                            ["api"] = new Func<object?, Task<object?>>(_ => Task.FromResult<object?>(
                                ApiResponse<TaskCreateOutput>.Failure(new AppError("VALIDATION_FAILED", "title must not be empty"), 400))),
                        },
                    },
                },
            });
        }
        catch (AppCaseError error) when (error.Code == "VALIDATION_FAILED")
        {
            return;
        }

        throw new InvalidOperationException("test: task_create must propagate AppCaseError failures");
    }

    private static Func<object?, Task<object?>> ResolveApiHandler(AgenticContext context)
    {
        if (context.Cases is null ||
            !context.Cases.TryGetValue("tasks", out var taskCases) ||
            !taskCases.TryGetValue("task_create", out var surfaces) ||
            !surfaces.TryGetValue("api", out var apiSurface) ||
            apiSurface is not Func<object?, Task<object?>> handler)
        {
            throw new AppCaseError("NOT_FOUND", "task_create API surface is not available in ctx.cases");
        }

        return handler;
    }
}
