using System.Text.Json;
using AppProtocol.Example.DotNet.Core.Shared;

namespace AppProtocol.Example.DotNet.Apps.Agent;

public sealed class StdioAppMcpAdapter : BaseAppMcpProcessAdapter
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false,
    };

    public override string Transport => "stdio";

    public override async Task ServeAsync(IAppMcpServer server, CancellationToken cancellationToken = default)
    {
        var sessionId = Guid.NewGuid().ToString();
        var phase = SessionPhase.AwaitingInitialize;
        string? protocolVersion = null;
        AppMcpClientInfo? clientInfo = null;

        while (!cancellationToken.IsCancellationRequested)
        {
            var line = await Console.In.ReadLineAsync(cancellationToken);
            if (line is null)
            {
                break;
            }

            var trimmed = line.Trim();
            if (trimmed.Length == 0)
            {
                continue;
            }

            JsonElement parsed;
            try
            {
                using var document = JsonDocument.Parse(trimmed);
                parsed = document.RootElement.Clone();
            }
            catch (Exception error)
            {
                await WriteMessageAsync(Failure(null, -32700, "Invalid JSON-RPC payload.", error.Message));
                continue;
            }

            if (parsed.ValueKind == JsonValueKind.Array)
            {
                await WriteMessageAsync(Failure(
                    null,
                    -32600,
                    "MCP stdio transport does not accept JSON-RPC batch payloads."));
                continue;
            }

            if (!IsJsonRpcMessage(parsed))
            {
                await WriteMessageAsync(Failure(
                    null,
                    -32600,
                    "Invalid JSON-RPC request shape for MCP stdio transport."));
                continue;
            }

            var hasId = parsed.TryGetProperty("id", out var idProperty);
            if (!hasId)
            {
                var method = parsed.GetProperty("method").GetString();
                if (string.Equals(method, "notifications/initialized", StringComparison.Ordinal) &&
                    phase == SessionPhase.AwaitingInitializedNotification)
                {
                    phase = SessionPhase.Ready;
                }

                continue;
            }

            var requestId = NormalizeId(idProperty);
            try
            {
                var response = await HandleRequestAsync(parsed, requestId);
                await WriteMessageAsync(response);
            }
            catch (AppMcpProtocolError error)
            {
                await WriteMessageAsync(Failure(requestId, error.Code, error.Message, error.Payload));
            }
            catch (Exception error)
            {
                await Console.Error.WriteLineAsync($"[agent:mcp] unhandled request error: {error.Message}");
                await WriteMessageAsync(Failure(
                    requestId,
                    -32603,
                    "Internal MCP server error.",
                    new Dictionary<string, object?>
                    {
                        ["message"] = error.Message,
                    }));
            }
        }

        async Task<object> HandleRequestAsync(JsonElement message, object? requestId)
        {
            var method = message.GetProperty("method").GetString() ?? string.Empty;
            var context = new AppMcpRequestContext
            {
                Transport = Transport,
                RequestId = requestId,
                SessionId = sessionId,
                CorrelationId = Guid.NewGuid().ToString(),
                ClientInfo = clientInfo,
                ProtocolVersion = protocolVersion,
            };

            switch (method)
            {
                case "initialize":
                    if (phase != SessionPhase.AwaitingInitialize)
                    {
                        throw new AppMcpProtocolError(-32600, "MCP initialize may only run once per stdio session.");
                    }

                    var initializeParams = ParseInitializeParams(message);
                    var initializeResult = await server.InitializeAsync(initializeParams, context);
                    protocolVersion = initializeResult.ProtocolVersion;
                    clientInfo = initializeParams?.ClientInfo;
                    phase = SessionPhase.AwaitingInitializedNotification;
                    return Success(requestId, initializeResult);

                case "ping":
                    EnsureReady(phase);
                    return Success(requestId, new Dictionary<string, object?>());

                case "tools/list":
                    EnsureReady(phase);
                    return Success(requestId, new Dictionary<string, object?>
                    {
                        ["tools"] = await server.ListToolsAsync(context),
                    });

                case "resources/list":
                    EnsureReady(phase);
                    return Success(requestId, new Dictionary<string, object?>
                    {
                        ["resources"] = await server.ListResourcesAsync(context),
                    });

                case "resources/read":
                    EnsureReady(phase);
                    return Success(requestId, await server.ReadResourceAsync(
                        RequireStringProperty(message, "uri", "MCP resources/read requires a string resource uri."),
                        context));

                case "tools/call":
                    EnsureReady(phase);
                    return Success(requestId, await server.CallToolAsync(
                        RequireStringProperty(message, "name", "MCP tools/call requires a string tool name."),
                        ReadOptionalProperty(message, "arguments"),
                        context));

                default:
                    throw new AppMcpProtocolError(-32601, $"MCP method {method} is not implemented by this server.");
            }
        }
    }

    private static void EnsureReady(SessionPhase phase)
    {
        if (phase != SessionPhase.Ready)
        {
            throw new AppMcpProtocolError(-32002, "MCP session is not ready; complete initialization first.");
        }
    }

    private static bool IsJsonRpcMessage(JsonElement message)
    {
        return message.ValueKind == JsonValueKind.Object &&
               message.TryGetProperty("jsonrpc", out var jsonrpcProperty) &&
               jsonrpcProperty.ValueKind == JsonValueKind.String &&
               string.Equals(jsonrpcProperty.GetString(), "2.0", StringComparison.Ordinal) &&
               message.TryGetProperty("method", out var methodProperty) &&
               methodProperty.ValueKind == JsonValueKind.String;
    }

    private static AppMcpInitializeParams? ParseInitializeParams(JsonElement message)
    {
        if (!message.TryGetProperty("params", out var paramsProperty) ||
            paramsProperty.ValueKind != JsonValueKind.Object ||
            !paramsProperty.TryGetProperty("protocolVersion", out var protocolVersionProperty) ||
            protocolVersionProperty.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        return JsonSerializer.Deserialize<AppMcpInitializeParams>(paramsProperty.GetRawText(), JsonOptions);
    }

    private static string RequireStringProperty(JsonElement message, string propertyName, string errorMessage)
    {
        if (!message.TryGetProperty("params", out var paramsProperty) ||
            paramsProperty.ValueKind != JsonValueKind.Object ||
            !paramsProperty.TryGetProperty(propertyName, out var value) ||
            value.ValueKind != JsonValueKind.String)
        {
            throw new AppMcpProtocolError(-32602, errorMessage);
        }

        return value.GetString() ?? throw new AppMcpProtocolError(-32602, errorMessage);
    }

    private static object? ReadOptionalProperty(JsonElement message, string propertyName)
    {
        if (!message.TryGetProperty("params", out var paramsProperty) ||
            paramsProperty.ValueKind != JsonValueKind.Object ||
            !paramsProperty.TryGetProperty(propertyName, out var value))
        {
            return null;
        }

        return value.Clone();
    }

    private static object? NormalizeId(JsonElement idProperty)
    {
        return idProperty.ValueKind switch
        {
            JsonValueKind.String => idProperty.GetString(),
            JsonValueKind.Number when idProperty.TryGetInt64(out var longValue) => longValue,
            JsonValueKind.Null => null,
            _ => null,
        };
    }

    private static object Success(object? id, object result)
    {
        return new Dictionary<string, object?>
        {
            ["jsonrpc"] = "2.0",
            ["id"] = id,
            ["result"] = result,
        };
    }

    private static object Failure(object? id, int code, string message, object? data = null)
    {
        return new Dictionary<string, object?>
        {
            ["jsonrpc"] = "2.0",
            ["id"] = id,
            ["error"] = new Dictionary<string, object?>
            {
                ["code"] = code,
                ["message"] = message,
                ["data"] = data,
            },
        };
    }

    private static async Task WriteMessageAsync(object message)
    {
        await Console.Out.WriteLineAsync(JsonSerializer.Serialize(message, JsonOptions));
        await Console.Out.FlushAsync();
    }

    private enum SessionPhase
    {
        AwaitingInitialize,
        AwaitingInitializedNotification,
        Ready,
    }
}
