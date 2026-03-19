using AppProtocol.Example.DotNet.Core;
using AppProtocol.Example.DotNet.Core.Shared;

namespace AppProtocol.Example.DotNet.Cases.Tasks.TaskMove;

using RawTaskCollection = List<Dictionary<string, object?>>;

public sealed class TaskMoveApi : BaseApiCase<TaskMoveInput, TaskMoveOutput>
{
    private readonly TaskMoveDomain _domainCase = new();

    public TaskMoveApi(ApiContext context)
        : base(context)
    {
    }

    public override async Task<ApiResponse<TaskMoveOutput>> HandlerAsync(TaskMoveInput input)
    {
        var result = await ExecuteAsync(input);
        return result.Success
            ? ApiResponse<TaskMoveOutput>.Ok(result.Data!, 200)
            : ApiResponse<TaskMoveOutput>.Failure(result.Error!, MapErrorCodeToStatus(result.Error?.Code));
    }

    public override AppRouteBinding Router() => new()
    {
        Method = "PATCH",
        Path = "/tasks/:taskId/status",
        Handler = async request =>
        {
            var body = Materialize<TaskMoveInput>(request.Body);
            var input = new TaskMoveInput
            {
                TaskId = request.Params.TryGetValue("taskId", out var taskId) ? taskId : body.TaskId,
                TargetStatus = body.TargetStatus,
                AdditionalProperties = body.AdditionalProperties,
            };

            return await HandlerAsync(input);
        },
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
                ["title"] = "Ship the .NET example",
                ["status"] = "todo",
                ["createdAt"] = "2026-03-18T12:00:00.000Z",
                ["updatedAt"] = "2026-03-18T12:00:00.000Z",
            },
        });

        var movedResult = await HandlerAsync(new TaskMoveInput
        {
            TaskId = "task_001",
            TargetStatus = "doing",
        });

        if (!movedResult.Success || movedResult.Data is null || movedResult.Data.Task.Status != "doing")
        {
            throw new InvalidOperationException("test: move should return success");
        }

        var persisted = Materialize<RawTaskCollection>(await taskStore.ReadAsync());
        if (Materialize<TaskCard>(persisted[0]).Status != "doing")
        {
            throw new InvalidOperationException("test: moved status must persist");
        }

        var idempotentResult = await HandlerAsync(new TaskMoveInput
        {
            TaskId = "task_001",
            TargetStatus = "doing",
        });
        if (!idempotentResult.Success || idempotentResult.Data is null)
        {
            throw new InvalidOperationException("test: idempotent move should still succeed");
        }

        var notFoundResult = await HandlerAsync(new TaskMoveInput
        {
            TaskId = "missing",
            TargetStatus = "done",
        });
        if (notFoundResult.Success || notFoundResult.StatusCode != 404)
        {
            throw new InvalidOperationException("test: missing task must return NOT_FOUND");
        }

        await taskStore.WriteAsync(new RawTaskCollection
        {
            new()
            {
                ["id"] = "task_002",
                ["title"] = "Broken task",
                ["description"] = 123,
                ["status"] = "todo",
                ["createdAt"] = "2026-03-18T12:00:00.000Z",
                ["updatedAt"] = "2026-03-18T12:00:00.000Z",
            },
        });

        var invalidPersistedResult = await HandlerAsync(new TaskMoveInput
        {
            TaskId = "task_002",
            TargetStatus = "doing",
        });
        if (invalidPersistedResult.Success || invalidPersistedResult.StatusCode != 500)
        {
            throw new InvalidOperationException("test: invalid persisted task must return failure");
        }
    }

    protected override Task ValidateAsync(TaskMoveInput input)
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

    protected override async Task<TaskMoveOutput> ServiceAsync(TaskMoveInput input)
    {
        var taskStore = ResolveTaskStore();
        TaskMoveOutput? output = null;
        string? previousStatus = null;

        await taskStore.UpdateAsync((Func<RawTaskCollection, Task<RawTaskCollection>>)(current =>
        {
            var index = current.FindIndex(task =>
                string.Equals(Materialize<TaskCard>(task).Id, input.TaskId, StringComparison.Ordinal));

            if (index < 0)
            {
                throw new AppCaseError("NOT_FOUND", $"Task {input.TaskId} was not found");
            }

            TaskCard currentTask;
            try
            {
                currentTask = Materialize<TaskCard>(current[index]);
                TaskMoveValidation.AssertTaskRecord(currentTask, "task_move.persisted_task");
            }
            catch (Exception error)
            {
                throw new AppCaseError("INTERNAL", error.Message);
            }

            if (string.Equals(currentTask.Status, input.TargetStatus, StringComparison.Ordinal))
            {
                output = new TaskMoveOutput { Task = currentTask };
                _domainCase.ValidateOutput(output);
                return Task.FromResult(current);
            }

            previousStatus = currentTask.Status;
            var updatedTask = new Dictionary<string, object?>
            {
                ["id"] = currentTask.Id,
                ["title"] = currentTask.Title,
                ["description"] = currentTask.Description,
                ["status"] = input.TargetStatus,
                ["createdAt"] = currentTask.CreatedAt,
                ["updatedAt"] = DateTimeOffset.UtcNow.ToString("O"),
            };

            output = Materialize<TaskMoveOutput>(new Dictionary<string, object?>
            {
                ["task"] = updatedTask,
            });
            _domainCase.ValidateOutput(output);

            var updated = new RawTaskCollection(current);
            updated[index] = updatedTask;
            return Task.FromResult(updated);
        }));

        if (output is null)
        {
            throw new AppCaseError("INTERNAL", "task_move did not produce an output");
        }

        if (!string.IsNullOrWhiteSpace(previousStatus))
        {
            Ctx.Logger.Info("task_move: task status updated", new Dictionary<string, object?>
            {
                ["taskId"] = output.Task.Id,
                ["from"] = previousStatus,
                ["to"] = output.Task.Status,
            });
        }

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
            throw new AppCaseError("INTERNAL", "task_move requires a configured taskStore provider");
        }

        return taskStore;
    }

    private static int MapErrorCodeToStatus(string? code) => code switch
    {
        "VALIDATION_FAILED" => 400,
        "NOT_FOUND" => 404,
        _ => 500,
    };
}
