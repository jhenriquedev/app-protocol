using System.Text.Json;
using AppProtocol.Example.DotNet.Core.Shared;
using Microsoft.AspNetCore.Components;

namespace AppProtocol.Example.DotNet.Core;

public sealed class UiContext : AppBaseContext
{
    public object? Renderer { get; init; }
    public object? Router { get; init; }
    public object? Store { get; init; }
    public IAppHttpClient? Api { get; init; }
    public IDictionary<string, object?>? Packages { get; init; }
    public IDictionary<string, object?>? Extra { get; init; }
}

public abstract class BaseUiCase<TState>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    protected BaseUiCase(UiContext context, TState initialState)
    {
        Ctx = context;
        State = initialState;
    }

    protected UiContext Ctx { get; }
    protected TState State { get; private set; }

    public abstract RenderFragment View();

    public virtual Task TestAsync() => Task.CompletedTask;

    protected void SetState(TState nextState)
    {
        State = nextState;
    }

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
            throw new InvalidOperationException($"Failed to materialize {typeof(TMaterialized).Name}.");
        }

        return materialized;
    }
}
