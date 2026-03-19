using System.Text.Json;
using AppProtocol.Example.DotNet.Core;
using AppProtocol.Example.DotNet.Core.Shared;
using AppProtocol.Example.DotNet.Packages.DesignSystem;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Rendering;

namespace AppProtocol.Example.DotNet.Apps.Portal;

public sealed class PortalRuntime
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    private readonly PortalConfig _config;
    private readonly DelegateAppLogger _logger;

    public PortalRuntime(PortalConfig? config = null, HttpClient? httpClient = null)
    {
        _config = config ?? new PortalConfig();
        Registry = PortalRegistryFactory.Create(_config, httpClient);
        _logger = new DelegateAppLogger(
            (message, meta) => Console.WriteLine($"[portal] {message} {FormatMeta(meta)}"),
            (message, meta) => Console.WriteLine($"[portal] {message} {FormatMeta(meta)}"),
            (message, meta) => Console.WriteLine($"[portal] {message} {FormatMeta(meta)}"),
            (message, meta) => Console.Error.WriteLine($"[portal] {message} {FormatMeta(meta)}"));
    }

    public PortalConfig Config => _config;
    public PortalRegistry Registry { get; }

    public UiContext CreateUiContext(IDictionary<string, object?>? extra = null)
    {
        var mergedExtra = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["apiBaseUrl"] = _config.ApiBaseUrl,
        };

        if (extra is not null)
        {
            foreach (var (key, value) in extra)
            {
                mergedExtra[key] = value;
            }
        }

        return new UiContext
        {
            CorrelationId = Guid.NewGuid().ToString(),
            ExecutionId = Guid.NewGuid().ToString(),
            Logger = _logger,
            Api = ResolveHttpClient(),
            Packages = Registry.Packages,
            Renderer = new Dictionary<string, object?>
            {
                ["runtime"] = "blazor",
            },
            Extra = mergedExtra,
        };
    }

    public RenderFragment RenderRoot() => builder =>
    {
        builder.OpenComponent<PortalRootComponent>(0);
        builder.AddAttribute(1, nameof(PortalRootComponent.Runtime), this);
        builder.CloseComponent();
    };

    public Type ResolveUiType(string domain, string caseName)
    {
        if (!Registry.Cases.TryGetValue(domain, out var domainCases) ||
            !domainCases.TryGetValue(caseName, out var surfaces) ||
            surfaces.Ui is null)
        {
            throw new InvalidOperationException($"UI surface {domain}.{caseName} is not registered in apps/portal.");
        }

        return surfaces.Ui;
    }

    public object CreateUiCase(string domain, string caseName, UiContext context)
    {
        return Activator.CreateInstance(ResolveUiType(domain, caseName), context)
               ?? throw new InvalidOperationException($"Unable to instantiate UI surface {domain}.{caseName}.");
    }

    public RenderFragment RenderUiCase(string domain, string caseName, UiContext context)
    {
        return InvokeUiView(CreateUiCase(domain, caseName, context), domain, caseName);
    }

    public DesignSystemPackage ResolveDesignSystem()
    {
        if (!Registry.Packages.TryGetValue("designSystem", out var designSystem) ||
            designSystem is not DesignSystemPackage typedDesignSystem)
        {
            throw new InvalidOperationException("apps/portal requires packages.designSystem");
        }

        return typedDesignSystem;
    }

    public IAppHttpClient ResolveHttpClient()
    {
        if (!Registry.Providers.TryGetValue("httpClient", out var httpClient) ||
            httpClient is not IAppHttpClient typedHttpClient)
        {
            throw new InvalidOperationException("apps/portal requires providers.httpClient");
        }

        return typedHttpClient;
    }

    private static string FormatMeta(IDictionary<string, object?>? meta)
    {
        return meta is null || meta.Count == 0
            ? string.Empty
            : JsonSerializer.Serialize(meta, JsonOptions);
    }

    private static RenderFragment InvokeUiView(object instance, string domain, string caseName)
    {
        var viewMethod = instance.GetType().GetMethod("View", Type.EmptyTypes);
        if (viewMethod is null)
        {
            throw new InvalidOperationException($"UI surface {domain}.{caseName} does not expose View().");
        }

        var view = viewMethod.Invoke(instance, Array.Empty<object>());
        if (view is not RenderFragment fragment)
        {
            throw new InvalidOperationException($"UI surface {domain}.{caseName} returned an invalid visual unit.");
        }

        return fragment;
    }

    public sealed class PortalRootComponent : ComponentBase
    {
        [Parameter]
        public required PortalRuntime Runtime { get; set; }

        private int _refreshToken;

        private async Task OnTaskCreatedAsync()
        {
            _refreshToken += 1;
            await InvokeAsync(StateHasChanged);
        }

        private async Task OnTaskMovedAsync()
        {
            _refreshToken += 1;
            await InvokeAsync(StateHasChanged);
        }

        private RenderFragment RenderCardActions(object task)
        {
            var moveContext = Runtime.CreateUiContext(new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["task"] = task,
                ["onTaskMoved"] = (Func<Task>)OnTaskMovedAsync,
            });

            return Runtime.RenderUiCase("tasks", "task_move", moveContext);
        }

        protected override void BuildRenderTree(RenderTreeBuilder builder)
        {
            var designSystem = Runtime.ResolveDesignSystem();

            var taskCreateContext = Runtime.CreateUiContext(new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["onTaskCreated"] = (Func<Task>)OnTaskCreatedAsync,
            });
            var taskListContext = Runtime.CreateUiContext(new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["refreshToken"] = _refreshToken,
                ["renderCardActions"] = (Func<object, RenderFragment>)RenderCardActions,
            });

            var taskCreateView = Runtime.RenderUiCase("tasks", "task_create", taskCreateContext);
            var taskListView = Runtime.RenderUiCase("tasks", "task_list", taskListContext);

            builder.AddContent(0, designSystem.AppShell(
                "Task Board",
                ".NET + C# APP example with create, list, and move wired through Cases.",
                contentBuilder =>
                {
                    contentBuilder.AddContent(0, designSystem.BoardHeader(
                        "Board",
                        "Tasks load from the backend and each card can now move across columns."));
                    contentBuilder.AddContent(1, taskCreateView);
                    contentBuilder.AddContent(2, taskListView);
                }));
        }
    }
}

public static class PortalBootstrap
{
    public static PortalRuntime Bootstrap(PortalConfig? config = null, HttpClient? httpClient = null) => new(config, httpClient);
}
