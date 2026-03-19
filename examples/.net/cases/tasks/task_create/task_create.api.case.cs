using System.Text.Json;
using AppProtocol.Example.DotNet.Core;
using AppProtocol.Example.DotNet.Core.Shared;

namespace AppProtocol.Example.DotNet.Cases.Tasks.TaskCreate;

using RawTaskCollection = List<Dictionary<string, object?>>;

public sealed class TaskCreateApi : BaseApiCase<TaskCreateInput, TaskCreateOutput>
{
    private readonly TaskCreateDomain _domainCase = new();

    public TaskCreateApi(ApiContext context)
        : base(context)
    {
    }

    public override async Task<ApiResponse<TaskCreateOutput>> HandlerAsync(TaskCreateInput input)
    {
        var result = await ExecuteAsync(input);
        return result.Success
            ? ApiResponse<TaskCreateOutput>.Ok(result.Data!, 201)
            : ApiResponse<TaskCreateOutput>.Failure(result.Error!, MapErrorCodeToStatus(result.Error?.Code));
    }

    public override AppRouteBinding Router() => new()
    {
        Method = "POST",
        Path = "/tasks",
        Handler = async request =>
        {
            var input = Materialize<TaskCreateInput>(request.Body);
            return await HandlerAsync(input);
        },
    };

    public override async Task TestAsync()
    {
        var taskStore = ResolveTaskStore();
        await taskStore.ResetAsync();

        var result = await HandlerAsync(new TaskCreateInput
        {
            Title = "Test task",
            Description = "Created by task_create.api test",
        });

        if (!result.Success || result.Data is null)
        {
            throw new InvalidOperationException("test: handler should return success");
        }

        if (result.StatusCode != 201)
        {
            throw new InvalidOperationException("test: successful create must return statusCode 201");
        }

        if (result.Data.Task.Status != "todo")
        {
            throw new InvalidOperationException("test: created task must start in todo");
        }

        var persisted = await ReadTasksAsync(taskStore);
        if (persisted.Count != 1)
        {
            throw new InvalidOperationException("test: created task must be persisted");
        }

        await taskStore.ResetAsync();

        var concurrentCreates = await Task.WhenAll(
            Enumerable.Range(1, 4).Select(index =>
                HandlerAsync(new TaskCreateInput
                {
                    Title = $"Concurrent task {index}",
                })));

        if (concurrentCreates.Any(item => !item.Success))
        {
            throw new InvalidOperationException("test: concurrent creates must all succeed");
        }

        var concurrentPersisted = await ReadTasksAsync(taskStore);
        if (concurrentPersisted.Count != 4)
        {
            throw new InvalidOperationException("test: concurrent creates must persist every task");
        }

        try
        {
            await ValidateAsync(new TaskCreateInput { Title = "   " });
        }
        catch
        {
            return;
        }

        throw new InvalidOperationException("test: ValidateAsync must reject blank title");
    }

    protected override Task ValidateAsync(TaskCreateInput input)
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

    protected override async Task<TaskCreateOutput> ServiceAsync(TaskCreateInput input)
    {
        var taskStore = ResolveTaskStore();
        var timestamp = DateTimeOffset.UtcNow.ToString("O");
        var rawTask = new Dictionary<string, object?>
        {
            ["id"] = Guid.NewGuid().ToString(),
            ["title"] = input.Title!.Trim(),
            ["description"] = string.IsNullOrWhiteSpace(input.Description) ? null : input.Description.Trim(),
            ["status"] = "todo",
            ["createdAt"] = timestamp,
            ["updatedAt"] = timestamp,
        };

        await taskStore.UpdateAsync((Func<RawTaskCollection, Task<RawTaskCollection>>)(current =>
        {
            var next = new RawTaskCollection { rawTask };
            next.AddRange(current);
            return Task.FromResult(next);
        }));

        Ctx.Logger.Info("task_create: task persisted", new Dictionary<string, object?>
        {
            ["taskId"] = rawTask["id"],
            ["title"] = rawTask["title"],
        });

        return Materialize<TaskCreateOutput>(new Dictionary<string, object?>
        {
            ["task"] = rawTask,
        });
    }

    private dynamic ResolveTaskStore()
    {
        var providers = ResolveProviders();
        if (!providers.TryGetValue("taskStore", out var taskStore) || taskStore is null)
        {
            throw new AppCaseError("INTERNAL", "task_create requires a configured taskStore provider");
        }

        return taskStore;
    }

    private IDictionary<string, object?> ResolveProviders()
    {
        if (Ctx.Extra is null ||
            !Ctx.Extra.TryGetValue("providers", out var providersObject) ||
            providersObject is not IDictionary<string, object?> providers)
        {
            throw new AppCaseError("INTERNAL", "task_create requires providers in ctx.extra");
        }

        return providers;
    }

    private async Task<RawTaskCollection> ReadTasksAsync(dynamic taskStore)
    {
        var raw = await taskStore.ReadAsync();
        return Materialize<RawTaskCollection>(raw);
    }

    private static int MapErrorCodeToStatus(string? code) => code switch
    {
        "VALIDATION_FAILED" => 400,
        "NOT_FOUND" => 404,
        _ => 500,
    };
}
