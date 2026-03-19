using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Text;
using System.Text.Json;
using AppProtocol.Example.DotNet.Apps.Agent;
using AppProtocol.Example.DotNet.Apps.Backend;
using AppProtocol.Example.DotNet.Core.Shared;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace AppProtocol.Example.DotNet.SmokeRunner;

public static class Program
{
    private const string McpProtocolVersion = "2025-11-25";
    private const string McpLegacyProtocolVersion = "2025-06-18";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    private static readonly JsonSerializerOptions JsonLineOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false,
    };

    public static async Task Main()
    {
        var tempDirectory = Path.Combine(Path.GetTempPath(), $"app-dotnet-smoke-{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempDirectory);

        WebApplication? backendApp = null;
        WebApplication? agentApp = null;

        try
        {
            backendApp = await new BackendRuntime(new BackendConfig
            {
                Port = 0,
                DataDirectory = tempDirectory,
            }).StartBackendAsync();

            agentApp = await new AgentRuntime(new AgentConfig
            {
                Port = 0,
                DataDirectory = tempDirectory,
            }).StartAgentAsync();

            using var httpClient = new HttpClient();
            var backendBaseUrl = ResolveBaseUrl(backendApp);
            var agentBaseUrl = ResolveBaseUrl(agentApp);

            await RunBackendAndAgentHttpSmokeAsync(httpClient, backendBaseUrl, agentBaseUrl);
            await RunRemoteMcpSmokeAsync(httpClient, backendBaseUrl, agentBaseUrl);
            await RunStdioMcpSmokeAsync(httpClient, backendBaseUrl, tempDirectory);

            Console.WriteLine("smoke: ok");
        }
        finally
        {
            if (agentApp is not null)
            {
                await agentApp.StopAsync();
                await agentApp.DisposeAsync();
            }

            if (backendApp is not null)
            {
                await backendApp.StopAsync();
                await backendApp.DisposeAsync();
            }

            try
            {
                Directory.Delete(tempDirectory, recursive: true);
            }
            catch
            {
                // Best-effort cleanup.
            }
        }
    }

    private static async Task RunBackendAndAgentHttpSmokeAsync(HttpClient httpClient, string backendBaseUrl, string agentBaseUrl)
    {
        var backendManifest = await ReadJsonAsync<JsonElement>(
            await httpClient.GetAsync($"{backendBaseUrl}/manifest"),
            "backend manifest");
        Expect(
            backendManifest.GetProperty("registeredDomains").EnumerateArray().Any(item => item.GetString() == "tasks"),
            "smoke: backend manifest must expose tasks domain");

        var catalog = await ExpectSuccessAsync<CatalogResponse>(
            await httpClient.GetAsync($"{agentBaseUrl}/catalog"),
            "agent catalog");
        Expect(
            catalog.Tools.Select(tool => tool.PublishedName).OrderBy(name => name, StringComparer.Ordinal).SequenceEqual(
                new[] { "task_create", "task_list", "task_move" }),
            "smoke: /catalog must expose the three task tools");
        Expect(
            catalog.SystemPrompt.Contains("Tool task_create", StringComparison.Ordinal),
            "smoke: /catalog must expose the registry-derived system prompt");
        Expect(
            catalog.Resources.Select(resource => resource.Uri).OrderBy(uri => uri, StringComparer.Ordinal).SequenceEqual(
                new[]
                {
                    "app://agent/system/prompt",
                    "app://agent/tools/task_create/semantic",
                    "app://agent/tools/task_list/semantic",
                    "app://agent/tools/task_move/semantic",
                }),
            "smoke: /catalog must mirror MCP semantic resources");

        await ExpectFailureAsync(
            await httpClient.PostAsJsonAsync($"{agentBaseUrl}/tools/task_create/execute", new
            {
                input = new
                {
                    title = "   ",
                },
            }),
            "agent invalid task_create",
            HttpStatusCode.BadRequest,
            "VALIDATION_FAILED");

        var created = await ExpectSuccessAsync<TaskEnvelope>(
            await httpClient.PostAsJsonAsync($"{agentBaseUrl}/tools/task_create/execute", new
            {
                title = "Agent-created task",
                description = "Created through apps/agent",
            }),
            "agent task_create");
        Expect(created.Task.Status == "todo", "smoke: task_create must create todo tasks");

        var listedByAgent = await ExpectSuccessAsync<TaskListResponse>(
            await httpClient.PostAsJsonAsync($"{agentBaseUrl}/tools/task_list/execute", new { }),
            "agent task_list");
        Expect(
            listedByAgent.Tasks.Any(task => task.Id == created.Task.Id),
            "smoke: task_list must see tasks created via agent");

        var moveWithoutConfirmation = await httpClient.PostAsJsonAsync($"{agentBaseUrl}/tools/task_move/execute", new
        {
            taskId = created.Task.Id,
            targetStatus = "doing",
        });
        var moveWithoutConfirmationPayload = await ReadJsonAsync<JsonElement>(moveWithoutConfirmation, "agent task_move without confirmation");
        Expect(
            moveWithoutConfirmation.StatusCode == HttpStatusCode.Conflict,
            "smoke: task_move must require confirmation");
        Expect(
            moveWithoutConfirmationPayload.GetProperty("error").GetProperty("code").GetString() == "CONFIRMATION_REQUIRED",
            "smoke: task_move must preserve structured confirmation errors");

        await ExpectFailureAsync(
            await httpClient.PostAsJsonAsync($"{agentBaseUrl}/tools/task_move/execute", new
            {
                input = new
                {
                    taskId = "missing",
                    targetStatus = "done",
                },
                confirmed = true,
            }),
            "agent task_move missing task",
            HttpStatusCode.NotFound,
            "NOT_FOUND");

        var moved = await ExpectSuccessAsync<TaskEnvelope>(
            await httpClient.PostAsJsonAsync($"{agentBaseUrl}/tools/task_move/execute", new
            {
                input = new
                {
                    taskId = created.Task.Id,
                    targetStatus = "doing",
                },
                confirmed = true,
            }),
            "agent task_move");
        Expect(moved.Task.Status == "doing", "smoke: confirmed task_move must mutate the task");

        var listedByBackend = await ExpectSuccessAsync<TaskListResponse>(
            await httpClient.GetAsync($"{backendBaseUrl}/tasks"),
            "backend list after agent execution");
        var movedTask = listedByBackend.Tasks.FirstOrDefault(task => task.Id == created.Task.Id);
        Expect(movedTask is not null, "smoke: backend must observe tasks mutated by apps/agent");
        Expect(movedTask!.Status == "doing", "smoke: backend must observe the status written by task_move");

        const int backendBurst = 6;
        const int agentBurst = 6;
        var concurrentCreates = Enumerable.Range(1, backendBurst)
            .Select(index => httpClient.PostAsJsonAsync($"{backendBaseUrl}/tasks", new
            {
                title = $"Backend burst {index}",
            }))
            .Concat(Enumerable.Range(1, agentBurst)
                .Select(index => httpClient.PostAsJsonAsync($"{agentBaseUrl}/tools/task_create/execute", new
                {
                    input = new
                    {
                        title = $"Agent burst {index}",
                    },
                })))
            .ToArray();

        await Task.WhenAll(concurrentCreates);
        foreach (var response in concurrentCreates)
        {
            await ExpectSuccessAsync<TaskEnvelope>(response.Result, "concurrent backend/agent task creation");
        }

        var listedAfterConcurrency = await ExpectSuccessAsync<TaskListResponse>(
            await httpClient.GetAsync($"{backendBaseUrl}/tasks"),
            "backend list after concurrent writes");
        Expect(
            listedAfterConcurrency.Tasks.Count == 1 + backendBurst + agentBurst,
            "smoke: concurrent backend/agent writes must preserve every task");
    }

    private static async Task RunRemoteMcpSmokeAsync(HttpClient httpClient, string backendBaseUrl, string agentBaseUrl)
    {
        var mcpUrl = $"{agentBaseUrl}/mcp";
        var getResponse = await httpClient.GetAsync(mcpUrl);
        Expect(getResponse.StatusCode == HttpStatusCode.MethodNotAllowed, "smoke: GET /mcp must reject unsupported SSE mode");

        var invalidInitialize = await McpPostAsync(httpClient, mcpUrl, new
        {
            jsonrpc = "2.0",
            id = 1,
            method = "initialize",
            @params = new
            {
                protocolVersion = "1999-01-01",
                capabilities = new { tools = new { } },
                clientInfo = new
                {
                    name = "dotnet-smoke-http",
                    version = "1.0.0",
                },
            },
        });
        Expect(invalidInitialize.Error?.Message.Contains("Unsupported MCP protocol version", StringComparison.Ordinal) == true,
            "smoke: initialize must reject unsupported MCP versions");

        var initialize = await McpPostAsync(httpClient, mcpUrl, new
        {
            jsonrpc = "2.0",
            id = 2,
            method = "initialize",
            @params = new
            {
                protocolVersion = McpLegacyProtocolVersion,
                capabilities = new { tools = new { } },
                clientInfo = new
                {
                    name = "dotnet-smoke-http",
                    version = "1.0.0",
                },
            },
        });
        var initializeResult = initialize.RequireResult();
        Expect(
            initializeResult.GetProperty("protocolVersion").GetString() == McpProtocolVersion,
            "smoke: initialize must negotiate the host-supported protocol version");
        Expect(
            initializeResult.GetProperty("serverInfo").GetProperty("name").GetString() == "dotnet-task-board-agent",
            "smoke: initialize must expose the agent host server name");
        Expect(
            initializeResult.GetProperty("instructions").GetString()?.Contains("Tool task_list", StringComparison.Ordinal) == true,
            "smoke: initialize instructions must include registry-derived prompt fragments");

        var initializedNotification = await httpClient.PostAsJsonAsync(mcpUrl, new
        {
            jsonrpc = "2.0",
            method = "notifications/initialized",
            @params = new { },
        });
        Expect(initializedNotification.StatusCode == HttpStatusCode.Accepted, "smoke: notifications/initialized should be accepted");

        var toolsList = (await McpPostAsync(httpClient, mcpUrl, new
        {
            jsonrpc = "2.0",
            id = 3,
            method = "tools/list",
            @params = new { },
        })).RequireResult();
        var toolNames = toolsList.GetProperty("tools").EnumerateArray()
            .Select(tool => tool.GetProperty("name").GetString() ?? string.Empty)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();
        Expect(
            toolNames.SequenceEqual(new[] { "task_create", "task_list", "task_move" }),
            "smoke: remote MCP tools/list must expose the three task tools");

        var resourcesList = (await McpPostAsync(httpClient, mcpUrl, new
        {
            jsonrpc = "2.0",
            id = 4,
            method = "resources/list",
            @params = new { },
        })).RequireResult();
        var resourceUris = resourcesList.GetProperty("resources").EnumerateArray()
            .Select(resource => resource.GetProperty("uri").GetString() ?? string.Empty)
            .OrderBy(uri => uri, StringComparer.Ordinal)
            .ToArray();
        Expect(
            resourceUris.SequenceEqual(new[]
            {
                "app://agent/system/prompt",
                "app://agent/tools/task_create/semantic",
                "app://agent/tools/task_list/semantic",
                "app://agent/tools/task_move/semantic",
            }),
            "smoke: remote MCP resources/list must expose system and semantic resources");

        var promptResource = (await McpPostAsync(httpClient, mcpUrl, new
        {
            jsonrpc = "2.0",
            id = 5,
            method = "resources/read",
            @params = new
            {
                uri = "app://agent/system/prompt",
            },
        })).RequireResult();
        var promptText = promptResource.GetProperty("contents")[0].GetProperty("text").GetString();
        Expect(
            promptText?.Contains("Tool task_move", StringComparison.Ordinal) == true,
            "smoke: resources/read must expose the host global prompt");

        var invalidCreate = (await McpPostAsync(httpClient, mcpUrl, new
        {
            jsonrpc = "2.0",
            id = 6,
            method = "tools/call",
            @params = new
            {
                name = "task_create",
                arguments = new
                {
                    title = "   ",
                },
            },
        })).RequireResult();
        var invalidCreateCall = Materialize<McpToolCallResult>(invalidCreate);
        Expect(invalidCreateCall.IsError == true, "smoke: invalid task_create must fail through remote MCP");
        Expect(
            invalidCreateCall.StructuredContent?.GetProperty("error").GetProperty("code").GetString() == "VALIDATION_FAILED",
            "smoke: invalid task_create must preserve the APP validation code");

        var created = (await McpPostAsync(httpClient, mcpUrl, new
        {
            jsonrpc = "2.0",
            id = 7,
            method = "tools/call",
            @params = new
            {
                name = "task_create",
                arguments = new
                {
                    title = "Remote MCP task",
                    description = "Created through streamable HTTP MCP",
                },
            },
        })).RequireResult();
        var createdCall = Materialize<McpToolCallResult>(created);
        var createdTask = Materialize<TaskEnvelope>(createdCall.StructuredContent).Task;
        Expect(createdCall.IsError != true, "smoke: remote MCP task_create must succeed");

        var moveWithoutConfirmation = (await McpPostAsync(httpClient, mcpUrl, new
        {
            jsonrpc = "2.0",
            id = 8,
            method = "tools/call",
            @params = new
            {
                name = "task_move",
                arguments = new
                {
                    taskId = createdTask.Id,
                    targetStatus = "doing",
                },
            },
        })).RequireResult();
        var moveWithoutConfirmationCall = Materialize<McpToolCallResult>(moveWithoutConfirmation);
        Expect(moveWithoutConfirmationCall.IsError == true, "smoke: MCP task_move without confirmation must fail");
        Expect(
            moveWithoutConfirmationCall.StructuredContent?.GetProperty("error").GetProperty("code").GetString() == "CONFIRMATION_REQUIRED",
            "smoke: MCP task_move without confirmation must preserve the confirmation code");

        var moved = (await McpPostAsync(httpClient, mcpUrl, new
        {
            jsonrpc = "2.0",
            id = 9,
            method = "tools/call",
            @params = new
            {
                name = "task_move",
                arguments = new
                {
                    taskId = createdTask.Id,
                    targetStatus = "doing",
                    confirmed = true,
                },
            },
        })).RequireResult();
        var movedCall = Materialize<McpToolCallResult>(moved);
        var movedTask = Materialize<TaskEnvelope>(movedCall.StructuredContent).Task;
        Expect(movedTask.Status == "doing", "smoke: confirmed remote MCP task_move must mutate the task");

        var backendTasks = await ExpectSuccessAsync<TaskListResponse>(
            await httpClient.GetAsync($"{backendBaseUrl}/tasks"),
            "backend list after remote MCP");
        Expect(
            backendTasks.Tasks.Any(task => task.Id == createdTask.Id && task.Status == "doing"),
            "smoke: backend must observe tasks written through remote MCP");
    }

    private static async Task RunStdioMcpSmokeAsync(HttpClient httpClient, string backendBaseUrl, string dataDirectory)
    {
        await using var client = await McpStdioClient.StartAsync(dataDirectory);

        var invalidInitialize = await client.RequestAsync(new
        {
            jsonrpc = "2.0",
            id = 1,
            method = "initialize",
            @params = new
            {
                protocolVersion = "1999-01-01",
                capabilities = new { tools = new { } },
                clientInfo = new
                {
                    name = "dotnet-smoke-stdio",
                    version = "1.0.0",
                },
            },
        });
        Expect(
            invalidInitialize.Error?.Message.Contains("Unsupported MCP protocol version", StringComparison.Ordinal) == true,
            $"smoke: stdio initialize must reject unsupported MCP versions. Actual error: {invalidInitialize.Error?.Message ?? "<null>"}");

        var initialize = await client.RequestAsync(new
        {
            jsonrpc = "2.0",
            id = 2,
            method = "initialize",
            @params = new
            {
                protocolVersion = McpLegacyProtocolVersion,
                capabilities = new { tools = new { } },
                clientInfo = new
                {
                    name = "dotnet-smoke-stdio",
                    version = "1.0.0",
                },
            },
        });
        var initializeResult = initialize.RequireResult();
        Expect(
            initializeResult.GetProperty("protocolVersion").GetString() == McpProtocolVersion,
            "smoke: stdio initialize must negotiate the host-supported protocol version");
        Expect(
            initializeResult.GetProperty("instructions").GetString()?.Contains("Tool task_list", StringComparison.Ordinal) == true,
            "smoke: stdio initialize must expose the host prompt fragments");

        await client.NotifyAsync(new
        {
            jsonrpc = "2.0",
            method = "notifications/initialized",
            @params = new { },
        });

        var toolsList = (await client.RequestAsync(new
        {
            jsonrpc = "2.0",
            id = 3,
            method = "tools/list",
            @params = new { },
        })).RequireResult();
        var toolNames = toolsList.GetProperty("tools").EnumerateArray()
            .Select(tool => tool.GetProperty("name").GetString() ?? string.Empty)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();
        Expect(
            toolNames.SequenceEqual(new[] { "task_create", "task_list", "task_move" }),
            "smoke: stdio tools/list must expose the three task tools");

        var resourcesList = (await client.RequestAsync(new
        {
            jsonrpc = "2.0",
            id = 4,
            method = "resources/list",
            @params = new { },
        })).RequireResult();
        var resourceUris = resourcesList.GetProperty("resources").EnumerateArray()
            .Select(resource => resource.GetProperty("uri").GetString() ?? string.Empty)
            .OrderBy(uri => uri, StringComparer.Ordinal)
            .ToArray();
        Expect(
            resourceUris.SequenceEqual(new[]
            {
                "app://agent/system/prompt",
                "app://agent/tools/task_create/semantic",
                "app://agent/tools/task_list/semantic",
                "app://agent/tools/task_move/semantic",
            }),
            "smoke: stdio resources/list must expose the semantic resources");

        var taskMoveSemantic = (await client.RequestAsync(new
        {
            jsonrpc = "2.0",
            id = 5,
            method = "resources/read",
            @params = new
            {
                uri = "app://agent/tools/task_move/semantic",
            },
        })).RequireResult();
        var moveSemanticText = taskMoveSemantic.GetProperty("contents")[0].GetProperty("text").GetString();
        Expect(
            moveSemanticText?.Contains("Tool task_move", StringComparison.Ordinal) == true,
            "smoke: stdio resources/read must expose tool prompt fragments");

        var invalidCreate = (await client.RequestAsync(new
        {
            jsonrpc = "2.0",
            id = 6,
            method = "tools/call",
            @params = new
            {
                name = "task_create",
                arguments = new
                {
                    title = "   ",
                },
            },
        })).RequireResult();
        var invalidCreateCall = Materialize<McpToolCallResult>(invalidCreate);
        Expect(invalidCreateCall.IsError == true, "smoke: invalid stdio task_create must fail");
        Expect(
            invalidCreateCall.StructuredContent?.GetProperty("error").GetProperty("code").GetString() == "VALIDATION_FAILED",
            "smoke: invalid stdio task_create must preserve validation code");

        var created = (await client.RequestAsync(new
        {
            jsonrpc = "2.0",
            id = 7,
            method = "tools/call",
            @params = new
            {
                name = "task_create",
                arguments = new
                {
                    title = "Stdio MCP task",
                    description = "Created through MCP stdio",
                },
            },
        })).RequireResult();
        var createdCall = Materialize<McpToolCallResult>(created);
        var createdTask = Materialize<TaskEnvelope>(createdCall.StructuredContent).Task;
        Expect(createdTask.Status == "todo", "smoke: stdio task_create must create todo tasks");

        var moveWithoutConfirmation = (await client.RequestAsync(new
        {
            jsonrpc = "2.0",
            id = 8,
            method = "tools/call",
            @params = new
            {
                name = "task_move",
                arguments = new
                {
                    taskId = createdTask.Id,
                    targetStatus = "doing",
                },
            },
        })).RequireResult();
        var moveWithoutConfirmationCall = Materialize<McpToolCallResult>(moveWithoutConfirmation);
        Expect(moveWithoutConfirmationCall.IsError == true, "smoke: stdio task_move without confirmation must fail");
        Expect(
            moveWithoutConfirmationCall.StructuredContent?.GetProperty("error").GetProperty("code").GetString() == "CONFIRMATION_REQUIRED",
            "smoke: stdio task_move without confirmation must preserve confirmation code");

        var moved = (await client.RequestAsync(new
        {
            jsonrpc = "2.0",
            id = 9,
            method = "tools/call",
            @params = new
            {
                name = "task_move",
                arguments = new
                {
                    taskId = createdTask.Id,
                    targetStatus = "doing",
                    confirmed = true,
                },
            },
        })).RequireResult();
        var movedCall = Materialize<McpToolCallResult>(moved);
        var movedTask = Materialize<TaskEnvelope>(movedCall.StructuredContent).Task;
        Expect(movedTask.Status == "doing", "smoke: confirmed stdio task_move must mutate the task");

        var backendTasks = await ExpectSuccessAsync<TaskListResponse>(
            await httpClient.GetAsync($"{backendBaseUrl}/tasks"),
            "backend list after stdio MCP");
        Expect(
            backendTasks.Tasks.Any(task => task.Id == createdTask.Id && task.Status == "doing"),
            "smoke: backend must observe tasks written through MCP stdio");
    }

    private static async Task<T> ExpectSuccessAsync<T>(HttpResponseMessage response, string description)
    {
        var payload = await ReadJsonAsync<JsonElement>(response, description);
        Expect(response.IsSuccessStatusCode, $"smoke: {description} must return an HTTP success status");
        var hasSuccess = payload.TryGetProperty("success", out var successProperty) &&
                         successProperty.ValueKind == JsonValueKind.True;
        var hasData = payload.TryGetProperty("data", out var dataProperty);
        Expect(hasSuccess && hasData, $"smoke: {description} must return success=true with data");
        return Materialize<T>(dataProperty);
    }

    private static async Task<JsonElement> ExpectFailureAsync(HttpResponseMessage response, string description, HttpStatusCode expectedStatus, string expectedCode)
    {
        var payload = await ReadJsonAsync<JsonElement>(response, description);
        Expect(response.StatusCode == expectedStatus, $"smoke: {description} must return HTTP {(int)expectedStatus}");
        Expect(
            payload.TryGetProperty("success", out var successProperty) &&
            successProperty.ValueKind == JsonValueKind.False,
            $"smoke: {description} must return success=false");
        var actualCode = payload.TryGetProperty("error", out var errorProperty) &&
                         errorProperty.ValueKind == JsonValueKind.Object &&
                         errorProperty.TryGetProperty("code", out var codeProperty) &&
                         codeProperty.ValueKind == JsonValueKind.String
            ? codeProperty.GetString()
            : null;
        Expect(
            actualCode == expectedCode,
            $"smoke: {description} must expose {expectedCode}. Actual payload: {payload}");
        return payload;
    }

    private static async Task<T> ReadJsonAsync<T>(HttpResponseMessage response, string description)
    {
        await using var stream = await response.Content.ReadAsStreamAsync();
        var payload = await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions);
        if (payload is null)
        {
            throw new InvalidOperationException($"smoke: {description} returned an empty JSON payload.");
        }

        return payload;
    }

    private static T Materialize<T>(JsonElement? value)
    {
        if (value is null)
        {
            throw new InvalidOperationException($"smoke: expected JSON content for {typeof(T).Name}.");
        }

        var materialized = value.Value.Deserialize<T>(JsonOptions);
        if (materialized is null)
        {
            throw new InvalidOperationException($"smoke: failed to materialize {typeof(T).Name}.");
        }

        return materialized;
    }

    private static async Task<JsonRpcResponse> McpPostAsync(HttpClient httpClient, string url, object payload)
    {
        var response = await httpClient.PostAsync(url, new StringContent(
            JsonSerializer.Serialize(payload, JsonOptions),
            Encoding.UTF8,
            "application/json"));
        var body = await ReadJsonAsync<JsonElement>(response, "MCP JSON-RPC response");
        return ParseJsonRpcResponse(body);
    }

    private static string ResolveBaseUrl(WebApplication app)
    {
        var addresses = app.Services
            .GetRequiredService<IServer>()
            .Features
            .Get<IServerAddressesFeature>()?
            .Addresses;

        var selected = addresses?.FirstOrDefault(address =>
            address.Contains("127.0.0.1", StringComparison.Ordinal) ||
            address.Contains("localhost", StringComparison.OrdinalIgnoreCase)) ??
            addresses?.FirstOrDefault();

        return selected ?? throw new InvalidOperationException("smoke: failed to resolve application address.");
    }

    private static void Expect(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "examples/.net")) &&
                File.Exists(Path.Combine(directory.FullName, "README.md")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new InvalidOperationException("smoke: failed to locate repository root.");
    }

    private sealed class McpStdioClient : IAsyncDisposable
    {
        private readonly Process _process;
        private readonly Task _stderrPump;
        private readonly StringBuilder _stderrBuffer = new();

        private McpStdioClient(Process process)
        {
            _process = process;
            _stderrPump = Task.Run(async () =>
            {
                while (!_process.StandardError.EndOfStream)
                {
                    var line = await _process.StandardError.ReadLineAsync();
                    if (line is null)
                    {
                        break;
                    }

                    lock (_stderrBuffer)
                    {
                        _stderrBuffer.AppendLine(line);
                    }
                }
            });
        }

        public static async Task<McpStdioClient> StartAsync(string dataDirectory)
        {
            var repositoryRoot = FindRepositoryRoot();
            var agentDllPath = Path.Combine(
                repositoryRoot,
                "examples/.net/apps/agent/bin/Debug/net8.0/AppProtocol.Example.DotNet.Apps.Agent.dll");

            if (!File.Exists(agentDllPath))
            {
                throw new InvalidOperationException($"smoke: agent stdio entrypoint not found at {agentDllPath}.");
            }

            var startInfo = new ProcessStartInfo("dotnet")
            {
                WorkingDirectory = repositoryRoot,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            startInfo.ArgumentList.Add(agentDllPath);
            startInfo.ArgumentList.Add("stdio");
            startInfo.Environment["APP_DOTNET_DATA_DIR"] = dataDirectory;

            var process = new Process
            {
                StartInfo = startInfo,
                EnableRaisingEvents = true,
            };

            if (!process.Start())
            {
                throw new InvalidOperationException("smoke: failed to start MCP stdio process.");
            }

            await Task.Delay(250);
            return new McpStdioClient(process);
        }

        public async Task<JsonRpcResponse> RequestAsync(object payload)
        {
            await _process.StandardInput.WriteLineAsync(JsonSerializer.Serialize(payload, JsonLineOptions));
            await _process.StandardInput.FlushAsync();

            var line = await _process.StandardOutput.ReadLineAsync();
            if (line is null)
            {
                throw new InvalidOperationException($"smoke: MCP stdio process closed unexpectedly.\n{ReadStderr()}");
            }

            using var document = JsonDocument.Parse(line);
            return ParseJsonRpcResponse(document.RootElement.Clone());
        }

        public async Task NotifyAsync(object payload)
        {
            await _process.StandardInput.WriteLineAsync(JsonSerializer.Serialize(payload, JsonLineOptions));
            await _process.StandardInput.FlushAsync();
        }

        public async ValueTask DisposeAsync()
        {
            try
            {
                _process.StandardInput.Close();
            }
            catch
            {
                // Ignore.
            }

            try
            {
                await Task.WhenAny(_process.WaitForExitAsync(), Task.Delay(2000));
            }
            finally
            {
                if (!_process.HasExited)
                {
                    _process.Kill(entireProcessTree: true);
                }
            }

            await _stderrPump;
            _process.Dispose();
        }

        private string ReadStderr()
        {
            lock (_stderrBuffer)
            {
                return _stderrBuffer.ToString();
            }
        }
    }

    private sealed class CatalogResponse
    {
        public required string SystemPrompt { get; init; }
        public required IReadOnlyList<CatalogResource> Resources { get; init; }
        public required IReadOnlyList<CatalogTool> Tools { get; init; }
    }

    private sealed class CatalogResource
    {
        public required string Uri { get; init; }
    }

    private sealed class CatalogTool
    {
        public required string PublishedName { get; init; }
        public bool RequiresConfirmation { get; init; }
    }

    private sealed class TaskEnvelope
    {
        public required TaskCard Task { get; init; }
    }

    private sealed class TaskListResponse
    {
        public required IReadOnlyList<TaskCard> Tasks { get; init; }
    }

    private sealed class TaskCard
    {
        public required string Id { get; init; }
        public required string Title { get; init; }
        public string? Description { get; init; }
        public required string Status { get; init; }
        public required string CreatedAt { get; init; }
        public required string UpdatedAt { get; init; }
    }

    private sealed class JsonRpcResponse
    {
        public required string Jsonrpc { get; init; }
        public object? Id { get; init; }
        public JsonElement? Result { get; init; }
        public JsonRpcError? Error { get; init; }

        public JsonElement RequireResult()
        {
            if (Result is null)
            {
                throw new InvalidOperationException($"smoke: expected JSON-RPC result but received error {Error?.Message}.");
            }

            return Result.Value;
        }
    }

    private sealed class JsonRpcError
    {
        public int Code { get; init; }
        public required string Message { get; init; }
        public JsonElement? Data { get; init; }
    }

    private sealed class McpToolCallResult
    {
        public required IReadOnlyList<AppMcpTextContent> Content { get; init; }
        public JsonElement? StructuredContent { get; init; }
        public bool? IsError { get; init; }
    }

    private static JsonRpcResponse ParseJsonRpcResponse(JsonElement payload)
    {
        var result = payload.TryGetProperty("result", out var resultProperty)
            ? resultProperty.Clone()
            : (JsonElement?)null;
        JsonRpcError? error = null;
        if (payload.TryGetProperty("error", out var errorProperty) &&
            errorProperty.ValueKind == JsonValueKind.Object)
        {
            error = new JsonRpcError
            {
                Code = errorProperty.GetProperty("code").GetInt32(),
                Message = errorProperty.GetProperty("message").GetString() ?? string.Empty,
                Data = errorProperty.TryGetProperty("data", out var dataProperty)
                    ? dataProperty.Clone()
                    : (JsonElement?)null,
            };
        }

        return new JsonRpcResponse
        {
            Jsonrpc = payload.TryGetProperty("jsonrpc", out var jsonrpcProperty)
                ? jsonrpcProperty.GetString() ?? "2.0"
                : "2.0",
            Id = payload.TryGetProperty("id", out var idProperty)
                ? NormalizeJsonRpcId(idProperty)
                : null,
            Result = result,
            Error = error,
        };
    }

    private static object? NormalizeJsonRpcId(JsonElement idProperty)
    {
        return idProperty.ValueKind switch
        {
            JsonValueKind.String => idProperty.GetString(),
            JsonValueKind.Number when idProperty.TryGetInt64(out var longValue) => longValue,
            JsonValueKind.Null => null,
            _ => idProperty.GetRawText(),
        };
    }
}
