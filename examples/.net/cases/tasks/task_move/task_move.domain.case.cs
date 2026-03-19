using System.Text.Json;
using System.Text.Json.Serialization;
using AppProtocol.Example.DotNet.Core;

namespace AppProtocol.Example.DotNet.Cases.Tasks.TaskMove;

public sealed class TaskCard
{
    public string? Id { get; init; }
    public string? Title { get; init; }
    public string? Description { get; init; }
    public string? Status { get; init; }
    public string? CreatedAt { get; init; }
    public string? UpdatedAt { get; init; }
}

public sealed class TaskMoveInput
{
    public string? TaskId { get; init; }
    public string? TargetStatus { get; init; }

    [JsonExtensionData]
    public IDictionary<string, JsonElement>? AdditionalProperties { get; init; }
}

public sealed class TaskMoveOutput
{
    public required TaskCard Task { get; init; }
}

public static class TaskMoveValidation
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
}

public sealed class TaskMoveDomain : BaseDomainCase<TaskMoveInput, TaskMoveOutput>
{
    public override string CaseName() => "task_move";

    public override string Description() => "Moves an existing task card to another board column.";

    public override AppSchema InputSchema() => new()
    {
        Type = "object",
        Properties = new Dictionary<string, AppSchema>
        {
            ["taskId"] = new() { Type = "string", Description = "Identifier of the task that will be moved." },
            ["targetStatus"] = new() { Type = "string", Description = "Destination board column for the task.", Enum = new[] { "todo", "doing", "done" } },
        },
        Required = new[] { "taskId", "targetStatus" },
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

    public override void Validate(TaskMoveInput input)
    {
        if (string.IsNullOrWhiteSpace(input.TaskId))
        {
            throw new InvalidOperationException("taskId is required");
        }

        if (string.IsNullOrWhiteSpace(input.TargetStatus) || !TaskMoveValidation.TaskStatusValues.Contains(input.TargetStatus))
        {
            throw new InvalidOperationException("targetStatus must be one of todo, doing, done");
        }

        if (input.AdditionalProperties?.Count > 0)
        {
            throw new InvalidOperationException("task_move does not allow additional fields");
        }
    }

    public void ValidateOutput(TaskMoveOutput output)
    {
        TaskMoveValidation.AssertTaskRecord(output.Task, "task_move.output.task");
    }

    public override IReadOnlyList<string> Invariants() => new[]
    {
        "Moving a task never changes its identity.",
        "A move only updates status and, when applicable, updatedAt.",
        "Moving to the same status is idempotent and returns the unchanged task.",
    };

    public override IReadOnlyList<DomainExample<TaskMoveInput, TaskMoveOutput>> Examples() => new[]
    {
        new DomainExample<TaskMoveInput, TaskMoveOutput>
        {
            Name = "move_todo_to_doing",
            Description = "A task leaves todo and enters doing.",
            Input = new TaskMoveInput
            {
                TaskId = "task_001",
                TargetStatus = "doing",
            },
            Output = new TaskMoveOutput
            {
                Task = new TaskCard
                {
                    Id = "task_001",
                    Title = "Ship the .NET example",
                    Status = "doing",
                    CreatedAt = "2026-03-18T12:00:00.000Z",
                    UpdatedAt = "2026-03-18T12:20:00.000Z",
                },
            },
        },
        new DomainExample<TaskMoveInput, TaskMoveOutput>
        {
            Name = "idempotent_move",
            Description = "Moving to the same status keeps the task unchanged.",
            Input = new TaskMoveInput
            {
                TaskId = "task_002",
                TargetStatus = "done",
            },
            Output = new TaskMoveOutput
            {
                Task = new TaskCard
                {
                    Id = "task_002",
                    Title = "Prepare release notes",
                    Status = "done",
                    CreatedAt = "2026-03-18T12:10:00.000Z",
                    UpdatedAt = "2026-03-18T12:10:00.000Z",
                },
            },
        },
    };

    public override Task TestAsync()
    {
        Validate(new TaskMoveInput
        {
            TaskId = "task_001",
            TargetStatus = "doing",
        });

        AssertThrows(
            () => Validate(new TaskMoveInput { TaskId = string.Empty, TargetStatus = "doing" }),
            "test: validate must reject empty taskId");

        AssertThrows(
            () => Validate(new TaskMoveInput { TaskId = "task_001", TargetStatus = "invalid" }),
            "test: validate must reject invalid targetStatus");

        ValidateOutput(new TaskMoveOutput
        {
            Task = new TaskCard
            {
                Id = "task_001",
                Title = "Valid task",
                Status = "doing",
                CreatedAt = "2026-03-18T12:00:00.000Z",
                UpdatedAt = "2026-03-18T12:20:00.000Z",
            },
        });

        AssertThrows(
            () => ValidateOutput(new TaskMoveOutput
            {
                Task = new TaskCard
                {
                    Id = "task_001",
                    Title = "Broken task",
                    Status = "broken",
                    CreatedAt = "2026-03-18T12:00:00.000Z",
                    UpdatedAt = "2026-03-18T12:20:00.000Z",
                },
            }),
            "test: validateOutput must reject invalid task payloads");

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
