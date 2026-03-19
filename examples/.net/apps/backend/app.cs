using System.Reflection;
using System.Net;
using System.Text.Json;
using AppProtocol.Example.DotNet.Core;
using AppProtocol.Example.DotNet.Core.Shared;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;

namespace AppProtocol.Example.DotNet.Apps.Backend;

public sealed class BackendRuntime
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    private readonly BackendConfig _config;
    private readonly DelegateAppLogger _logger;

    public BackendRuntime(BackendConfig? config = null)
    {
        _config = config ?? new BackendConfig();
        Registry = BackendRegistryFactory.Create(_config);
        _logger = new DelegateAppLogger(
            (message, meta) => Console.WriteLine($"[backend] {message} {FormatMeta(meta)}"),
            (message, meta) => Console.WriteLine($"[backend] {message} {FormatMeta(meta)}"),
            (message, meta) => Console.WriteLine($"[backend] {message} {FormatMeta(meta)}"),
            (message, meta) => Console.Error.WriteLine($"[backend] {message} {FormatMeta(meta)}"));
    }

    public BackendRegistry Registry { get; }

    public ApiContext CreateApiContext(ParentExecutionContext? parent = null)
    {
        var context = new ApiContext
        {
            CorrelationId = parent?.CorrelationId ?? Guid.NewGuid().ToString(),
            ExecutionId = Guid.NewGuid().ToString(),
            TenantId = parent?.TenantId,
            UserId = parent?.UserId,
            Config = parent?.Config,
            Logger = _logger,
            Packages = Registry.Packages,
            Extra = new Dictionary<string, object?>
            {
                ["providers"] = Registry.Providers,
            },
        };

        context.Cases = MaterializeCases(context);
        return context;
    }

    public async Task<WebApplication> StartBackendAsync(CancellationToken cancellationToken = default)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = Array.Empty<string>(),
            ApplicationName = typeof(BackendRuntime).Assembly.FullName,
            ContentRootPath = Directory.GetCurrentDirectory(),
        });

        builder.Services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            options.SerializerOptions.WriteIndented = true;
        });

        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
                policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
        });

        builder.WebHost.ConfigureKestrel(options =>
        {
            if (_config.Port == 0)
            {
                options.Listen(IPAddress.Loopback, 0);
                return;
            }

            options.ListenLocalhost(_config.Port);
        });

        var app = builder.Build();
        app.UseCors();

        app.MapGet("/health", () => Results.Json(new
        {
            ok = true,
            app = "dotnet-example-backend",
            status = "ready",
        }, JsonOptions));

        var routeMounts = BuildRouteMounts();
        app.MapGet("/manifest", () => Results.Json(new
        {
            app = "dotnet-example-backend",
            port = Registry.Providers["port"],
            registeredDomains = Registry.Cases.Keys,
            packages = Registry.Packages.Keys,
            routes = routeMounts.Select(route => $"{route.Method} {route.Path}").ToArray(),
        }, JsonOptions));

        foreach (var routeMount in routeMounts)
        {
            app.MapMethods(ToAspNetRoutePath(routeMount.Path), new[] { routeMount.Method }, async httpContext =>
            {
                var result = await HandleCaseRouteAsync(routeMount.ApiType, httpContext);
                await result.ExecuteAsync(httpContext);
            });
        }

        app.MapFallback(async httpContext =>
        {
            await WriteStructuredErrorAsync(
                httpContext,
                404,
                "NOT_FOUND",
                "Route not found in structural scaffold.",
                new Dictionary<string, object?>
                {
                    ["method"] = httpContext.Request.Method,
                    ["path"] = httpContext.Request.Path.Value,
                });
        });

        await app.StartAsync(cancellationToken);
        _logger.Info("Backend scaffold started", new Dictionary<string, object?>
        {
            ["port"] = ResolvePort(app),
            ["packages"] = Registry.Packages.Keys.ToArray(),
        });

        return app;
    }

    private IDictionary<string, IDictionary<string, IDictionary<string, object>>> MaterializeCases(ApiContext context)
    {
        var cases = new Dictionary<string, IDictionary<string, IDictionary<string, object>>>(StringComparer.Ordinal);

        foreach (var (domain, domainCases) in Registry.Cases)
        {
            var materializedDomain = new Dictionary<string, IDictionary<string, object>>(StringComparer.Ordinal);
            foreach (var (caseName, surfaces) in domainCases)
            {
                var entry = new Dictionary<string, object>(StringComparer.Ordinal);
                if (surfaces.Api is not null)
                {
                    entry["api"] = new Func<object?, Task<object?>>(async input =>
                    {
                        var runtimeContext = CreateApiContext(new ParentExecutionContext
                        {
                            CorrelationId = context.CorrelationId,
                            TenantId = context.TenantId,
                            UserId = context.UserId,
                            Config = context.Config,
                        });
                        var runtimeInstance = CreateApiCaseInstance(surfaces.Api, runtimeContext);
                        return await runtimeInstance.InvokeUntypedAsync(input);
                    });
                }

                materializedDomain[caseName] = entry;
            }

            cases[domain] = materializedDomain;
        }

        return cases;
    }

    private IReadOnlyList<RouteMount> BuildRouteMounts()
    {
        var mounts = new List<RouteMount>();

        foreach (var domainCases in Registry.Cases.Values)
        {
            foreach (var surfaces in domainCases.Values)
            {
                if (surfaces.Api is null)
                {
                    continue;
                }

                var bootInstance = CreateApiCaseInstance(
                    surfaces.Api,
                    CreateApiContext(new ParentExecutionContext { CorrelationId = "boot" }));
                var route = InvokeRouter(bootInstance);
                if (route is null)
                {
                    continue;
                }

                mounts.Add(new RouteMount(route.Method.ToUpperInvariant(), route.Path, surfaces.Api));
            }
        }

        return mounts;
    }

    private async Task<IResult> HandleCaseRouteAsync(Type apiType, HttpContext httpContext)
    {
        object? body = null;
        if (HttpMethods.IsPost(httpContext.Request.Method) ||
            HttpMethods.IsPatch(httpContext.Request.Method) ||
            HttpMethods.IsPut(httpContext.Request.Method))
        {
            try
            {
                body = await ReadRequestBodyAsync(httpContext.Request, httpContext.RequestAborted);
            }
            catch (JsonException error)
            {
                return StructuredError(400, "INVALID_REQUEST", error.Message);
            }
        }

        try
        {
            var runtimeInstance = CreateApiCaseInstance(apiType, CreateApiContext(new ParentExecutionContext
            {
                CorrelationId = httpContext.Request.Headers["x-correlation-id"].FirstOrDefault() ?? Guid.NewGuid().ToString(),
            }));

            var runtimeRoute = InvokeRouter(runtimeInstance);
            object? response;
            if (runtimeRoute?.Handler is not null)
            {
                response = await runtimeRoute.Handler(new AppRouteRequest
                {
                    Method = httpContext.Request.Method.ToUpperInvariant(),
                    Path = httpContext.Request.Path.Value ?? "/",
                    Body = body,
                    Params = httpContext.Request.RouteValues.ToDictionary(
                        pair => pair.Key,
                        pair => pair.Value?.ToString() ?? string.Empty,
                        StringComparer.Ordinal),
                    Request = httpContext.Request,
                });
            }
            else
            {
                response = await runtimeInstance.InvokeUntypedAsync(body);
            }

            return ToResult(response);
        }
        catch (AppCaseError error)
        {
            return StructuredError(MapErrorCodeToStatus(error.Code), error.Code, error.Message, error.Details);
        }
        catch (Exception error)
        {
            _logger.Error("Unhandled backend route error", new Dictionary<string, object?>
            {
                ["error"] = error.Message,
                ["method"] = httpContext.Request.Method,
                ["path"] = httpContext.Request.Path.Value,
            });

            return StructuredError(500, "INTERNAL", "Internal backend scaffold error.");
        }
    }

    private static async Task<object?> ReadRequestBodyAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(request.Body, leaveOpen: true);
        var text = await reader.ReadToEndAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var body = JsonSerializer.Deserialize<JsonElement>(text, JsonOptions);
        return body.ValueKind == JsonValueKind.Undefined ? null : body;
    }

    private static string ToAspNetRoutePath(string routePath)
    {
        return string.Join(
            '/',
            routePath.Split('/', StringSplitOptions.RemoveEmptyEntries)
                .Select(segment => segment.StartsWith(':') ? $"{{{segment[1..]}}}" : segment)
                .Prepend(string.Empty));
    }

    private static AppRouteBinding? InvokeRouter(IUntypedApiCaseInvoker apiCase)
    {
        return apiCase.GetType()
            .GetMethod(nameof(BaseApiCase<object, object>.Router), BindingFlags.Instance | BindingFlags.Public)
            ?.Invoke(apiCase, null) as AppRouteBinding;
    }

    private static IUntypedApiCaseInvoker CreateApiCaseInstance(Type apiType, ApiContext context)
    {
        return (IUntypedApiCaseInvoker)Activator.CreateInstance(apiType, context)!;
    }

    private static IResult ToResult(object? response)
    {
        if (response is null)
        {
            return Results.NoContent();
        }

        var statusCodeProperty = response.GetType().GetProperty("StatusCode");
        var statusCode = statusCodeProperty?.GetValue(response) is int typedStatusCode
            ? typedStatusCode
            : 200;

        return Results.Json(response, JsonOptions, statusCode: statusCode);
    }

    private static async Task WriteStructuredErrorAsync(
        HttpContext context,
        int statusCode,
        string code,
        string message,
        object? details = null)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json; charset=utf-8";
        await JsonSerializer.SerializeAsync(context.Response.Body, new
        {
            success = false,
            error = new
            {
                code,
                message,
                details,
            },
        }, JsonOptions);
    }

    private static IResult StructuredError(int statusCode, string code, string message, object? details = null)
    {
        return Results.Json(new
        {
            success = false,
            error = new
            {
                code,
                message,
                details,
            },
        }, JsonOptions, statusCode: statusCode);
    }

    private static int MapErrorCodeToStatus(string? code) => code switch
    {
        "INVALID_REQUEST" => 400,
        "VALIDATION_FAILED" => 400,
        "UNAUTHORIZED" => 401,
        "FORBIDDEN" => 403,
        "NOT_FOUND" => 404,
        "CONFLICT" => 409,
        _ => 500,
    };

    private static int ResolvePort(WebApplication app)
    {
        var addresses = app.Services
            .GetRequiredService<IServer>()
            .Features
            .Get<IServerAddressesFeature>()?
            .Addresses;

        var firstAddress = addresses?.FirstOrDefault();
        return firstAddress is null ? 0 : new Uri(firstAddress).Port;
    }

    private static string FormatMeta(IDictionary<string, object?>? meta)
    {
        return meta is null || meta.Count == 0
            ? string.Empty
            : JsonSerializer.Serialize(meta, JsonOptions);
    }

    private sealed record RouteMount(string Method, string Path, Type ApiType);

    public sealed class ParentExecutionContext
    {
        public string? CorrelationId { get; init; }
        public string? TenantId { get; init; }
        public string? UserId { get; init; }
        public IDictionary<string, object?>? Config { get; init; }
    }
}

public static class BackendBootstrap
{
    public static BackendRuntime Bootstrap(BackendConfig? config = null) => new(config);
}
