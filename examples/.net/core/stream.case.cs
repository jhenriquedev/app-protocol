using AppProtocol.Example.DotNet.Core.Shared;

namespace AppProtocol.Example.DotNet.Core;

public sealed class StreamContext : AppBaseContext
{
    public object? EventBus { get; init; }
    public object? Queue { get; init; }
    public IAppEventPublisher? Publisher { get; init; }
    public IDictionary<string, IDictionary<string, IDictionary<string, object>>>? Cases { get; set; }
    public IDictionary<string, object?>? Packages { get; init; }
    public IDictionary<string, object?>? Extra { get; init; }
}

public abstract class BaseStreamCase<TEvent>
{
    protected BaseStreamCase(StreamContext context)
    {
        Ctx = context;
    }

    protected StreamContext Ctx { get; }

    public abstract Task<AppResult<object?>> HandlerAsync(TEvent @event);

    public virtual object? Subscribe() => null;

    public virtual object? RecoveryPolicy() => null;

    public virtual Task TestAsync() => Task.CompletedTask;
}
