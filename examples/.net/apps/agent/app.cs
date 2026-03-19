using System.Reflection;
using System.Net;
using System.Text.Json;
using AppProtocol.Example.DotNet.Core;
using AppProtocol.Example.DotNet.Core.Shared;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;

namespace AppProtocol.Example.DotNet.Apps.Agent;

public sealed class AgentRuntime : IAppMcpServer
{
    private const string AppVersion = "1.0.1";
    private const string McpProtocolVersion = "2025-11-25";

    private static readonly IReadOnlyList<string> McpSupportedProtocolVersions = new[]
    {
        McpProtocolVersion,
        "2025-06-18",
    };

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    private readonly AgentConfig _config;
    private readonly DelegateAppLogger _logger;

    public AgentRuntime(AgentConfig? config = null)
    {
        _config = config ?? new AgentConfig();
        Registry = AgentRegistryFactory.Create(_config);
        _logger = new DelegateAppLogger(
            (message, meta) => Console.Error.WriteLine($"[agent] {message} {FormatMeta(meta)}"),
            (message, meta) => Console.Error.WriteLine($"[agent] {message} {FormatMeta(meta)}"),
            (message, meta) => Console.Error.WriteLine($"[agent] {message} {FormatMeta(meta)}"),
            (message, meta) => Console.Error.WriteLine($"[agent] {message} {FormatMeta(meta)}"));
    }

    public AgentRegistry Registry { get; }

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
            Extra = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["providers"] = Registry.Providers,
            },
        };

        context.Cases = CreateCasesMap(new ParentExecutionContext
        {
            CorrelationId = context.CorrelationId,
            TenantId = context.TenantId,
            UserId = context.UserId,
            Config = context.Config,
            Confirmed = parent?.Confirmed,
            Mcp = parent?.Mcp,
        });
        return context;
    }

    public AgenticContext CreateAgenticContext(ParentExecutionContext? parent = null)
    {
        var correlationId = parent?.CorrelationId ?? Guid.NewGuid().ToString();
        var mcpContext = new AppMcpRequestContext
        {
            Transport = parent?.Mcp?.Transport ?? "http",
            RequestId = parent?.Mcp?.RequestId,
            SessionId = parent?.Mcp?.SessionId,
            CorrelationId = parent?.Mcp?.CorrelationId ?? correlationId,
            ClientInfo = parent?.Mcp?.ClientInfo,
            ProtocolVersion = parent?.Mcp?.ProtocolVersion ?? McpProtocolVersion,
        };

        var context = new AgenticContext
        {
            CorrelationId = correlationId,
            ExecutionId = Guid.NewGuid().ToString(),
            TenantId = parent?.TenantId,
            UserId = parent?.UserId,
            Config = parent?.Config,
            Logger = _logger,
            Packages = Registry.Packages,
            Mcp = mcpContext,
            Extra = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["providers"] = Registry.Providers,
            },
        };

        context.Cases = CreateCasesMap(new ParentExecutionContext
        {
            CorrelationId = context.CorrelationId,
            TenantId = context.TenantId,
            UserId = context.UserId,
            Config = context.Config,
            Confirmed = parent?.Confirmed,
            Mcp = parent?.Mcp,
        });
        return context;
    }

    public IReadOnlyList<AgenticCatalogEntry> BuildAgentCatalog(ParentExecutionContext? parent = null)
    {
        return Registry.BuildCatalog(CreateAgenticContext(parent));
    }

    public AgenticCatalogEntry? ResolveTool(string toolName, ParentExecutionContext? parent = null)
    {
        return Registry.ResolveTool(toolName, CreateAgenticContext(parent));
    }

    public async Task<object?> ExecuteToolAsync(string toolName, object? input, ParentExecutionContext? parent = null)
    {
        var entry = ResolveTool(toolName, parent);
        if (entry is null)
        {
            throw new AppCaseError("NOT_FOUND", $"Tool {toolName} is not registered in apps/agent");
        }

        if (string.Equals(entry.ExecutionMode, "suggest-only", StringComparison.Ordinal))
        {
            throw new AppCaseError(
                "EXECUTION_MODE_RESTRICTED",
                $"Tool {entry.PublishedName} cannot execute directly in suggest-only mode");
        }

        if (entry.RequiresConfirmation && parent?.Confirmed != true)
        {
            throw new AppCaseError(
                "CONFIRMATION_REQUIRED",
                $"Tool {entry.PublishedName} requires explicit confirmation before execution",
                new Dictionary<string, object?>
                {
                    ["toolName"] = entry.PublishedName,
                    ["executionMode"] = entry.ExecutionMode,
                });
        }

        var context = CreateAgenticContext(parent);
        var runtimeEntry = Registry.ResolveTool(toolName, context);
        if (runtimeEntry is null)
        {
            throw new AppCaseError("NOT_FOUND", $"Tool {toolName} could not be resolved at execution time");
        }

        return await runtimeEntry.Definition.Tool.ExecuteAsync(input, context);
    }

    public string BuildSystemPrompt(ParentExecutionContext? parent = null)
    {
        var catalog = BuildAgentCatalog(parent)
            .OrderBy(entry => entry.PublishedName, StringComparer.Ordinal)
            .ToList();

        var confirmationTools = catalog
            .Where(entry => entry.RequiresConfirmation)
            .Select(entry => entry.PublishedName)
            .ToList();
        var suggestOnlyTools = catalog
            .Where(entry => string.Equals(entry.ExecutionMode, "suggest-only", StringComparison.Ordinal))
            .Select(entry => entry.PublishedName)
            .ToList();

        var sections = new List<string>
        {
            "You are operating dotnet-task-board-agent through the APP agent host.",
            "Use the registry-derived tool contracts exactly as published. Canonical execution always delegates through ctx.cases and the registered API surfaces.",
            confirmationTools.Count > 0
                ? $"Tools requiring confirmation: {string.Join(", ", confirmationTools)}."
                : "No tools currently require confirmation.",
        };

        if (suggestOnlyTools.Count > 0)
        {
            sections.Add($"Suggest-only tools: {string.Join(", ", suggestOnlyTools)}.");
        }

        sections.Add("Tool prompt fragments:");
        sections.AddRange(catalog.Select(BuildToolPromptFragment));
        return string.Join("\n\n", sections.Where(value => !string.IsNullOrWhiteSpace(value)));
    }

    public Task<AgentRuntimeSummary> ValidateAgenticRuntime()
    {
        return ValidateAgenticRuntimeAsync();
    }

    public async Task<AgentRuntimeSummary> ValidateAgenticRuntimeAsync()
    {
        var context = CreateAgenticContext(new ParentExecutionContext
        {
            CorrelationId = "agent-runtime-validation",
        });
        var catalog = Registry.BuildCatalog(context);
        if (catalog.Count == 0)
        {
            throw new InvalidOperationException("apps/agent must register at least one agentic tool.");
        }

        var adapters = ResolveMcpAdapters();
        if (adapters.Stdio is null)
        {
            throw new InvalidOperationException("apps/agent must register a concrete stdio MCP adapter in _providers.mcpAdapters.");
        }

        if (adapters.Http is null)
        {
            throw new InvalidOperationException("apps/agent must register a concrete remote HTTP MCP adapter in _providers.mcpAdapters.");
        }

        var publishedNames = new HashSet<string>(StringComparer.Ordinal);
        foreach (var entry in catalog)
        {
            if (!publishedNames.Add(entry.PublishedName))
            {
                throw new InvalidOperationException($"apps/agent published duplicate tool name {entry.PublishedName}.");
            }

            var resolved = Registry.ResolveTool(entry.PublishedName, context);
            if (resolved is null)
            {
                throw new InvalidOperationException($"apps/agent failed to resolve published tool {entry.PublishedName}.");
            }

            var descriptor = ToMcpToolDescriptor(entry);
            if (string.IsNullOrWhiteSpace(descriptor.Description))
            {
                throw new InvalidOperationException($"apps/agent failed to project semantic summary for {entry.PublishedName}.");
            }

            var promptFragment = BuildToolPromptFragment(entry);
            if (!promptFragment.Contains(entry.Definition.Prompt.Purpose, StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"apps/agent failed to project prompt fragment for {entry.PublishedName}.");
            }
        }

        foreach (var reference in Registry.ListAgenticCases())
        {
            var instance = Registry.InstantiateAgentic(reference, context);
            await instance.TestAsync();
        }

        var globalPrompt = BuildSystemPrompt(new ParentExecutionContext
        {
            CorrelationId = "agent-runtime-validation",
        });
        if (string.IsNullOrWhiteSpace(globalPrompt))
        {
            throw new InvalidOperationException("apps/agent must project a non-empty global system prompt.");
        }

        var resources = await ListResourcesAsync(new AppMcpRequestContext
        {
            Transport = "validation",
            CorrelationId = Guid.NewGuid().ToString(),
        });

        var expectedMinimumResourceCount = catalog.Count(entry => entry.IsMcpEnabled) + 1;
        if (resources.Count < expectedMinimumResourceCount)
        {
            throw new InvalidOperationException("apps/agent must publish a system prompt resource and one semantic resource per MCP-enabled tool.");
        }

        return new AgentRuntimeSummary(
            catalog.Count,
            catalog.Count(entry => entry.IsMcpEnabled),
            catalog.Count(entry => entry.RequiresConfirmation));
    }

    public async Task PublishMcpAsync(CancellationToken cancellationToken = default)
    {
        await ValidateAgenticRuntimeAsync();
        await ResolveMcpAdapters().Stdio.ServeAsync(this, cancellationToken);
    }

    public async Task<WebApplication> StartAgentAsync(CancellationToken cancellationToken = default)
    {
        var runtimeSummary = await ValidateAgenticRuntimeAsync();

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = Array.Empty<string>(),
            ApplicationName = typeof(AgentRuntime).Assembly.FullName,
            ContentRootPath = Directory.GetCurrentDirectory(),
        });

        builder.Services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            options.SerializerOptions.WriteIndented = true;
        });
        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
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
            app = "dotnet-example-agent",
            status = "ready",
        }, JsonOptions));

        app.MapGet("/manifest", () =>
        {
            var catalog = BuildAgentCatalog();
            var adapters = ResolveMcpAdapters();
            return Results.Json(new
            {
                app = "dotnet-example-agent",
                port = _config.Port,
                registeredDomains = Registry.Cases.Keys,
                packages = Registry.Packages.Keys,
                tools = catalog.Select(entry => entry.PublishedName).ToArray(),
                mcpEnabledTools = catalog.Where(entry => entry.IsMcpEnabled).Select(entry => entry.PublishedName).ToArray(),
                transports = new
                {
                    http = true,
                    mcp = new
                    {
                        stdio = adapters.Stdio.Transport,
                        remote = adapters.Http.Transport,
                        remotePath = adapters.Http.EndpointPath,
                    },
                },
                systemPrompt = BuildSystemPrompt(),
            }, JsonOptions);
        });

        app.MapGet("/catalog", async () => Results.Json(new
        {
            success = true,
            data = new
            {
                systemPrompt = BuildSystemPrompt(),
                resources = await ListResourcesAsync(new AppMcpRequestContext
                {
                    Transport = "http",
                    CorrelationId = Guid.NewGuid().ToString(),
                }),
                tools = BuildAgentCatalog().Select(ToCatalogDocument).ToArray(),
            },
        }, JsonOptions));

        app.MapPost("/tools/{toolName}/execute", async (string toolName, HttpContext httpContext) =>
        {
            object? body;
            try
            {
                body = await ReadRequestBodyAsync(httpContext.Request, httpContext.RequestAborted);
            }
            catch (JsonException error)
            {
                return StructuredError(400, "INVALID_REQUEST", error.Message);
            }

            var envelope = ToExecutionEnvelope(body);
            try
            {
                var resolved = ResolveTool(toolName, new ParentExecutionContext
                {
                    Confirmed = envelope.Confirmed,
                });
                if (resolved is null)
                {
                    throw new AppCaseError("NOT_FOUND", $"Tool {toolName} is not registered in apps/agent");
                }

                var data = await ExecuteToolAsync(toolName, envelope.Input, new ParentExecutionContext
                {
                    Confirmed = envelope.Confirmed,
                });

                return Results.Json(new
                {
                    success = true,
                    data,
                    meta = new
                    {
                        toolName = resolved.PublishedName,
                        requiresConfirmation = resolved.RequiresConfirmation,
                        executionMode = resolved.ExecutionMode,
                    },
                }, JsonOptions);
            }
            catch (AppCaseError error)
            {
                return StructuredError(MapErrorCodeToStatus(error.Code), error.Code, error.Message, error.Details);
            }
            catch (Exception error)
            {
                _logger.Error("Unhandled agent route error", new Dictionary<string, object?>
                {
                    ["error"] = error.Message,
                    ["method"] = httpContext.Request.Method,
                    ["path"] = httpContext.Request.Path.Value,
                    ["toolName"] = toolName,
                });
                return StructuredError(500, "INTERNAL", "Internal agent scaffold error.");
            }
        });

        app.MapMethods("/mcp", new[] { "GET", "POST", "DELETE", "PUT", "PATCH" }, async httpContext =>
        {
            await HandleRemoteMcpAsync(httpContext);
        });

        app.MapFallback(async httpContext =>
        {
            await WriteStructuredErrorAsync(
                httpContext,
                404,
                "NOT_FOUND",
                "Route not found in agent scaffold.",
                new Dictionary<string, object?>
                {
                    ["method"] = httpContext.Request.Method,
                    ["path"] = httpContext.Request.Path.Value,
                });
        });

        await app.StartAsync(cancellationToken);
        _logger.Info("Agent scaffold started", new Dictionary<string, object?>
        {
            ["port"] = ResolvePort(app),
            ["tools"] = runtimeSummary.Tools,
            ["mcpEnabled"] = runtimeSummary.McpEnabled,
            ["requireConfirmation"] = runtimeSummary.RequireConfirmation,
        });

        return app;
    }

    public AppMcpServerInfo ServerInfo()
    {
        return new AppMcpServerInfo(
            "dotnet-task-board-agent",
            AppVersion,
            McpProtocolVersion,
            BuildSystemPrompt());
    }

    public Task<AppMcpInitializeResult> InitializeMcp(AppMcpInitializeParams? parameters = null, AppMcpRequestContext? parent = null)
    {
        return InitializeAsync(parameters, parent);
    }

    public Task<AppMcpInitializeResult> InitializeAsync(AppMcpInitializeParams? parameters = null, AppMcpRequestContext? parent = null)
    {
        if (parameters?.ProtocolVersion is not null &&
            !McpSupportedProtocolVersions.Contains(parameters.ProtocolVersion, StringComparer.Ordinal))
        {
            throw new AppMcpProtocolError(
                -32602,
                $"Unsupported MCP protocol version {parameters.ProtocolVersion}.",
                new Dictionary<string, object?>
                {
                    ["supported"] = McpSupportedProtocolVersions.ToArray(),
                });
        }

        var info = ServerInfo();
        return Task.FromResult(new AppMcpInitializeResult
        {
            ProtocolVersion = info.ProtocolVersion,
            Capabilities = new Dictionary<string, object?>
            {
                ["tools"] = new Dictionary<string, object?>
                {
                    ["listChanged"] = false,
                },
                ["resources"] = new Dictionary<string, object?>
                {
                    ["listChanged"] = false,
                },
            },
            ServerInfo = new Dictionary<string, object?>
            {
                ["name"] = info.Name,
                ["version"] = info.Version,
            },
            Instructions = info.Instructions,
        });
    }

    public Task<IReadOnlyList<AppMcpToolDescriptor>> ListMcpTools(AppMcpRequestContext? parent = null)
    {
        return ListToolsAsync(parent);
    }

    public Task<IReadOnlyList<AppMcpToolDescriptor>> ListToolsAsync(AppMcpRequestContext? parent = null)
    {
        var context = CreateAgenticContext(new ParentExecutionContext
        {
            Mcp = parent,
        });

        return Task.FromResult<IReadOnlyList<AppMcpToolDescriptor>>(
            Registry.ListMcpEnabledTools(context)
                .Select(ToMcpToolDescriptor)
                .ToList());
    }

    public Task<IReadOnlyList<AppMcpResourceDescriptor>> ListMcpResources(AppMcpRequestContext? parent = null)
    {
        return ListResourcesAsync(parent);
    }

    public Task<IReadOnlyList<AppMcpResourceDescriptor>> ListResourcesAsync(AppMcpRequestContext? parent = null)
    {
        var context = CreateAgenticContext(new ParentExecutionContext
        {
            Mcp = parent,
        });

        var resources = Registry.ListMcpEnabledTools(context)
            .Select(ToMcpSemanticResourceDescriptor)
            .ToList();
        resources.Insert(0, ToMcpSystemPromptDescriptor());

        return Task.FromResult<IReadOnlyList<AppMcpResourceDescriptor>>(resources);
    }

    public Task<AppMcpReadResourceResult> ReadMcpResource(string uri, AppMcpRequestContext? parent = null)
    {
        return ReadResourceAsync(uri, parent);
    }

    public Task<AppMcpReadResourceResult> ReadResourceAsync(string uri, AppMcpRequestContext? parent = null)
    {
        if (string.Equals(uri, BuildSystemPromptResourceUri(), StringComparison.Ordinal))
        {
            return Task.FromResult(new AppMcpReadResourceResult
            {
                Contents = new[]
                {
                    ToMcpTextResourceContent(
                        uri,
                        BuildSystemPrompt(new ParentExecutionContext
                        {
                            Mcp = parent,
                        }),
                        "text/markdown"),
                },
            });
        }

        var context = CreateAgenticContext(new ParentExecutionContext
        {
            Mcp = parent,
        });
        var entry = Registry.ListMcpEnabledTools(context)
            .FirstOrDefault(candidate => string.Equals(BuildToolSemanticResourceUri(candidate), uri, StringComparison.Ordinal));
        if (entry is null)
        {
            throw new AppMcpProtocolError(-32004, $"MCP resource {uri} is not published by apps/agent.");
        }

        var payload = new
        {
            app = "dotnet-example-agent",
            @ref = entry.Ref,
            publishedName = entry.PublishedName,
            isMcpEnabled = entry.IsMcpEnabled,
            requiresConfirmation = entry.RequiresConfirmation,
            executionMode = entry.ExecutionMode,
            semanticSummary = BuildToolSemanticSummary(entry),
            promptFragment = BuildToolPromptFragment(entry),
            definition = StripDefinitionForProjection(entry),
        };

        return Task.FromResult(new AppMcpReadResourceResult
        {
            Contents = new[]
            {
                ToMcpTextResourceContent(
                    uri,
                    JsonSerializer.Serialize(payload, JsonOptions),
                    "application/json"),
            },
        });
    }

    public Task<AppMcpCallResult> CallMcpTool(string name, object? arguments = null, AppMcpRequestContext? parent = null)
    {
        return CallToolAsync(name, arguments, parent);
    }

    public async Task<AppMcpCallResult> CallToolAsync(string name, object? arguments = null, AppMcpRequestContext? parent = null)
    {
        var envelope = ToExecutionEnvelope(arguments);
        try
        {
            var resolved = ResolveMcpTool(name, new ParentExecutionContext
            {
                Confirmed = envelope.Confirmed,
                Mcp = parent,
            });
            if (resolved is null)
            {
                return ToMcpErrorResult(new AppCaseError("NOT_FOUND", $"MCP tool {name} is not published by apps/agent"));
            }

            var data = await ExecuteToolAsync(name, envelope.Input, new ParentExecutionContext
            {
                Confirmed = envelope.Confirmed,
                Mcp = parent,
            });
            return ToMcpSuccessResult(resolved.PublishedName, data);
        }
        catch (AppCaseError error)
        {
            return ToMcpErrorResult(error);
        }
    }

    private IDictionary<string, IDictionary<string, IDictionary<string, object>>> CreateCasesMap(ParentExecutionContext parent)
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
                            CorrelationId = parent.CorrelationId,
                            TenantId = parent.TenantId,
                            UserId = parent.UserId,
                            Config = parent.Config,
                            Confirmed = parent.Confirmed,
                            Mcp = parent.Mcp,
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

    private AgenticCatalogEntry? ResolveMcpTool(string toolName, ParentExecutionContext? parent = null)
    {
        var context = CreateAgenticContext(parent);
        var entry = Registry.ResolveTool(toolName, context);
        return entry is { IsMcpEnabled: true } ? entry : null;
    }

    private AgentMcpAdapters ResolveMcpAdapters()
    {
        if (!Registry.Providers.TryGetValue("mcpAdapters", out var adapters) ||
            adapters is not AgentMcpAdapters typedAdapters)
        {
            throw new InvalidOperationException("apps/agent requires providers.mcpAdapters.");
        }

        return typedAdapters;
    }

    private static IUntypedApiCaseInvoker CreateApiCaseInstance(Type apiType, ApiContext context)
    {
        return (IUntypedApiCaseInvoker)Activator.CreateInstance(apiType, context)!;
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

    private async Task HandleRemoteMcpAsync(HttpContext httpContext)
    {
        var bodyText = httpContext.Request.Method.Equals("POST", StringComparison.OrdinalIgnoreCase)
            ? await ReadRawRequestBodyAsync(httpContext.Request, httpContext.RequestAborted)
            : null;

        var exchange = new AppMcpHttpExchange
        {
            Method = httpContext.Request.Method.ToUpperInvariant(),
            Path = httpContext.Request.Path.Value ?? "/",
            Headers = ToHeaderMap(httpContext.Request.Headers),
            BodyText = bodyText,
        };

        var response = await ResolveMcpAdapters().Http.HandleAsync(exchange, this, httpContext.RequestAborted);
        if (response is null)
        {
            await WriteStructuredErrorAsync(httpContext, 404, "NOT_FOUND", "MCP route not found.");
            return;
        }

        httpContext.Response.StatusCode = response.StatusCode;
        if (response.Headers is not null)
        {
            foreach (var (name, value) in response.Headers)
            {
                httpContext.Response.Headers[name] = value;
            }
        }

        if (!string.IsNullOrWhiteSpace(response.BodyText))
        {
            await httpContext.Response.WriteAsync(response.BodyText, httpContext.RequestAborted);
        }
    }

    private static async Task<string?> ReadRawRequestBodyAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(request.Body, leaveOpen: true);
        var body = await reader.ReadToEndAsync(cancellationToken);
        var trimmed = body.Trim();
        return trimmed.Length == 0 ? null : trimmed;
    }

    private static IDictionary<string, string?> ToHeaderMap(IHeaderDictionary headers)
    {
        return headers.ToDictionary(
            header => header.Key.ToLowerInvariant(),
            header => (string?)header.Value.ToString(),
            StringComparer.Ordinal);
    }

    private static ExecutionEnvelope ToExecutionEnvelope(object? body)
    {
        if (body is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.Object)
        {
            var confirmed = jsonElement.TryGetProperty("confirmed", out var confirmedProperty) &&
                            confirmedProperty.ValueKind == JsonValueKind.True;

            if (jsonElement.TryGetProperty("input", out var inputProperty))
            {
                return new ExecutionEnvelope(inputProperty.Clone(), confirmed);
            }

            if (jsonElement.TryGetProperty("confirmed", out _))
            {
                var record = JsonSerializer.Deserialize<Dictionary<string, object?>>(jsonElement.GetRawText(), JsonOptions)
                    ?? new Dictionary<string, object?>(StringComparer.Ordinal);
                record.Remove("confirmed");
                return new ExecutionEnvelope(record.Count == 0 ? null : record, confirmed);
            }
        }

        if (body is IDictionary<string, object?> dictionary && dictionary.ContainsKey("confirmed"))
        {
            var confirmed = dictionary.TryGetValue("confirmed", out var confirmedValue) && confirmedValue is true;
            if (dictionary.TryGetValue("input", out var inputValue))
            {
                return new ExecutionEnvelope(inputValue, confirmed);
            }

            var record = new Dictionary<string, object?>(dictionary, StringComparer.Ordinal);
            record.Remove("confirmed");
            return new ExecutionEnvelope(record.Count == 0 ? null : record, confirmed);
        }

        return new ExecutionEnvelope(body, false);
    }

    private static object StripDefinitionForProjection(AgenticCatalogEntry entry)
    {
        return new
        {
            discovery = entry.Definition.Discovery,
            context = entry.Definition.Context,
            prompt = entry.Definition.Prompt,
            mcp = entry.Definition.Mcp,
            rag = entry.Definition.Rag,
            policy = entry.Definition.Policy,
            examples = entry.Definition.Examples,
            tool = new
            {
                name = entry.Definition.Tool.Name,
                description = entry.Definition.Tool.Description,
                inputSchema = entry.Definition.Tool.InputSchema,
                outputSchema = entry.Definition.Tool.OutputSchema,
                isMutating = entry.Definition.Tool.IsMutating ?? false,
                requiresConfirmation = entry.Definition.Tool.RequiresConfirmation ?? false,
            },
        };
    }

    private static string BuildToolSemanticSummary(AgenticCatalogEntry entry)
    {
        var parts = new[]
        {
            entry.Definition.Prompt.Purpose.Trim(),
            JoinSentence("Use when", entry.Definition.Prompt.WhenToUse?.Concat(entry.Definition.Discovery.Intents ?? Array.Empty<string>()).ToArray()),
            JoinSentence("Do not use when", entry.Definition.Prompt.WhenNotToUse),
            JoinSentence("Preconditions", entry.Definition.Context.Preconditions),
            JoinSentence("Constraints", MergeTextItems(
                entry.Definition.Context.Constraints,
                entry.Definition.Prompt.Constraints,
                entry.Definition.Policy?.Limits)),
            !string.IsNullOrWhiteSpace(entry.Definition.Prompt.ExpectedOutcome)
                ? $"Expected outcome: {entry.Definition.Prompt.ExpectedOutcome.Trim()}."
                : null,
        };

        return string.Join(" ", parts.Where(value => !string.IsNullOrWhiteSpace(value)));
    }

    private static string BuildToolPromptFragment(AgenticCatalogEntry entry)
    {
        var lines = new[]
        {
            $"Tool {entry.PublishedName}: {entry.Definition.Prompt.Purpose}",
            JoinSentence("Use when", entry.Definition.Prompt.WhenToUse?.Concat(entry.Definition.Discovery.Intents ?? Array.Empty<string>()).ToArray()),
            JoinSentence("Do not use when", entry.Definition.Prompt.WhenNotToUse),
            JoinSentence("Aliases", entry.Definition.Discovery.Aliases),
            JoinSentence("Capabilities", entry.Definition.Discovery.Capabilities),
            JoinSentence("Dependencies", entry.Definition.Context.Dependencies),
            JoinSentence("Preconditions", entry.Definition.Context.Preconditions),
            JoinSentence("Constraints", MergeTextItems(
                entry.Definition.Context.Constraints,
                entry.Definition.Prompt.Constraints,
                entry.Definition.Policy?.Limits)),
            JoinSentence("Reasoning hints", entry.Definition.Prompt.ReasoningHints),
            JoinSentence("RAG topics", entry.Definition.Rag?.Topics),
            JoinSentence(
                "RAG resources",
                entry.Definition.Rag?.Resources?.Select(resource =>
                    !string.IsNullOrWhiteSpace(resource.Description)
                        ? $"{resource.Kind}:{resource.Ref} ({resource.Description})"
                        : $"{resource.Kind}:{resource.Ref}").ToArray()),
            JoinSentence("RAG hints", entry.Definition.Rag?.Hints),
            $"Execution mode: {entry.ExecutionMode}.",
            $"Requires confirmation: {(entry.RequiresConfirmation ? "yes" : "no")}.",
            !string.IsNullOrWhiteSpace(entry.Definition.Prompt.ExpectedOutcome)
                ? $"Expected outcome: {entry.Definition.Prompt.ExpectedOutcome}."
                : null,
        };

        return string.Join("\n", lines.Where(value => !string.IsNullOrWhiteSpace(value)));
    }

    private static string? JoinSentence(string label, IEnumerable<string>? values)
    {
        var normalized = NormalizeTextItems(values);
        return normalized.Count == 0 ? null : $"{label}: {string.Join("; ", normalized)}.";
    }

    private static IReadOnlyList<string> NormalizeTextItems(IEnumerable<string>? values)
    {
        return values is null
            ? Array.Empty<string>()
            : values
                .Select(value => value.Trim())
                .Where(value => value.Length > 0)
                .Distinct(StringComparer.Ordinal)
                .ToList();
    }

    private static IReadOnlyList<string> MergeTextItems(params IEnumerable<string>?[] groups)
    {
        return NormalizeTextItems(groups.Where(group => group is not null).SelectMany(group => group!));
    }

    private static string BuildSystemPromptResourceUri() => "app://agent/system/prompt";
    private static string BuildToolSemanticResourceUri(AgenticCatalogEntry entry) => $"app://agent/tools/{entry.PublishedName}/semantic";

    private static IDictionary<string, object?> ToMcpSemanticAnnotations(AgenticCatalogEntry entry)
    {
        return new Dictionary<string, object?>
        {
            ["readOnlyHint"] = !(entry.Definition.Tool.IsMutating ?? false),
            ["destructiveHint"] = entry.Definition.Tool.IsMutating ?? false,
            ["requiresConfirmation"] = entry.RequiresConfirmation,
            ["executionMode"] = entry.ExecutionMode,
            ["appSemantic"] = new Dictionary<string, object?>
            {
                ["summary"] = BuildToolSemanticSummary(entry),
                ["discovery"] = entry.Definition.Discovery,
                ["context"] = entry.Definition.Context,
                ["prompt"] = entry.Definition.Prompt,
                ["policy"] = entry.Definition.Policy,
                ["rag"] = entry.Definition.Rag,
                ["exampleNames"] = entry.Definition.Examples?.Select(example => example.Name).ToArray() ?? Array.Empty<string>(),
                ["resourceUri"] = BuildToolSemanticResourceUri(entry),
            },
        };
    }

    private static AppMcpToolDescriptor ToMcpToolDescriptor(AgenticCatalogEntry entry)
    {
        var summary = BuildToolSemanticSummary(entry);
        return new AppMcpToolDescriptor
        {
            Name = entry.PublishedName,
            Title = entry.Definition.Mcp?.Title ?? HumanizeIdentifier(entry.PublishedName),
            Description = !string.IsNullOrWhiteSpace(entry.Definition.Mcp?.Description)
                ? $"{entry.Definition.Mcp.Description} {summary}".Trim()
                : summary,
            InputSchema = entry.Definition.Tool.InputSchema,
            OutputSchema = entry.Definition.Tool.OutputSchema,
            Annotations = ToMcpSemanticAnnotations(entry),
        };
    }

    private static AppMcpResourceDescriptor ToMcpSemanticResourceDescriptor(AgenticCatalogEntry entry)
    {
        return new AppMcpResourceDescriptor
        {
            Uri = BuildToolSemanticResourceUri(entry),
            Name = $"{entry.PublishedName}_semantic",
            Title = $"{HumanizeIdentifier(entry.PublishedName)} Semantic Contract",
            Description = $"Complete APP agentic definition projected automatically from the registry for {entry.PublishedName}.",
            MimeType = "application/json",
            Annotations = new Dictionary<string, object?>
            {
                ["toolName"] = entry.PublishedName,
                ["executionMode"] = entry.ExecutionMode,
                ["requiresConfirmation"] = entry.RequiresConfirmation,
            },
        };
    }

    private static AppMcpResourceDescriptor ToMcpSystemPromptDescriptor()
    {
        return new AppMcpResourceDescriptor
        {
            Uri = BuildSystemPromptResourceUri(),
            Name = "agent_system_prompt",
            Title = "Agent System Prompt",
            Description = "Host-level system prompt composed automatically from the registered tool fragments.",
            MimeType = "text/markdown",
            Annotations = new Dictionary<string, object?>
            {
                ["kind"] = "system-prompt",
            },
        };
    }

    private static AppMcpTextContent ToMcpTextContent(string text) => new("text", text);

    private static AppMcpTextResourceContent ToMcpTextResourceContent(string uri, string text, string? mimeType = null)
    {
        return new AppMcpTextResourceContent
        {
            Uri = uri,
            Text = text,
            MimeType = mimeType,
        };
    }

    private static AppMcpCallResult ToMcpSuccessResult(string toolName, object? data)
    {
        return new AppMcpCallResult
        {
            Content = new[] { ToMcpTextContent($"Tool {toolName} executed successfully.") },
            StructuredContent = data,
            IsError = false,
        };
    }

    private static AppMcpCallResult ToMcpErrorResult(AppCaseError error)
    {
        return new AppMcpCallResult
        {
            Content = new[] { ToMcpTextContent(error.Message) },
            StructuredContent = new
            {
                success = false,
                error = error.ToAppError(),
            },
            IsError = true,
        };
    }

    private static string HumanizeIdentifier(string value)
    {
        return string.Join(
            " ",
            value.Split(new[] { '_', '-' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(part => char.ToUpperInvariant(part[0]) + part[1..]));
    }

    private static object ToCatalogDocument(AgenticCatalogEntry entry)
    {
        return new
        {
            @ref = entry.Ref,
            publishedName = entry.PublishedName,
            isMcpEnabled = entry.IsMcpEnabled,
            requiresConfirmation = entry.RequiresConfirmation,
            executionMode = entry.ExecutionMode,
            semanticSummary = BuildToolSemanticSummary(entry),
            promptFragment = BuildToolPromptFragment(entry),
            resources = new
            {
                semantic = BuildToolSemanticResourceUri(entry),
            },
            definition = StripDefinitionForProjection(entry),
        };
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

    private static async Task WriteStructuredErrorAsync(HttpContext context, int statusCode, string code, string message, object? details = null)
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

    private static int MapErrorCodeToStatus(string? code) => code switch
    {
        "INVALID_REQUEST" => 400,
        "VALIDATION_FAILED" => 400,
        "NOT_FOUND" => 404,
        "CONFIRMATION_REQUIRED" => 409,
        "EXECUTION_MODE_RESTRICTED" => 409,
        _ => 500,
    };

    private static string FormatMeta(IDictionary<string, object?>? meta)
    {
        return meta is null || meta.Count == 0
            ? string.Empty
            : JsonSerializer.Serialize(meta, JsonOptions);
    }

    private static T Materialize<T>(object? value)
    {
        if (value is T typed)
        {
            return typed;
        }

        var json = JsonSerializer.Serialize(value, JsonOptions);
        var materialized = JsonSerializer.Deserialize<T>(json, JsonOptions);
        if (materialized is null)
        {
            throw new AppCaseError("INVALID_REQUEST", $"Failed to materialize {typeof(T).Name}.");
        }

        return materialized;
    }

    public sealed class ParentExecutionContext
    {
        public string? CorrelationId { get; init; }
        public string? TenantId { get; init; }
        public string? UserId { get; init; }
        public IDictionary<string, object?>? Config { get; init; }
        public bool? Confirmed { get; init; }
        public AppMcpRequestContext? Mcp { get; init; }
    }

    private sealed record ExecutionEnvelope(object? Input, bool Confirmed);
}

public sealed record AgentRuntimeSummary(int Tools, int McpEnabled, int RequireConfirmation);

public static class AgentBootstrap
{
    public static AgentRuntime Bootstrap(AgentConfig? config = null) => new(config);
}
