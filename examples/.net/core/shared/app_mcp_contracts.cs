namespace AppProtocol.Example.DotNet.Core.Shared;

public sealed record AppMcpClientInfo(string Name, string Version);

public sealed record AppMcpServerInfo(
    string Name,
    string Version,
    string ProtocolVersion,
    string? Instructions = null);

public sealed class AppMcpInitializeParams
{
    public required string ProtocolVersion { get; init; }
    public IDictionary<string, object?>? Capabilities { get; init; }
    public AppMcpClientInfo? ClientInfo { get; init; }
}

public sealed class AppMcpInitializeResult
{
    public required string ProtocolVersion { get; init; }
    public required IDictionary<string, object?> Capabilities { get; init; }
    public required IDictionary<string, object?> ServerInfo { get; init; }
    public string? Instructions { get; init; }
}

public sealed record AppMcpTextContent(string Type, string Text);

public sealed class AppMcpToolDescriptor
{
    public required string Name { get; init; }
    public string? Title { get; init; }
    public string? Description { get; init; }
    public required AppSchema InputSchema { get; init; }
    public AppSchema? OutputSchema { get; init; }
    public IDictionary<string, object?>? Annotations { get; init; }
}

public sealed class AppMcpResourceDescriptor
{
    public required string Uri { get; init; }
    public required string Name { get; init; }
    public string? Title { get; init; }
    public string? Description { get; init; }
    public string? MimeType { get; init; }
    public IDictionary<string, object?>? Annotations { get; init; }
}

public sealed class AppMcpTextResourceContent
{
    public required string Uri { get; init; }
    public string? MimeType { get; init; }
    public required string Text { get; init; }
}

public sealed class AppMcpCallResult
{
    public required IReadOnlyList<AppMcpTextContent> Content { get; init; }
    public object? StructuredContent { get; init; }
    public bool? IsError { get; init; }
}

public sealed class AppMcpReadResourceResult
{
    public required IReadOnlyList<AppMcpTextResourceContent> Contents { get; init; }
}

public sealed class AppMcpRequestContext
{
    public required string Transport { get; init; }
    public object? RequestId { get; init; }
    public string? SessionId { get; init; }
    public string? CorrelationId { get; init; }
    public AppMcpClientInfo? ClientInfo { get; init; }
    public string? ProtocolVersion { get; init; }
}

public interface IAppMcpServer
{
    AppMcpServerInfo ServerInfo();
    Task<AppMcpInitializeResult> InitializeAsync(AppMcpInitializeParams? parameters = null, AppMcpRequestContext? parent = null);
    Task<IReadOnlyList<AppMcpToolDescriptor>> ListToolsAsync(AppMcpRequestContext? parent = null);
    Task<IReadOnlyList<AppMcpResourceDescriptor>> ListResourcesAsync(AppMcpRequestContext? parent = null);
    Task<AppMcpReadResourceResult> ReadResourceAsync(string uri, AppMcpRequestContext? parent = null);
    Task<AppMcpCallResult> CallToolAsync(string name, object? arguments = null, AppMcpRequestContext? parent = null);
}

public abstract class BaseAppMcpAdapter
{
    public abstract string Transport { get; }
}

public abstract class BaseAppMcpProcessAdapter : BaseAppMcpAdapter
{
    public abstract Task ServeAsync(IAppMcpServer server, CancellationToken cancellationToken = default);
}

public sealed class AppMcpHttpExchange
{
    public required string Method { get; init; }
    public required string Path { get; init; }
    public required IDictionary<string, string?> Headers { get; init; }
    public string? BodyText { get; init; }
}

public sealed class AppMcpHttpResponse
{
    public required int StatusCode { get; init; }
    public IDictionary<string, string>? Headers { get; init; }
    public string? BodyText { get; init; }
}

public abstract class BaseAppMcpHttpAdapter : BaseAppMcpAdapter
{
    public abstract string EndpointPath { get; }

    public abstract Task<AppMcpHttpResponse?> HandleAsync(
        AppMcpHttpExchange exchange,
        IAppMcpServer server,
        CancellationToken cancellationToken = default);
}

public sealed class AppMcpProtocolError : Exception
{
    public AppMcpProtocolError(int code, string message, object? payload = null)
        : base(message)
    {
        Code = code;
        Payload = payload;
    }

    public int Code { get; }
    public object? Payload { get; }
}
