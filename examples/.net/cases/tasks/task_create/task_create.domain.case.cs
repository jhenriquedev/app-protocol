using System.Text.Json;
using System.Text.Json.Serialization;
using AppProtocol.Example.DotNet.Core;

namespace AppProtocol.Example.DotNet.Cases.Tasks.TaskCreate;

public sealed class TaskCard
{
    public string? Id { get; init; }
    public string? Title { get; init; }
    public string? Description { get; init; }
    public string? Status { get; init; }
    public string? CreatedAt { get; init; }
    public string? UpdatedAt { get; init; }
}

public sealed class TaskCreateInput
{
    public string? Title { get; init; }
    public string? Description { get; init; }

    [JsonExtensionData]
    public IDictionary<string, JsonElement>? AdditionalProperties { get; init; }
}

public sealed class TaskCreateOutput
{
    public required TaskCard Task { get; init; }
}

public sealed class TaskCreateDomain : BaseDomainCase<TaskCreateInput, TaskCreateOutput>
{
    public override string CaseName() => "task_create";

    public override string Description() => "Creates a new task card for the board with an initial todo status.";

    public override AppSchema InputSchema() => new()
    {
        Type = "object",
        Properties = new Dictionary<string, AppSchema>
        {
            ["title"] = new() { Type = "string", Description = "Visible task title shown on the card." },
            ["description"] = new() { Type = "string", Description = "Optional complementary task description." },
        },
        Required = new[] { "title" },
        AdditionalProperties = false,
    };

    public override AppSchema OutputSchema() => new()
    {
        Type = "object",
        Properties = new Dictionary<string, AppSchema>
        {
            ["task"] = new()
            {
                Type = "object",
                Properties = new Dictionary<string, AppSchema>
                {
                    ["id"] = new() { Type = "string" },
                    ["title"] = new() { Type = "string" },
                    ["description"] = new() { Type = "string" },
                    ["status"] = new() { Type = "string", Enum = new[] { "todo", "doing", "done" } },
                    ["createdAt"] = new() { Type = "string" },
                    ["updatedAt"] = new() { Type = "string" },
                },
                Required = new[] { "id", "title", "status", "createdAt", "updatedAt" },
                AdditionalProperties = false,
            },
        },
        Required = new[] { "task" },
        AdditionalProperties = false,
    };

    public override void Validate(TaskCreateInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Title))
        {
            throw new InvalidOperationException("title is required and must be a string");
        }

        if (input.AdditionalProperties is null)
        {
            return;
        }

        foreach (var key in input.AdditionalProperties.Keys)
        {
            if (key is "id" or "status" or "createdAt" or "updatedAt")
            {
                throw new InvalidOperationException($"{key} must not be provided by the caller");
            }

            throw new InvalidOperationException($"{key} is not allowed in task_create");
        }
    }

    public override IReadOnlyList<string> Invariants() => new[]
    {
        "Every new task starts with status todo.",
        "The backend is the source of truth for task id and timestamps.",
        "createdAt and updatedAt are equal on first creation.",
    };

    public override IReadOnlyList<DomainExample<TaskCreateInput, TaskCreateOutput>> Examples() => new[]
    {
        new DomainExample<TaskCreateInput, TaskCreateOutput>
        {
            Name = "title_only",
            Description = "Create a task with only the required title.",
            Input = new TaskCreateInput { Title = "Ship the .NET example" },
            Output = new TaskCreateOutput
            {
                Task = new TaskCard
                {
                    Id = "task_001",
                    Title = "Ship the .NET example",
                    Status = "todo",
                    CreatedAt = "2026-03-18T12:00:00.000Z",
                    UpdatedAt = "2026-03-18T12:00:00.000Z",
                },
            },
        },
        new DomainExample<TaskCreateInput, TaskCreateOutput>
        {
            Name = "title_and_description",
            Description = "Create a task with an optional description.",
            Input = new TaskCreateInput
            {
                Title = "Prepare release notes",
                Description = "Summarize the scope of the first .NET APP example.",
            },
            Output = new TaskCreateOutput
            {
                Task = new TaskCard
                {
                    Id = "task_002",
                    Title = "Prepare release notes",
                    Description = "Summarize the scope of the first .NET APP example.",
                    Status = "todo",
                    CreatedAt = "2026-03-18T12:10:00.000Z",
                    UpdatedAt = "2026-03-18T12:10:00.000Z",
                },
            },
        },
    };

    public override Task TestAsync()
    {
        var definition = Definition();
        if (definition.CaseName != "task_create")
        {
            throw new InvalidOperationException("test: caseName must be task_create");
        }

        if (definition.InputSchema.Required?.Contains("title") != true)
        {
            throw new InvalidOperationException("test: inputSchema must require title");
        }

        Validate(new TaskCreateInput
        {
            Title = "Valid task",
            Description = "Optional text",
        });

        AssertThrows(() => Validate(new TaskCreateInput { Title = "   " }), "test: validate must reject blank title");
        AssertThrows(
            () => Validate(new TaskCreateInput
            {
                Title = "Bad task",
                AdditionalProperties = new Dictionary<string, JsonElement>
                {
                    ["status"] = JsonDocument.Parse("\"todo\"").RootElement.Clone(),
                },
            }),
            "test: validate must reject forbidden fields");

        foreach (var example in Examples())
        {
            Validate(example.Input);
            if (example.Output?.Task.Status != "todo")
            {
                throw new InvalidOperationException("test: example output must start in todo");
            }
        }

        return Task.CompletedTask;
    }

    private static void AssertThrows(Action action, string message)
    {
        try
        {
            action();
        }
        catch
        {
            return;
        }

        throw new InvalidOperationException(message);
    }
}
