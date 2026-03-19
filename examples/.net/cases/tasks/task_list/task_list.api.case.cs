using AppProtocol.Example.DotNet.Core;
using AppProtocol.Example.DotNet.Core.Shared;

namespace AppProtocol.Example.DotNet.Cases.Tasks.TaskList;

using RawTaskCollection = List<Dictionary<string, object?>>;

public sealed class TaskListApi : BaseApiCase<TaskListInput, TaskListOutput>
{
    private readonly TaskListDomain _domainCase = new();

    public TaskListApi(ApiContext context)
        : base(context)
    {
    }

    public override async Task<ApiResponse<TaskListOutput>> HandlerAsync(TaskListInput input)
    {
        var result = await ExecuteAsync(input);
        return result.Success
            ? ApiResponse<TaskListOutput>.Ok(result.Data!, 200)
            : ApiResponse<TaskListOutput>.Failure(result.Error!, MapErrorCodeToStatus(result.Error?.Code));
    }

    public override AppRouteBinding Router() => new()
    {
        Method = "GET",
        Path = "/tasks",
        Handler = async _ => await HandlerAsync(new TaskListInput()),
    };

    public override async Task TestAsync()
    {
        var taskStore = ResolveTaskStore();
        await taskStore.ResetAsync();
        await taskStore.WriteAsync(new RawTaskCollection
        {
            new()
            {
                ["id"] = "task_001",
                ["title"] = "Older task",
                ["status"] = "todo",
                ["createdAt"] = "2026-03-18T12:00:00.000Z",
                ["updatedAt"] = "2026-03-18T12:00:00.000Z",
            },
            new()
            {
                ["id"] = "task_002",
                ["title"] = "Newer task",
                ["status"] = "doing",
                ["createdAt"] = "2026-03-18T12:30:00.000Z",
                ["updatedAt"] = "2026-03-18T12:30:00.000Z",
            },
        });

        var result = await HandlerAsync(new TaskListInput());
        if (!result.Success || result.Data is null)
        {
            throw new InvalidOperationException("test: handler should return a successful task list");
        }

        if (result.Data.Tasks.Count != 2)
        {
            throw new InvalidOperationException("test: task list should return all persisted tasks");
        }

        if (result.Data.Tasks[0].Id != "task_002")
        {
            throw new InvalidOperationException("test: task list should sort by createdAt descending");
        }

        await taskStore.WriteAsync(new RawTaskCollection
        {
            new()
            {
                ["id"] = "broken",
                ["title"] = "Broken task",
                ["status"] = "broken",
                ["createdAt"] = "2026-03-18T12:00:00.000Z",
                ["updatedAt"] = "2026-03-18T12:00:00.000Z",
            },
        });

        var invalidResult = await HandlerAsync(new TaskListInput());
        if (invalidResult.Success)
        {
            throw new InvalidOperationException("test: invalid persisted records must return failure");
        }
    }

    protected override Task ValidateAsync(TaskListInput input)
    {
        try
        {
            _domainCase.Validate(input);
            return Task.CompletedTask;
        }
        catch (Exception error)
        {
            throw new AppCaseError("VALIDATION_FAILED", error.Message);
        }
    }

    protected override async Task<TaskListOutput> ServiceAsync(TaskListInput input)
    {
        var taskStore = ResolveTaskStore();
        object rawResponse = await taskStore.ReadAsync();
        var rawTasks = Materialize<RawTaskCollection>(rawResponse);
        IReadOnlyList<TaskCard> tasks;
        try
        {
            tasks = rawTasks
                .Select(item => Materialize<TaskCard>(item))
                .ToList();

            TaskListValidation.AssertTaskCollection(tasks, "task_list.persisted_tasks");
        }
        catch (Exception error)
        {
            throw new AppCaseError("INTERNAL", error.Message);
        }

        var sorted = tasks
            .OrderByDescending(task => DateTimeOffset.Parse(task.CreatedAt!))
            .ToList();

        var output = new TaskListOutput
        {
            Tasks = sorted,
        };
        _domainCase.ValidateOutput(output);
        return output;
    }

    private dynamic ResolveTaskStore()
    {
        if (Ctx.Extra is null ||
            !Ctx.Extra.TryGetValue("providers", out var providersObject) ||
            providersObject is not IDictionary<string, object?> providers ||
            !providers.TryGetValue("taskStore", out var taskStore) ||
            taskStore is null)
        {
            throw new AppCaseError("INTERNAL", "task_list requires a configured taskStore provider");
        }

        return taskStore;
    }

    private static int MapErrorCodeToStatus(string? code) => code switch
    {
        "VALIDATION_FAILED" => 400,
        _ => 500,
    };
}
