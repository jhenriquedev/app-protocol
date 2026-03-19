using AppProtocol.Example.DotNet.Core;
using AppProtocol.Example.DotNet.Core.Shared;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Rendering;

namespace AppProtocol.Example.DotNet.Cases.Tasks.TaskMove;

public sealed class TaskMoveUi : BaseUiCase<TaskMoveUi.ViewState>
{
    private readonly TaskMoveDomain _domainCase = new();
    private bool _moveLocked;

    public TaskMoveUi(UiContext context)
        : base(context, new ViewState())
    {
    }

    public override RenderFragment View() => builder =>
    {
        builder.OpenComponent<TaskMoveViewComponent>(0);
        builder.AddAttribute(1, nameof(TaskMoveViewComponent.Owner), this);
        builder.CloseComponent();
    };

    public override async Task TestAsync()
    {
        var view = View();
        if (view is null)
        {
            throw new InvalidOperationException("test: view must return a visual unit");
        }

        var result = await ServiceAsync(new TaskMoveInput
        {
            TaskId = "task_001",
            TargetStatus = "doing",
        });

        if (result.Task.Status != "doing")
        {
            throw new InvalidOperationException("test: ui service must return the moved task");
        }

        try
        {
            await ServiceAsync(new TaskMoveInput
            {
                TaskId = string.Empty,
                TargetStatus = "done",
            });
        }
        catch
        {
            goto lockChecks;
        }

        throw new InvalidOperationException("test: ui service must reject invalid input");

    lockChecks:
        if (!AcquireMoveLock())
        {
            throw new InvalidOperationException("test: first move lock acquisition must succeed");
        }

        if (AcquireMoveLock())
        {
            throw new InvalidOperationException("test: move lock must reject reentry");
        }

        ReleaseMoveLock();
        if (!AcquireMoveLock())
        {
            throw new InvalidOperationException("test: move lock must be releasable");
        }

        ReleaseMoveLock();
    }

    internal async Task<TaskMoveOutput> ServiceAsync(TaskMoveInput input)
    {
        _domainCase.Validate(input);
        return await RepositoryAsync(input);
    }

    internal async Task<TaskMoveOutput> RepositoryAsync(TaskMoveInput input)
    {
        if (Ctx.Api is null)
        {
            throw new InvalidOperationException("task_move.ui requires ctx.api");
        }

        var response = await Ctx.Api.RequestAsync(new AppHttpRequest(
            "PATCH",
            $"/tasks/{input.TaskId}/status",
            new TaskMoveInput { TargetStatus = input.TargetStatus }));

        var result = Materialize<TaskMoveOutput>(response);
        if (string.IsNullOrWhiteSpace(result.Task.Id))
        {
            throw new InvalidOperationException("task_move.ui received an invalid move response");
        }

        return result;
    }

    internal object ResolveDesignSystem()
    {
        if (Ctx.Packages is null ||
            !Ctx.Packages.TryGetValue("designSystem", out var designSystem) ||
            designSystem is null)
        {
            throw new InvalidOperationException("task_move.ui requires packages.designSystem");
        }

        return designSystem;
    }

    internal TaskCard ResolveTask()
    {
        if (Ctx.Extra is null ||
            !Ctx.Extra.TryGetValue("task", out var task) ||
            task is null)
        {
            throw new InvalidOperationException("task_move.ui requires extra.task");
        }

        return Materialize<TaskCard>(task);
    }

    internal Func<Task>? ResolveOnTaskMoved()
    {
        return Ctx.Extra is not null &&
               Ctx.Extra.TryGetValue("onTaskMoved", out var callback) &&
               callback is Func<Task> onTaskMoved
            ? onTaskMoved
            : null;
    }

    internal bool AcquireMoveLock()
    {
        if (_moveLocked)
        {
            return false;
        }

        _moveLocked = true;
        return true;
    }

    internal void ReleaseMoveLock()
    {
        _moveLocked = false;
    }

    public sealed class ViewState
    {
        public bool Loading { get; init; }
        public string? Error { get; init; }
    }

    public sealed class TaskMoveViewComponent : ComponentBase
    {
        [Parameter]
        public required TaskMoveUi Owner { get; set; }

        private ViewState _state = new();

        private async Task MoveAsync(string nextStatus)
        {
            if (!Owner.AcquireMoveLock())
            {
                return;
            }

            _state = new ViewState { Loading = true };
            await InvokeAsync(StateHasChanged);

            try
            {
                var task = Owner.ResolveTask();
                await Owner.ServiceAsync(new TaskMoveInput
                {
                    TaskId = task.Id,
                    TargetStatus = nextStatus,
                });

                var onTaskMoved = Owner.ResolveOnTaskMoved();
                if (onTaskMoved is not null)
                {
                    await onTaskMoved();
                }

                _state = new ViewState();
            }
            catch (Exception error)
            {
                _state = new ViewState
                {
                    Error = error.Message,
                };
            }
            finally
            {
                Owner.ReleaseMoveLock();
            }

            await InvokeAsync(StateHasChanged);
        }

        protected override void BuildRenderTree(RenderTreeBuilder builder)
        {
            dynamic designSystem = Owner.ResolveDesignSystem();
            var task = Owner.ResolveTask();

            builder.OpenElement(0, "div");
            builder.AddContent(1, (RenderFragment)designSystem.MoveTaskAction(
                this,
                task.Status ?? "todo",
                _state.Loading,
                (Func<string, Task>)MoveAsync));

            if (!string.IsNullOrWhiteSpace(_state.Error))
            {
                builder.OpenElement(2, "div");
                builder.AddAttribute(3, "style", "color: #9a2d1f; font-size: 0.82rem; margin-top: 0.55rem;");
                builder.AddContent(4, _state.Error);
                builder.CloseElement();
            }

            builder.CloseElement();
        }
    }
}
