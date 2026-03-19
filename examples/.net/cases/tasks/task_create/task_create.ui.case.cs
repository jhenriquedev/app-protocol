using AppProtocol.Example.DotNet.Core;
using AppProtocol.Example.DotNet.Core.Shared;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Rendering;

namespace AppProtocol.Example.DotNet.Cases.Tasks.TaskCreate;

public sealed class TaskCreateUi : BaseUiCase<TaskCreateUi.ViewState>
{
    private readonly TaskCreateDomain _domainCase = new();
    private bool _submissionLocked;

    public TaskCreateUi(UiContext context)
        : base(context, new ViewState())
    {
    }

    public override RenderFragment View() => builder =>
    {
        builder.OpenComponent<TaskCreateViewComponent>(0);
        builder.AddAttribute(1, nameof(TaskCreateViewComponent.Owner), this);
        builder.CloseComponent();
    };

    public override async Task TestAsync()
    {
        var view = View();
        if (view is null)
        {
            throw new InvalidOperationException("test: view must return a visual unit");
        }

        var result = await ServiceAsync(new TaskCreateInput
        {
            Title = "Create task UI test",
            Description = "UI surface repository flow",
        });

        if (string.IsNullOrWhiteSpace(result.Task.Id))
        {
            throw new InvalidOperationException("test: ui service must return a created task id");
        }

        var viewModel = BuildViewModel(new ViewState
        {
            Result = result,
        });
        if (viewModel.Type != "success")
        {
            throw new InvalidOperationException("test: ui viewmodel must expose success feedback");
        }

        try
        {
            await ServiceAsync(new TaskCreateInput { Title = "   " });
        }
        catch
        {
            goto lockChecks;
        }

        throw new InvalidOperationException("test: ui service must reject blank title");

    lockChecks:
        if (!AcquireSubmissionLock())
        {
            throw new InvalidOperationException("test: first submission lock acquisition must succeed");
        }

        if (AcquireSubmissionLock())
        {
            throw new InvalidOperationException("test: submission lock must reject reentry");
        }

        ReleaseSubmissionLock();
        if (!AcquireSubmissionLock())
        {
            throw new InvalidOperationException("test: submission lock must be releasable");
        }

        ReleaseSubmissionLock();
    }

    internal async Task<TaskCreateOutput> ServiceAsync(TaskCreateInput input)
    {
        _domainCase.Validate(input);
        return await RepositoryAsync(input);
    }

    internal async Task<TaskCreateOutput> RepositoryAsync(TaskCreateInput input)
    {
        if (Ctx.Api is null)
        {
            throw new InvalidOperationException("task_create.ui requires ctx.api");
        }

        var response = await Ctx.Api.RequestAsync(new AppHttpRequest("POST", "/tasks", input));
        var result = Materialize<TaskCreateOutput>(response);
        if (string.IsNullOrWhiteSpace(result.Task.Id))
        {
            throw new InvalidOperationException("task_create.ui received an invalid create response");
        }

        return result;
    }

    internal object ResolveDesignSystem()
    {
        if (Ctx.Packages is null ||
            !Ctx.Packages.TryGetValue("designSystem", out var designSystem) ||
            designSystem is null)
        {
            throw new InvalidOperationException("task_create.ui requires packages.designSystem");
        }

        return designSystem;
    }

    internal FeedbackViewModel BuildViewModel(ViewState state)
    {
        if (!string.IsNullOrWhiteSpace(state.Error))
        {
            return new FeedbackViewModel("error", state.Error);
        }

        if (state.Result is not null)
        {
            return new FeedbackViewModel("success", $"Task \"{state.Result.Task.Title}\" created successfully.");
        }

        return new FeedbackViewModel(null, null);
    }

    internal bool AcquireSubmissionLock()
    {
        if (_submissionLocked)
        {
            return false;
        }

        _submissionLocked = true;
        return true;
    }

    internal void ReleaseSubmissionLock()
    {
        _submissionLocked = false;
    }

    internal Func<Task>? ResolveOnTaskCreated()
    {
        return Ctx.Extra is not null &&
               Ctx.Extra.TryGetValue("onTaskCreated", out var callback) &&
               callback is Func<Task> onTaskCreated
            ? onTaskCreated
            : null;
    }

    public sealed class ViewState
    {
        public bool ModalOpen { get; init; }
        public string Title { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public bool Loading { get; init; }
        public string? Error { get; init; }
        public TaskCreateOutput? Result { get; init; }
    }

    public sealed record FeedbackViewModel(string? Type, string? Message);

    public sealed class TaskCreateViewComponent : ComponentBase
    {
        [Parameter]
        public required TaskCreateUi Owner { get; set; }

        private ViewState _state = new();

        private async Task SubmitAsync()
        {
            if (!Owner.AcquireSubmissionLock())
            {
                return;
            }

            _state = new ViewState
            {
                ModalOpen = _state.ModalOpen,
                Title = _state.Title,
                Description = _state.Description,
                Loading = true,
            };
            await InvokeAsync(StateHasChanged);

            try
            {
                var result = await Owner.ServiceAsync(new TaskCreateInput
                {
                    Title = _state.Title,
                    Description = string.IsNullOrWhiteSpace(_state.Description) ? null : _state.Description,
                });

                var onTaskCreated = Owner.ResolveOnTaskCreated();
                if (onTaskCreated is not null)
                {
                    await onTaskCreated();
                }

                _state = new ViewState
                {
                    Result = result,
                };
            }
            catch (Exception error)
            {
                _state = new ViewState
                {
                    ModalOpen = _state.ModalOpen,
                    Title = _state.Title,
                    Description = _state.Description,
                    Error = error.Message,
                };
            }
            finally
            {
                Owner.ReleaseSubmissionLock();
            }

            await InvokeAsync(StateHasChanged);
        }

        protected override void BuildRenderTree(RenderTreeBuilder builder)
        {
            dynamic designSystem = Owner.ResolveDesignSystem();
            var viewModel = Owner.BuildViewModel(_state);
            Func<Task> openModal = () =>
            {
                _state = new ViewState
                {
                    ModalOpen = true,
                    Title = _state.Title,
                    Description = _state.Description,
                };

                StateHasChanged();
                return Task.CompletedTask;
            };

            Func<string, Task> onTitleChange = value =>
            {
                _state = new ViewState
                {
                    ModalOpen = _state.ModalOpen,
                    Title = value,
                    Description = _state.Description,
                    Loading = _state.Loading,
                    Error = _state.Error,
                    Result = _state.Result,
                };

                StateHasChanged();
                return Task.CompletedTask;
            };

            Func<string, Task> onDescriptionChange = value =>
            {
                _state = new ViewState
                {
                    ModalOpen = _state.ModalOpen,
                    Title = _state.Title,
                    Description = value,
                    Loading = _state.Loading,
                    Error = _state.Error,
                    Result = _state.Result,
                };

                StateHasChanged();
                return Task.CompletedTask;
            };

            Func<Task> onClose = () =>
            {
                _state = new ViewState
                {
                    Title = _state.Title,
                    Description = _state.Description,
                    Result = _state.Result,
                };

                StateHasChanged();
                return Task.CompletedTask;
            };

            Func<Task> onSubmit = SubmitAsync;

            builder.OpenElement(0, "section");
            builder.AddAttribute(1, "style", "margin-bottom: 1.5rem");
            builder.OpenElement(2, "div");
            builder.AddAttribute(3, "style", "display: flex; justify-content: flex-end;");
            builder.AddContent(4, (RenderFragment)designSystem.CreateTaskButton(
                this,
                _state.Loading,
                openModal));
            builder.CloseElement();

            builder.AddContent(5, (RenderFragment)designSystem.TaskFormModal(
                this,
                _state.ModalOpen,
                _state.Title,
                _state.Description,
                _state.Loading,
                onTitleChange,
                onDescriptionChange,
                onClose,
                onSubmit));

            if (!string.IsNullOrWhiteSpace(viewModel.Message))
            {
                builder.OpenElement(6, "div");
                builder.AddAttribute(
                    7,
                    "style",
                    $"background: {(viewModel.Type == "success" ? "#dff7e4" : "#ffe1dd")}; border-radius: 14px; color: {(viewModel.Type == "success" ? "#0c6a36" : "#9a2d1f")}; margin-top: 1rem; padding: 0.9rem 1rem;");
                builder.AddContent(8, viewModel.Message);
                builder.CloseElement();
            }

            builder.CloseElement();
        }
    }
}
