using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AppProtocol.Example.DotNet.Cases.Tasks.TaskCreate;
using AppProtocol.Example.DotNet.Cases.Tasks.TaskList;
using AppProtocol.Example.DotNet.Cases.Tasks.TaskMove;
using AppProtocol.Example.DotNet.Core.Shared;
using AppProtocol.Example.DotNet.Packages.DesignSystem;

namespace AppProtocol.Example.DotNet.Apps.Portal;

public sealed class PortalConfig
{
    public int Port { get; init; } = 3002;
    public string ApiBaseUrl { get; init; } = "http://localhost:3000";
}

public sealed class PortalRegistry : IAppRegistry
{
    public required IDictionary<string, IDictionary<string, AppCaseSurfaces>> Cases { get; init; }
    public required IDictionary<string, object?> Providers { get; init; }
    public required IDictionary<string, object?> Packages { get; init; }
}

public static class PortalRegistryFactory
{
    public static PortalRegistry Create(PortalConfig? config = null, HttpClient? httpClient = null)
    {
        var resolvedConfig = config ?? new PortalConfig();
        var resolvedHttpClient = httpClient ?? new HttpClient
        {
            BaseAddress = new Uri(EnsureTrailingSlash(resolvedConfig.ApiBaseUrl)),
        };

        return new PortalRegistry
        {
            Cases = new Dictionary<string, IDictionary<string, AppCaseSurfaces>>(StringComparer.Ordinal)
            {
                ["tasks"] = new Dictionary<string, AppCaseSurfaces>(StringComparer.Ordinal)
                {
                    ["task_create"] = new() { Ui = typeof(TaskCreateUi) },
                    ["task_list"] = new() { Ui = typeof(TaskListUi) },
                    ["task_move"] = new() { Ui = typeof(TaskMoveUi) },
                },
            },
            Providers = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["port"] = resolvedConfig.Port,
                ["httpClient"] = new PortalHttpAdapter(resolvedHttpClient),
            },
            Packages = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["designSystem"] = new DesignSystemPackage(),
            },
        };
    }

    private static string EnsureTrailingSlash(string baseUrl)
    {
        return baseUrl.EndsWith("/", StringComparison.Ordinal) ? baseUrl : $"{baseUrl}/";
    }
}

internal sealed class PortalHttpAdapter : IAppHttpClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    private readonly HttpClient _httpClient;

    public PortalHttpAdapter(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<object?> RequestAsync(AppHttpRequest request, CancellationToken cancellationToken = default)
    {
        using var message = new HttpRequestMessage(new HttpMethod(request.Method), request.Url);
        if (request.Body is not null)
        {
            message.Content = JsonContent.Create(request.Body, options: JsonOptions);
        }

        using var response = await _httpClient.SendAsync(message, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NoContent)
        {
            return null;
        }

        if (response.Content.Headers.ContentLength is 0)
        {
            return null;
        }

        using var document = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(cancellationToken),
            cancellationToken: cancellationToken);

        var payload = document.RootElement.Clone();
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                ExtractErrorMessage(payload) ??
                $"HTTP {(int)response.StatusCode} while requesting {request.Url}");
        }

        if (payload.ValueKind == JsonValueKind.Object &&
            payload.TryGetProperty("success", out var successProperty) &&
            successProperty.ValueKind is JsonValueKind.True or JsonValueKind.False)
        {
            if (!successProperty.GetBoolean())
            {
                throw new InvalidOperationException(ExtractErrorMessage(payload) ?? "Request failed");
            }

            if (payload.TryGetProperty("data", out var dataProperty))
            {
                return dataProperty.Clone();
            }

            return null;
        }

        return payload;
    }

    private static string? ExtractErrorMessage(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (payload.TryGetProperty("error", out var errorProperty) &&
            errorProperty.ValueKind == JsonValueKind.Object &&
            errorProperty.TryGetProperty("message", out var messageProperty) &&
            messageProperty.ValueKind == JsonValueKind.String)
        {
            return messageProperty.GetString();
        }

        if (payload.TryGetProperty("message", out var rootMessageProperty) &&
            rootMessageProperty.ValueKind == JsonValueKind.String)
        {
            return rootMessageProperty.GetString();
        }

        return null;
    }
}
