using System.Text.Json;
using System.Text.Json.Serialization;
using AppProtocol.Example.DotNet.Core;

namespace AppProtocol.Example.DotNet.Cases.Tasks.TaskList;

public sealed class TaskCard
{
    public string? Id { get; init; }
    public string? Title { get; init; }
    public string? Description { get; init; }
    public string? Status { get; init; }
    public string? CreatedAt { get; init; }
    public string? UpdatedAt { get; init; }
}

public sealed class TaskListInput
{
    [JsonExtensionData]
    public IDictionary<string, JsonElement>? AdditionalProperties { get; init; }
}

public sealed class TaskListOutput
{
    public required IReadOnlyList<TaskCard> Tasks { get; init; }
}

public static class TaskListValidation
{
    public static readonly IReadOnlySet<string> TaskStatusValues = new HashSet<string>(StringComparer.Ordinal)
    {
        "todo",
        "doing",
        "done",
    };

    public static void AssertTaskRecord(TaskCard task, string source)
    {
        if (string.IsNullOrWhiteSpace(task.Id))
        {
            throw new InvalidOperationException($"{source}.id must be a non-empty string");
        }

        if (string.IsNullOrWhiteSpace(task.Title))
        {
            throw new InvalidOperationException($"{source}.title must be a non-empty string");
        }

        if (string.IsNullOrWhiteSpace(task.CreatedAt))
        {
            throw new InvalidOperationException($"{source}.createdAt must be a non-empty string");
        }

        if (string.IsNullOrWhiteSpace(task.UpdatedAt))
        {
            throw new InvalidOperationException($"{source}.updatedAt must be a non-empty string");
        }

        if (string.IsNullOrWhiteSpace(task.Status) || !TaskStatusValues.Contains(task.Status))
        {
            throw new InvalidOperationException($"{source}.status must be one of todo, doing, done");
        }
    }

    public static void AssertTaskCollection(IReadOnlyList<TaskCard> tasks, string source)
    {
        for (var index = 0; index < tasks.Count; index += 1)
        {
            AssertTaskRecord(tasks[index], $"{source}[{index}]");
        }
    }
}

public sealed class TaskListDomain : BaseDomainCase<TaskListInput, TaskListOutput>
{
    public override string CaseName() => "task_list";

    public override string Description() => "Lists persisted task cards for board rendering.";

    public override AppSchema InputSchema() => new()
    {
        Type = "object",
        Properties = new Dictionary<string, AppSchema>(),
        AdditionalProperties = false,
    };

    public override AppSchema OutputSchema() => new()
    {
        Type = "object",
        Properties = new Dictionary<string, AppSchema>
        {
            ["tasks"] = new()
            {
                Type = "array",
                Items = new AppSchema
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
        },
        Required = new[] { "tasks" },
        AdditionalProperties = false,
    };

    public override void Validate(TaskListInput input)
    {
        if (input.AdditionalProperties?.Count > 0)
        {
            throw new InvalidOperationException("task_list does not accept filters in v1");
        }
    }

    public void ValidateOutput(TaskListOutput output)
    {
        TaskListValidation.AssertTaskCollection(output.Tasks, "task_list.output.tasks");
    }

    public override IReadOnlyList<string> Invariants() => new[]
    {
        "Only todo, doing, done are valid task statuses.",
        "Listing tasks never mutates the persisted store.",
        "The response order is deterministic for the same persisted dataset.",
    };

    public override IReadOnlyList<DomainExample<TaskListInput, TaskListOutput>> Examples() => new[]
    {
        new DomainExample<TaskListInput, TaskListOutput>
        {
            Name = "empty_board",
            Description = "No persisted tasks yet.",
            Input = new TaskListInput(),
            Output = new TaskListOutput
            {
                Tasks = Array.Empty<TaskCard>(),
            },
        },
        new DomainExample<TaskListInput, TaskListOutput>
        {
            Name = "board_with_cards",
            Description = "Returns tasks already persisted in the board.",
            Input = new TaskListInput(),
            Output = new TaskListOutput
            {
                Tasks = new[]
                {
                    new TaskCard
                    {
                        Id = "task_002",
                        Title = "Prepare release notes",
                        Status = "todo",
                        CreatedAt = "2026-03-18T12:10:00.000Z",
                        UpdatedAt = "2026-03-18T12:10:00.000Z",
                    },
                    new TaskCard
                    {
                        Id = "task_001",
                        Title = "Ship the .NET example",
                        Description = "Wire the first APP cases in the portal.",
                        Status = "doing",
                        CreatedAt = "2026-03-18T12:00:00.000Z",
                        UpdatedAt = "2026-03-18T12:30:00.000Z",
                    },
                },
            },
        },
    };

    public override Task TestAsync()
    {
        Validate(new TaskListInput());

        try
        {
            Validate(new TaskListInput
            {
                AdditionalProperties = new Dictionary<string, JsonElement>
                {
                    ["status"] = JsonDocument.Parse("\"todo\"").RootElement.Clone(),
                },
            });
        }
        catch
        {
            goto outputValidation;
        }

        throw new InvalidOperationException("test: task_list input must reject filters");

    outputValidation:
        var example = Examples().First(item => item.Name == "board_with_cards");
        ValidateOutput(example.Output!);

        try
        {
            ValidateOutput(new TaskListOutput
            {
                Tasks = new[]
                {
                    new TaskCard
                    {
                        Id = "bad",
                        Title = "Invalid task",
                        Status = "invalid",
                        CreatedAt = "2026-03-18T12:00:00.000Z",
                        UpdatedAt = "2026-03-18T12:00:00.000Z",
                    },
                },
            });
        }
        catch
        {
            return Task.CompletedTask;
        }

        throw new InvalidOperationException("test: ValidateOutput must reject invalid task status");
    }
}
