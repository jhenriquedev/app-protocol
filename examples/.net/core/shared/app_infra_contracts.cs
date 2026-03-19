using System.Threading;
using System.Threading.Tasks;

namespace AppProtocol.Example.DotNet.Core.Shared;

public sealed record AppHttpRequest(
    string Method,
    string Url,
    object? Body = null);

public interface IAppHttpClient
{
    Task<object?> RequestAsync(AppHttpRequest request, CancellationToken cancellationToken = default);
}

public interface IAppStorageClient
{
    Task<object?> GetAsync(string key, CancellationToken cancellationToken = default);
    Task SetAsync(string key, object? value, CancellationToken cancellationToken = default);
}

public interface IAppCache
{
    Task<object?> GetAsync(string key, CancellationToken cancellationToken = default);
    Task SetAsync(string key, object? value, int? ttlSeconds = null, CancellationToken cancellationToken = default);
}

public interface IAppEventPublisher
{
    Task PublishAsync(string @event, object? payload, CancellationToken cancellationToken = default);
}
