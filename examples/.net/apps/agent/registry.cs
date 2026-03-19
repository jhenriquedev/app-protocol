using AppProtocol.Example.DotNet.Cases.Tasks.TaskCreate;
using AppProtocol.Example.DotNet.Cases.Tasks.TaskList;
using AppProtocol.Example.DotNet.Cases.Tasks.TaskMove;
using AppProtocol.Example.DotNet.Core;
using AppProtocol.Example.DotNet.Core.Shared;
using AppProtocol.Example.DotNet.Packages.Data;

namespace AppProtocol.Example.DotNet.Apps.Agent;

using RawTaskCollection = List<Dictionary<string, object?>>;

public sealed class AgentConfig
{
    public int Port { get; init; } = 3001;
    public string? DataDirectory { get; init; }
}

public sealed class AgentMcpAdapters
{
    public required StdioAppMcpAdapter Stdio { get; init; }
    public required StreamableHttpAppMcpAdapter Http { get; init; }
}

public sealed class AgentRegistry : IAgenticRegistry
{
    public required IDictionary<string, IDictionary<string, AppCaseSurfaces>> Cases { get; init; }
    public required IDictionary<string, object?> Providers { get; init; }
    public required IDictionary<string, object?> Packages { get; init; }

    public IReadOnlyList<AgenticCaseRef> ListAgenticCases()
    {
        return Cases
            .SelectMany(domainEntry => domainEntry.Value
                .Where(caseEntry => caseEntry.Value.Agentic is not null)
                .Select(caseEntry => new AgenticCaseRef(domainEntry.Key, caseEntry.Key)))
            .ToList();
    }

    public Type? GetAgenticSurface(AgenticCaseRef reference)
    {
        return Cases.TryGetValue(reference.Domain, out var domainCases) &&
               domainCases.TryGetValue(reference.CaseName, out var surfaces)
            ? surfaces.Agentic
            : null;
    }

    public BaseAgenticCase InstantiateAgentic(AgenticCaseRef reference, AgenticContext context)
    {
        var agenticSurface = GetAgenticSurface(reference);
        if (agenticSurface is null)
        {
            throw new InvalidOperationException($"Agentic surface not found for {reference.Domain}/{reference.CaseName}.");
        }

        return (BaseAgenticCase)Activator.CreateInstance(agenticSurface, context)!;
    }

    public IReadOnlyList<AgenticCatalogEntry> BuildCatalog(AgenticContext context)
    {
        return ListAgenticCases()
            .Select(reference =>
            {
                var instance = InstantiateAgentic(reference, context);
                var definition = instance.Definition();
                var requiresConfirmation = instance.RequiresConfirmation();
                var entry = new AgenticCatalogEntry
                {
                    Ref = reference,
                    PublishedName = string.Empty,
                    Definition = definition,
                    IsMcpEnabled = instance.IsMcpEnabled(),
                    RequiresConfirmation = requiresConfirmation,
                    ExecutionMode = definition.Policy?.ExecutionMode ??
                                    (requiresConfirmation ? "manual-approval" : "direct-execution"),
                };

                entry.PublishedName = ToPublishedToolName(entry);
                return entry;
            })
            .ToList();
    }

    public AgenticCatalogEntry? ResolveTool(string toolName, AgenticContext context)
    {
        var normalized = toolName.Trim();
        return BuildCatalog(context).FirstOrDefault(entry =>
            string.Equals(entry.PublishedName, normalized, StringComparison.Ordinal) ||
            string.Equals(entry.Definition.Tool.Name, normalized, StringComparison.Ordinal));
    }

    public IReadOnlyList<AgenticCatalogEntry> ListMcpEnabledTools(AgenticContext context)
    {
        return BuildCatalog(context)
            .Where(entry => entry.IsMcpEnabled)
            .ToList();
    }

    private static string ToPublishedToolName(AgenticCatalogEntry entry)
    {
        return entry.IsMcpEnabled
            ? entry.Definition.Mcp?.Name ?? entry.Definition.Tool.Name
            : entry.Definition.Tool.Name;
    }
}

public static class AgentRegistryFactory
{
    public static AgentRegistry Create(AgentConfig? config = null)
    {
        var resolvedConfig = config ?? new AgentConfig();
        var data = DataPackageFactory.Create(resolvedConfig.DataDirectory);
        var taskStore = data.CreateJsonFileStore(data.DefaultFiles.Tasks, new RawTaskCollection());
        var mcpAdapters = new AgentMcpAdapters
        {
            Stdio = new StdioAppMcpAdapter(),
            Http = new StreamableHttpAppMcpAdapter(),
        };

        return new AgentRegistry
        {
            Cases = new Dictionary<string, IDictionary<string, AppCaseSurfaces>>(StringComparer.Ordinal)
            {
                ["tasks"] = new Dictionary<string, AppCaseSurfaces>(StringComparer.Ordinal)
                {
                    ["task_create"] = new() { Api = typeof(TaskCreateApi), Agentic = typeof(TaskCreateAgentic) },
                    ["task_list"] = new() { Api = typeof(TaskListApi), Agentic = typeof(TaskListAgentic) },
                    ["task_move"] = new() { Api = typeof(TaskMoveApi), Agentic = typeof(TaskMoveAgentic) },
                },
            },
            Providers = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["port"] = resolvedConfig.Port,
                ["taskStore"] = taskStore,
                ["mcpAdapters"] = mcpAdapters,
            },
            Packages = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["data"] = data,
            },
        };
    }
}
