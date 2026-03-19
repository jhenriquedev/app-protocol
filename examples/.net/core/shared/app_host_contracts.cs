using AppProtocol.Example.DotNet.Core;

namespace AppProtocol.Example.DotNet.Core.Shared;

public sealed class AppCaseSurfaces
{
    public Type? Domain { get; init; }
    public Type? Api { get; init; }
    public Type? Ui { get; init; }
    public Type? Stream { get; init; }
    public Type? Agentic { get; init; }
}

public interface IAppRegistry
{
    IDictionary<string, IDictionary<string, AppCaseSurfaces>> Cases { get; }
    IDictionary<string, object?> Providers { get; }
    IDictionary<string, object?> Packages { get; }
}

public sealed record AgenticCaseRef(string Domain, string CaseName);

public sealed class AgenticCatalogEntry
{
    public required AgenticCaseRef Ref { get; init; }
    public required string PublishedName { get; set; }
    public required AgenticDefinition Definition { get; init; }
    public required bool IsMcpEnabled { get; init; }
    public required bool RequiresConfirmation { get; init; }
    public required string ExecutionMode { get; init; }
}

public interface IAgenticRegistry : IAppRegistry
{
    IReadOnlyList<AgenticCaseRef> ListAgenticCases();
    Type? GetAgenticSurface(AgenticCaseRef reference);
    BaseAgenticCase InstantiateAgentic(AgenticCaseRef reference, AgenticContext context);
    IReadOnlyList<AgenticCatalogEntry> BuildCatalog(AgenticContext context);
    AgenticCatalogEntry? ResolveTool(string toolName, AgenticContext context);
    IReadOnlyList<AgenticCatalogEntry> ListMcpEnabledTools(AgenticContext context);
}
