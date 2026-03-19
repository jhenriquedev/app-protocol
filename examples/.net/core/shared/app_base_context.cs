using System.Collections.Generic;

namespace AppProtocol.Example.DotNet.Core.Shared;

public interface IAppLogger
{
    void Debug(string message, IDictionary<string, object?>? meta = null);
    void Info(string message, IDictionary<string, object?>? meta = null);
    void Warn(string message, IDictionary<string, object?>? meta = null);
    void Error(string message, IDictionary<string, object?>? meta = null);
}

public sealed class DelegateAppLogger : IAppLogger
{
    private readonly Action<string, IDictionary<string, object?>?> _debug;
    private readonly Action<string, IDictionary<string, object?>?> _info;
    private readonly Action<string, IDictionary<string, object?>?> _warn;
    private readonly Action<string, IDictionary<string, object?>?> _error;

    public DelegateAppLogger(
        Action<string, IDictionary<string, object?>?> debug,
        Action<string, IDictionary<string, object?>?> info,
        Action<string, IDictionary<string, object?>?> warn,
        Action<string, IDictionary<string, object?>?> error)
    {
        _debug = debug;
        _info = info;
        _warn = warn;
        _error = error;
    }

    public void Debug(string message, IDictionary<string, object?>? meta = null) => _debug(message, meta);
    public void Info(string message, IDictionary<string, object?>? meta = null) => _info(message, meta);
    public void Warn(string message, IDictionary<string, object?>? meta = null) => _warn(message, meta);
    public void Error(string message, IDictionary<string, object?>? meta = null) => _error(message, meta);
}

public abstract class AppBaseContext
{
    public required string CorrelationId { get; init; }
    public string? ExecutionId { get; init; }
    public string? TenantId { get; init; }
    public string? UserId { get; init; }
    public required IAppLogger Logger { get; init; }
    public IDictionary<string, object?>? Config { get; init; }
}
