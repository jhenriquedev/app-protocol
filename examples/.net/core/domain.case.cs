using System.Text.Json.Serialization;

namespace AppProtocol.Example.DotNet.Core;

public sealed class AppSchema
{
    [JsonPropertyName("type")]
    public required string Type { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("properties")]
    public IDictionary<string, AppSchema>? Properties { get; init; }

    [JsonPropertyName("items")]
    public AppSchema? Items { get; init; }

    [JsonPropertyName("required")]
    public IReadOnlyList<string>? Required { get; init; }

    [JsonPropertyName("enum")]
    public IReadOnlyList<string>? Enum { get; init; }

    [JsonPropertyName("additionalProperties")]
    public bool? AdditionalProperties { get; init; }
}

public sealed class DomainExample<TInput, TOutput>
{
    public required string Name { get; init; }
    public string? Description { get; init; }
    public required TInput Input { get; init; }
    public TOutput? Output { get; init; }
    public IReadOnlyList<string>? Notes { get; init; }
}

public sealed class DomainDefinition<TInput, TOutput>
{
    public required string CaseName { get; init; }
    public required string Description { get; init; }
    public required AppSchema InputSchema { get; init; }
    public required AppSchema OutputSchema { get; init; }
    public IReadOnlyList<string>? Invariants { get; init; }
    public IReadOnlyList<DomainExample<TInput, TOutput>>? Examples { get; init; }
}

public abstract class ValueObject<TProps>
{
    protected ValueObject(TProps props)
    {
        Props = props;
    }

    protected TProps Props { get; }

    public TProps ToJson() => Props;

    public bool Equals(ValueObject<TProps>? other)
    {
        return other is not null && EqualityComparer<TProps>.Default.Equals(Props, other.Props);
    }
}

public abstract class BaseDomainCase<TInput, TOutput>
{
    public abstract string CaseName();
    public abstract string Description();
    public abstract AppSchema InputSchema();
    public abstract AppSchema OutputSchema();

    public virtual void Validate(TInput input)
    {
    }

    public virtual IReadOnlyList<string>? Invariants() => null;

    public virtual IDictionary<string, object?>? ValueObjects() => null;

    public virtual IDictionary<string, object?>? Enums() => null;

    public virtual IReadOnlyList<DomainExample<TInput, TOutput>>? Examples() => null;

    public DomainDefinition<TInput, TOutput> Definition() => new()
    {
        CaseName = CaseName(),
        Description = Description(),
        InputSchema = InputSchema(),
        OutputSchema = OutputSchema(),
        Invariants = Invariants(),
        Examples = Examples(),
    };

    public virtual Task TestAsync() => Task.CompletedTask;
}
