using System.Collections.Generic;

namespace AppProtocol.Example.DotNet.Core.Shared;

public sealed record AppError(
    string Code,
    string Message,
    object? Details = null);

public sealed class AppCaseError : Exception
{
    public AppCaseError(string code, string message, object? details = null)
        : base(message)
    {
        Code = code;
        Details = details;
    }

    public string Code { get; }
    public object? Details { get; }

    public AppError ToAppError() => new(Code, Message, Details);
}

public static class AppCaseErrors
{
    public static AppCaseError ToAppCaseError(
        AppError? error,
        string fallbackMessage,
        string fallbackCode = "INTERNAL",
        object? fallbackDetails = null)
    {
        return error is null
            ? new AppCaseError(fallbackCode, fallbackMessage, fallbackDetails)
            : new AppCaseError(error.Code, error.Message, error.Details);
    }
}

public class AppResult<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public AppError? Error { get; init; }

    public static AppResult<T> Ok(T data) => new() { Success = true, Data = data };

    public static AppResult<T> Failure(AppError error) => new()
    {
        Success = false,
        Error = error,
    };
}

public sealed class AppPaginatedResult<T>
{
    public required IReadOnlyList<T> Items { get; init; }
    public int? Total { get; init; }
    public int? Page { get; init; }
    public int? Limit { get; init; }
    public string? Cursor { get; init; }
    public bool? HasMore { get; init; }
}
