using AppProtocol.Example.DotNet.Core;
using AppProtocol.Example.DotNet.Core.Shared;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Rendering;

namespace AppProtocol.Example.DotNet.Cases.Tasks.TaskList;

public sealed class TaskListUi : BaseUiCase<TaskListUi.ViewState>
{
    private readonly TaskListDomain _domainCase = new();

    public TaskListUi(UiContext context)
        : base(context, new ViewState
        {
            Tasks = Array.Empty<TaskCard>(),
            Loading = true,
        })
    {
    }

    public override RenderFragment View() => builder =>
    {
        builder.OpenComponent<TaskListViewComponent>(0);
        builder.AddAttribute(1, nameof(TaskListViewComponent.Owner), this);
        builder.CloseComponent();
    };

    public override async Task TestAsync()
    {
        var view = View();
        if (view is null)
        {
            throw new InvalidOperationException("test: view must return a visual unit");
        }

        var result = await ServiceAsync(new TaskListInput());
        if (result.Tasks.Count != 2)
        {
            throw new InvalidOperationException("test: ui service must return the mocked task list");
        }

        var viewModel = BuildViewModel(new ViewState
        {
            Tasks = result.Tasks,
        });

        var todoColumn = viewModel.Columns.FirstOrDefault(column => column.Status == "todo");
        var doingColumn = viewModel.Columns.FirstOrDefault(column => column.Status == "doing");
        if (todoColumn is null || todoColumn.Tasks.Count != 1 || doingColumn is null || doingColumn.Tasks.Count != 1)
        {
            throw new InvalidOperationException("test: ui viewmodel must group tasks by status");
        }
    }

    internal async Task<TaskListOutput> ServiceAsync(TaskListInput input)
    {
        _domainCase.Validate(input);
        return await RepositoryAsync();
    }

    internal async Task<TaskListOutput> RepositoryAsync()
    {
        if (Ctx.Api is null)
        {
            throw new InvalidOperationException("task_list.ui requires ctx.api");
        }

        var response = await Ctx.Api.RequestAsync(new AppHttpRequest("GET", "/tasks"));
        var result = Materialize<TaskListOutput>(response);
        _domainCase.ValidateOutput(result);
        return result;
    }

    internal object ResolveDesignSystem()
    {
        if (Ctx.Packages is null ||
            !Ctx.Packages.TryGetValue("designSystem", out var designSystem) ||
            designSystem is null)
        {
            throw new InvalidOperationException("task_list.ui requires packages.designSystem");
        }

        return designSystem;
    }

    internal int ResolveRefreshToken()
    {
        return Ctx.Extra is not null &&
               Ctx.Extra.TryGetValue("refreshToken", out var refreshToken) &&
               refreshToken is int value
            ? value
            : 0;
    }

    internal Func<object, RenderFragment>? ResolveRenderCardActions()
    {
        return Ctx.Extra is not null &&
               Ctx.Extra.TryGetValue("renderCardActions", out var renderCardActions) &&
               renderCardActions is Func<object, RenderFragment> callback
            ? callback
            : null;
    }

    internal BoardViewModel BuildViewModel(ViewState state)
    {
        return new BoardViewModel(
            new[]
            {
                BuildColumn("todo", "To Do", state),
                BuildColumn("doing", "Doing", state),
                BuildColumn("done", "Done", state),
            },
            state.Error);
    }

    private static ColumnViewModel BuildColumn(string status, string title, ViewState state)
    {
        var tasks = state.Tasks.Where(task => string.Equals(task.Status, status, StringComparison.Ordinal)).ToList();
        var emptyMessage = state.Loading ? "Carregando cards..." : $"Nenhum card em {status}.";
        return new ColumnViewModel(status, title, tasks, emptyMessage);
    }

    public sealed class ViewState
    {
        public required IReadOnlyList<TaskCard> Tasks { get; init; }
        public bool Loading { get; init; }
        public string? Error { get; init; }
    }

    public sealed record ColumnViewModel(string Status, string Title, IReadOnlyList<TaskCard> Tasks, string EmptyMessage);
    public sealed record BoardViewModel(IReadOnlyList<ColumnViewModel> Columns, string? Feedback);

    public sealed class TaskListViewComponent : ComponentBase
    {
        [Parameter]
        public required TaskListUi Owner { get; set; }

        private ViewState _state = new()
        {
            Tasks = Array.Empty<TaskCard>(),
            Loading = true,
        };

        private int _lastRefreshToken = int.MinValue;

        protected override async Task OnParametersSetAsync()
        {
            var refreshToken = Owner.ResolveRefreshToken();
            if (_lastRefreshToken == refreshToken)
            {
                return;
            }

            _lastRefreshToken = refreshToken;
            await LoadTasksAsync();
        }

        private async Task LoadTasksAsync()
        {
            _state = new ViewState
            {
                Tasks = _state.Tasks,
                Loading = true,
            };

            try
            {
                var result = await Owner.ServiceAsync(new TaskListInput());
                _state = new ViewState
                {
                    Tasks = result.Tasks,
                    Loading = false,
                };
            }
            catch (Exception error)
            {
                _state = new ViewState
                {
                    Tasks = Array.Empty<TaskCard>(),
                    Loading = false,
                    Error = error.Message,
                };
            }

            await InvokeAsync(StateHasChanged);
        }

        protected override void BuildRenderTree(RenderTreeBuilder builder)
        {
            dynamic designSystem = Owner.ResolveDesignSystem();
            var renderCardActions = Owner.ResolveRenderCardActions();
            var viewModel = Owner.BuildViewModel(_state);

            builder.OpenElement(0, "section");
            if (!string.IsNullOrWhiteSpace(viewModel.Feedback))
            {
                builder.OpenElement(1, "div");
                builder.AddAttribute(2, "style", "background: #ffe1dd; border-radius: 14px; color: #9a2d1f; margin-bottom: 1rem; padding: 0.9rem 1rem;");
                builder.AddContent(3, viewModel.Feedback);
                builder.CloseElement();
            }

            builder.AddContent(4, (RenderFragment)designSystem.TaskBoard((RenderFragment)(columnsBuilder =>
            {
                foreach (var column in viewModel.Columns)
                {
                    columnsBuilder.AddContent(0, (RenderFragment)designSystem.TaskColumn(
                        column.Title,
                        column.Tasks.Count,
                        (RenderFragment)(contentBuilder =>
                        {
                            if (column.Tasks.Count > 0)
                            {
                                foreach (var task in column.Tasks)
                                {
                                    contentBuilder.AddContent(0, (RenderFragment)designSystem.TaskCard(
                                        task.Title ?? string.Empty,
                                        task.Description,
                                        task.Status ?? "todo",
                                        renderCardActions?.Invoke(task)));
                                }
                            }
                            else
                            {
                                contentBuilder.AddContent(1, (RenderFragment)designSystem.EmptyColumnState(column.EmptyMessage));
                            }
                        })));
                }
            })));

            builder.CloseElement();
        }
    }
}
