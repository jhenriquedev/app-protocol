using System.Reflection;
using System.Text.Json;
using AppProtocol.Example.DotNet.Core.Shared;
using Microsoft.AspNetCore.Http;

namespace AppProtocol.Example.DotNet.Core;

public sealed class ApiContext : AppBaseContext
{
    public IAppHttpClient? HttpClient { get; init; }
    public object? Db { get; init; }
    public object? Auth { get; init; }
    public IAppStorageClient? Storage { get; init; }
    public IAppCache? Cache { get; init; }
    public IDictionary<string, IDictionary<string, IDictionary<string, object>>>? Cases { get; set; }
    public IDictionary<string, object?>? Packages { get; init; }
    public IDictionary<string, object?>? Extra { get; init; }
}

public sealed class ApiResponse<T> : AppResult<T>
{
    public int? StatusCode { get; init; }

    public static ApiResponse<T> Ok(T data, int? statusCode = null) => new()
    {
        Success = true,
        Data = data,
        StatusCode = statusCode,
    };

    public static ApiResponse<T> Failure(AppError error, int? statusCode = null) => new()
    {
        Success = false,
        Error = error,
        StatusCode = statusCode,
    };
}

public sealed class AppRouteRequest
{
    public required string Method { get; init; }
    public required string Path { get; init; }
    public IDictionary<string, string> Params { get; init; } = new Dictionary<string, string>();
    public object? Body { get; init; }
    public HttpRequest? Request { get; init; }
}

public sealed class AppRouteBinding
{
    public required string Method { get; init; }
    public required string Path { get; init; }
    public Func<AppRouteRequest, Task<object?>>? Handler { get; init; }
}

public interface IUntypedApiCaseInvoker
{
    Task<object?> InvokeUntypedAsync(object? input);
}

public abstract class BaseApiCase<TInput, TOutput> : IUntypedApiCaseInvoker
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    protected BaseApiCase(ApiContext context)
    {
        Ctx = context;
    }

    protected ApiContext Ctx { get; }

    public abstract Task<ApiResponse<TOutput>> HandlerAsync(TInput input);

    public async Task<object?> InvokeUntypedAsync(object? input)
    {
        var typedInput = Materialize<TInput>(input);
        return await HandlerAsync(typedInput);
    }

    public virtual AppRouteBinding? Router() => null;

    public virtual Task TestAsync() => Task.CompletedTask;

    protected virtual Task ValidateAsync(TInput input) => Task.CompletedTask;

    protected virtual Task AuthorizeAsync(TInput input) => Task.CompletedTask;

    protected virtual object? Repository() => null;

    protected virtual Task<TOutput> ServiceAsync(TInput input) => throw new NotImplementedException();

    protected virtual Task<TOutput> CompositionAsync(TInput input) => throw new NotImplementedException();

    protected async Task<ApiResponse<TOutput>> ExecuteAsync(TInput input)
    {
        try
        {
            await ValidateAsync(input);
            await AuthorizeAsync(input);

            var result = IsOverridden(nameof(CompositionAsync))
                ? await CompositionAsync(input)
                : IsOverridden(nameof(ServiceAsync))
                    ? await ServiceAsync(input)
                    : throw new AppCaseError(
                        "INTERNAL",
                        "BaseApiCase requires ServiceAsync or CompositionAsync to be implemented");

            return ApiResponse<TOutput>.Ok(result);
        }
        catch (AppCaseError error)
        {
            return ApiResponse<TOutput>.Failure(error.ToAppError());
        }
        catch (Exception error)
        {
            return ApiResponse<TOutput>.Failure(new AppError("INTERNAL", error.Message));
        }
    }

    protected static TMaterialized Materialize<TMaterialized>(object? value)
    {
        if (value is TMaterialized typed)
        {
            return typed;
        }

        var json = JsonSerializer.Serialize(value, JsonOptions);
        var materialized = JsonSerializer.Deserialize<TMaterialized>(json, JsonOptions);
        if (materialized is null)
        {
            throw new AppCaseError("INVALID_REQUEST", $"Failed to materialize {typeof(TMaterialized).Name}.");
        }

        return materialized;
    }

    private bool IsOverridden(string methodName)
    {
        var method = GetType().GetMethod(methodName, BindingFlags.Instance | BindingFlags.NonPublic);
        return method?.DeclaringType != typeof(BaseApiCase<TInput, TOutput>);
    }
}
