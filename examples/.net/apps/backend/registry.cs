using AppProtocol.Example.DotNet.Cases.Tasks.TaskCreate;
using AppProtocol.Example.DotNet.Cases.Tasks.TaskList;
using AppProtocol.Example.DotNet.Cases.Tasks.TaskMove;
using AppProtocol.Example.DotNet.Core.Shared;
using AppProtocol.Example.DotNet.Packages.Data;

namespace AppProtocol.Example.DotNet.Apps.Backend;

using RawTaskCollection = List<Dictionary<string, object?>>;

public sealed class BackendConfig
{
    public int Port { get; init; } = 3000;
    public string? DataDirectory { get; init; }
}

public sealed class BackendRegistry : IAppRegistry
{
    public required IDictionary<string, IDictionary<string, AppCaseSurfaces>> Cases { get; init; }
    public required IDictionary<string, object?> Providers { get; init; }
    public required IDictionary<string, object?> Packages { get; init; }
}

public static class BackendRegistryFactory
{
    public static BackendRegistry Create(BackendConfig? config = null)
    {
        var resolvedConfig = config ?? new BackendConfig();
        var data = DataPackageFactory.Create(resolvedConfig.DataDirectory);
        var taskStore = data.CreateJsonFileStore(data.DefaultFiles.Tasks, new RawTaskCollection());

        return new BackendRegistry
        {
            Cases = new Dictionary<string, IDictionary<string, AppCaseSurfaces>>
            {
                ["tasks"] = new Dictionary<string, AppCaseSurfaces>
                {
                    ["task_create"] = new() { Api = typeof(TaskCreateApi) },
                    ["task_list"] = new() { Api = typeof(TaskListApi) },
                    ["task_move"] = new() { Api = typeof(TaskMoveApi) },
                },
            },
            Providers = new Dictionary<string, object?>
            {
                ["port"] = resolvedConfig.Port,
                ["taskStore"] = taskStore,
            },
            Packages = new Dictionary<string, object?>
            {
                ["data"] = data,
            },
        };
    }
}
