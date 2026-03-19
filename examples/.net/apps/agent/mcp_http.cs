using System.Text.Json;
using AppProtocol.Example.DotNet.Core.Shared;

namespace AppProtocol.Example.DotNet.Apps.Agent;

public sealed class StreamableHttpAppMcpAdapter : BaseAppMcpHttpAdapter
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false,
    };

    public override string Transport => "streamable-http";
    public override string EndpointPath => "/mcp";

    public override async Task<AppMcpHttpResponse?> HandleAsync(
        AppMcpHttpExchange exchange,
        IAppMcpServer server,
        CancellationToken cancellationToken = default)
    {
        if (!string.Equals(exchange.Path, EndpointPath, StringComparison.Ordinal))
        {
            return null;
        }

        var method = exchange.Method.ToUpperInvariant();
        if (method is "GET" or "DELETE")
        {
            return new AppMcpHttpResponse
            {
                StatusCode = 405,
                Headers = new Dictionary<string, string>
                {
                    ["allow"] = "POST",
                    ["cache-control"] = "no-store",
                },
            };
        }

        if (!string.Equals(method, "POST", StringComparison.Ordinal))
        {
            return new AppMcpHttpResponse
            {
                StatusCode = 405,
                Headers = new Dictionary<string, string>
                {
                    ["allow"] = "GET,POST,DELETE",
                    ["cache-control"] = "no-store",
                },
            };
        }

        if (string.IsNullOrWhiteSpace(exchange.BodyText))
        {
            return JsonResponse(400, JsonSerializer.Serialize(
                Failure(null, -32600, "Missing JSON-RPC payload."),
                JsonOptions));
        }

        JsonElement payload;
        try
        {
            using var document = JsonDocument.Parse(exchange.BodyText);
            payload = document.RootElement.Clone();
        }
        catch (Exception error)
        {
            return JsonResponse(400, JsonSerializer.Serialize(
                Failure(null, -32700, "Invalid JSON-RPC payload.", error.Message),
                JsonOptions));
        }

        if (payload.ValueKind == JsonValueKind.Array && payload.GetArrayLength() == 0)
        {
            return JsonResponse(400, JsonSerializer.Serialize(
                Failure(null, -32600, "Empty JSON-RPC batch payload is invalid."),
                JsonOptions));
        }

        var messages = payload.ValueKind == JsonValueKind.Array
            ? payload.EnumerateArray().Select(item => item.Clone()).ToList()
            : new List<JsonElement> { payload };

        var responses = new List<object>();
        foreach (var message in messages)
        {
            if (!IsJsonRpcMessage(message))
            {
                responses.Add(Failure(null, -32600, "Invalid JSON-RPC request shape."));
                continue;
            }

            var hasId = message.TryGetProperty("id", out var idProperty);
            if (!hasId)
            {
                HandleNotification(message);
                continue;
            }

            var requestId = NormalizeId(idProperty);
            try
            {
                responses.Add(await HandleRequestAsync(message, requestId, server, cancellationToken));
            }
            catch (AppMcpProtocolError error)
            {
                responses.Add(Failure(requestId, error.Code, error.Message, error.Payload));
            }
            catch (Exception error)
            {
                responses.Add(Failure(
                    requestId,
                    -32603,
                    "Internal MCP server error.",
                    new Dictionary<string, object?>
                    {
                        ["message"] = error.Message,
                    }));
            }
        }

        if (responses.Count == 0)
        {
            return new AppMcpHttpResponse
            {
                StatusCode = 202,
                Headers = new Dictionary<string, string>
                {
                    ["cache-control"] = "no-store",
                },
            };
        }

        var responseBody = JsonSerializer.Serialize(
            responses.Count == 1 ? responses[0] : responses,
            JsonOptions);

        return JsonResponse(200, responseBody);
    }

    private async Task<object> HandleRequestAsync(
        JsonElement message,
        object? requestId,
        IAppMcpServer server,
        CancellationToken cancellationToken)
    {
        var method = message.GetProperty("method").GetString() ?? string.Empty;
        var context = new AppMcpRequestContext
        {
            Transport = Transport,
            RequestId = requestId,
            CorrelationId = Guid.NewGuid().ToString(),
        };

        return method switch
        {
            "initialize" => Success(
                requestId,
                await server.InitializeAsync(ParseInitializeParams(message), context)),
            "ping" => Success(requestId, new Dictionary<string, object?>()),
            "tools/list" => Success(
                requestId,
                new Dictionary<string, object?>
                {
                    ["tools"] = await server.ListToolsAsync(context),
                }),
            "resources/list" => Success(
                requestId,
                new Dictionary<string, object?>
                {
                    ["resources"] = await server.ListResourcesAsync(context),
                }),
            "resources/read" => Success(
                requestId,
                await server.ReadResourceAsync(RequireStringProperty(message, "uri", "MCP resources/read requires a string resource uri."), context)),
            "tools/call" => Success(
                requestId,
                await server.CallToolAsync(
                    RequireStringProperty(message, "name", "MCP tools/call requires a string tool name."),
                    ReadOptionalProperty(message, "arguments"),
                    context)),
            _ => throw new AppMcpProtocolError(-32601, $"MCP method {method} is not implemented by this server."),
        };
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

    private static bool IsJsonRpcMessage(JsonElement message)
    {
        return message.ValueKind == JsonValueKind.Object &&
               message.TryGetProperty("jsonrpc", out var jsonrpcProperty) &&
               jsonrpcProperty.ValueKind == JsonValueKind.String &&
               string.Equals(jsonrpcProperty.GetString(), "2.0", StringComparison.Ordinal) &&
               message.TryGetProperty("method", out var methodProperty) &&
               methodProperty.ValueKind == JsonValueKind.String;
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

    private static void HandleNotification(JsonElement notification)
    {
        if (!notification.TryGetProperty("method", out _))
        {
            return;
        }
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

    private static AppMcpHttpResponse JsonResponse(int statusCode, string bodyText)
    {
        return new AppMcpHttpResponse
        {
            StatusCode = statusCode,
            Headers = new Dictionary<string, string>
            {
                ["cache-control"] = "no-store",
                ["content-type"] = "application/json; charset=utf-8",
            },
            BodyText = bodyText,
        };
    }
}
