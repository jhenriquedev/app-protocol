using System.Text.Json;
using AppProtocol.Example.DotNet.Core.Shared;

namespace AppProtocol.Example.DotNet.Core;

public sealed class AgenticContext : AppBaseContext
{
    public IDictionary<string, IDictionary<string, IDictionary<string, object>>>? Cases { get; set; }
    public IDictionary<string, object?>? Packages { get; init; }
    public object? Mcp { get; init; }
    public IDictionary<string, object?>? Extra { get; init; }
}

public sealed class AgenticDiscovery
{
    public required string Name { get; init; }
    public required string Description { get; init; }
    public string? Category { get; init; }
    public IReadOnlyList<string>? Tags { get; init; }
    public IReadOnlyList<string>? Aliases { get; init; }
    public IReadOnlyList<string>? Capabilities { get; init; }
    public IReadOnlyList<string>? Intents { get; init; }
}

public sealed class AgenticExecutionContext
{
    public bool? RequiresAuth { get; init; }
    public bool? RequiresTenant { get; init; }
    public IReadOnlyList<string>? Dependencies { get; init; }
    public IReadOnlyList<string>? Preconditions { get; init; }
    public IReadOnlyList<string>? Constraints { get; init; }
    public IReadOnlyList<string>? Notes { get; init; }
}

public sealed class AgenticPrompt
{
    public required string Purpose { get; init; }
    public IReadOnlyList<string>? WhenToUse { get; init; }
    public IReadOnlyList<string>? WhenNotToUse { get; init; }
    public IReadOnlyList<string>? Constraints { get; init; }
    public IReadOnlyList<string>? ReasoningHints { get; init; }
    public string? ExpectedOutcome { get; init; }
}

public sealed class AgenticToolContract
{
    public required string Name { get; init; }
    public required string Description { get; init; }
    public required AppSchema InputSchema { get; init; }
    public required AppSchema OutputSchema { get; init; }
    public bool? IsMutating { get; init; }
    public bool? RequiresConfirmation { get; init; }
    public required Func<object?, AgenticContext, Task<object?>> ExecuteAsync { get; init; }
}

public sealed class AgenticMcpContract
{
    public bool? Enabled { get; init; }
    public string? Name { get; init; }
    public string? Title { get; init; }
    public string? Description { get; init; }
    public IDictionary<string, object?>? Metadata { get; init; }
}

public sealed class AgenticKnowledgeResource
{
    public required string Kind { get; init; }
    public required string Ref { get; init; }
    public string? Description { get; init; }
}

public sealed class AgenticRagContract
{
    public IReadOnlyList<string>? Topics { get; init; }
    public IReadOnlyList<AgenticKnowledgeResource>? Resources { get; init; }
    public IReadOnlyList<string>? Hints { get; init; }
    public string? Scope { get; init; }
    public string? Mode { get; init; }
}

public sealed class AgenticPolicy
{
    public bool? RequireConfirmation { get; init; }
    public string? RiskLevel { get; init; }
    public string? ExecutionMode { get; init; }
    public IReadOnlyList<string>? Limits { get; init; }
}

public sealed class AgenticExample
{
    public required string Name { get; init; }
    public string? Description { get; init; }
    public required object? Input { get; init; }
    public object? Output { get; init; }
    public IReadOnlyList<string>? Notes { get; init; }
}

public sealed class AgenticDefinition
{
    public required AgenticDiscovery Discovery { get; init; }
    public required AgenticExecutionContext Context { get; init; }
    public required AgenticPrompt Prompt { get; init; }
    public required AgenticToolContract Tool { get; init; }
    public AgenticMcpContract? Mcp { get; init; }
    public AgenticRagContract? Rag { get; init; }
    public AgenticPolicy? Policy { get; init; }
    public IReadOnlyList<AgenticExample>? Examples { get; init; }
}

public abstract class BaseAgenticCase
{
    protected BaseAgenticCase(AgenticContext context)
    {
        Ctx = context;
    }

    protected AgenticContext Ctx { get; }

    public abstract AgenticDefinition Definition();
    public virtual Task TestAsync() => Task.CompletedTask;

    public bool IsMcpEnabled()
    {
        var definition = Definition();
        return definition.Mcp?.Enabled ?? definition.Mcp is not null;
    }

    public bool RequiresConfirmation()
    {
        var definition = Definition();
        return definition.Tool.RequiresConfirmation
            ?? definition.Policy?.RequireConfirmation
            ?? false;
    }

    public void ValidateDefinition()
    {
        var definition = Definition();
        if (string.IsNullOrWhiteSpace(definition.Discovery.Name))
        {
            throw new InvalidOperationException("agentic.discovery.name is required");
        }

        if (string.IsNullOrWhiteSpace(definition.Prompt.Purpose))
        {
            throw new InvalidOperationException("agentic.prompt.purpose is required");
        }

        if (string.IsNullOrWhiteSpace(definition.Tool.Name))
        {
            throw new InvalidOperationException("agentic.tool.name is required");
        }
    }
}

public abstract class BaseAgenticCase<TInput, TOutput> : BaseAgenticCase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    protected BaseAgenticCase(AgenticContext context)
        : base(context)
    {
    }

    protected abstract BaseDomainCase<TInput, TOutput> Domain();
    public abstract AgenticDiscovery Discovery();
    public abstract AgenticExecutionContext Context();
    public abstract AgenticPrompt Prompt();
    public abstract AgenticToolContract Tool();
    public virtual AgenticMcpContract? Mcp() => null;
    public virtual AgenticRagContract? Rag() => null;
    public virtual AgenticPolicy? Policy() => null;

    public virtual IReadOnlyList<AgenticExample>? Examples()
    {
        return Domain()
            .Examples()?
            .Where(example => example.Output is not null)
            .Select(example => new AgenticExample
            {
                Name = example.Name,
                Description = example.Description,
                Input = example.Input,
                Output = example.Output,
                Notes = example.Notes,
            })
            .ToList();
    }

    public override AgenticDefinition Definition() => new()
    {
        Discovery = Discovery(),
        Context = Context(),
        Prompt = Prompt(),
        Tool = Tool(),
        Mcp = Mcp(),
        Rag = Rag(),
        Policy = Policy(),
        Examples = Examples(),
    };

    protected string? DomainCaseName() => Domain().Definition().CaseName;
    protected string? DomainDescription() => Domain().Definition().Description;
    protected AppSchema? DomainInputSchema() => Domain().Definition().InputSchema;
    protected AppSchema? DomainOutputSchema() => Domain().Definition().OutputSchema;

    protected static TMaterialized Materialize<TMaterialized>(object? value)
    {
        if (value is TMaterialized typed)
        {
            return typed;
        }

        var json = JsonSerializer.Serialize(value, JsonOptions);
        var materialized = JsonSerializer.Deserialize<TMaterialized>(json, JsonOptions);
        if (materialized is null)
        {
            throw new AppCaseError("INVALID_REQUEST", $"Failed to materialize {typeof(TMaterialized).Name}.");
        }

        return materialized;
    }
}
