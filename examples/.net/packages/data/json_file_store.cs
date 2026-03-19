using System.Collections.Concurrent;
using System.Text.Json;

namespace AppProtocol.Example.DotNet.Packages.Data;

public sealed class JsonFileStore<T>
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> ProcessLocks = new(StringComparer.Ordinal);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    private readonly string _filePath;
    private readonly string _lockFilePath;
    private readonly T _fallbackData;

    public JsonFileStore(string filePath, T fallbackData)
    {
        _filePath = filePath;
        _lockFilePath = $"{filePath}.lock";
        _fallbackData = fallbackData;
    }

    public string FilePath => _filePath;

    public async Task<T> ReadAsync(CancellationToken cancellationToken = default)
    {
        return await SerializeAsync(
            () => WithFileLockAsync(async () =>
            {
                await EnsureFileExistsAsync(cancellationToken);
                return await ReadJsonAsync(cancellationToken);
            }, cancellationToken),
            cancellationToken);
    }

    public async Task WriteAsync(T value, CancellationToken cancellationToken = default)
    {
        await SerializeAsync(
            () => WithFileLockAsync(async () =>
            {
                await EnsureFileExistsAsync(cancellationToken);
                await WriteJsonAtomicallyAsync(value, cancellationToken);
                return true;
            }, cancellationToken),
            cancellationToken);
    }

    public async Task ResetAsync(CancellationToken cancellationToken = default)
    {
        await WriteAsync(_fallbackData, cancellationToken);
    }

    public async Task<T> UpdateAsync(
        Func<T, Task<T>> updater,
        CancellationToken cancellationToken = default)
    {
        return await SerializeAsync(
            () => WithFileLockAsync(async () =>
            {
                await EnsureFileExistsAsync(cancellationToken);
                var current = await ReadJsonAsync(cancellationToken);
                var next = await updater(current);
                if (!ReferenceEquals(current, next))
                {
                    await WriteJsonAtomicallyAsync(next, cancellationToken);
                }

                return next;
            }, cancellationToken),
            cancellationToken);
    }

    private async Task<TResult> SerializeAsync<TResult>(
        Func<Task<TResult>> operation,
        CancellationToken cancellationToken)
    {
        var processLock = ProcessLocks.GetOrAdd(_filePath, _ => new SemaphoreSlim(1, 1));
        await processLock.WaitAsync(cancellationToken);

        try
        {
            return await operation();
        }
        finally
        {
            processLock.Release();
        }
    }

    private async Task<TResult> WithFileLockAsync<TResult>(
        Func<Task<TResult>> operation,
        CancellationToken cancellationToken)
    {
        const int timeoutMs = 5000;
        const int staleLockMs = 30000;
        const int retryDelayMs = 25;
        var startedAt = DateTimeOffset.UtcNow;

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Directory.CreateDirectory(Path.GetDirectoryName(_lockFilePath)!);

            FileStream? lockStream = null;
            try
            {
                lockStream = new FileStream(
                    _lockFilePath,
                    FileMode.CreateNew,
                    FileAccess.ReadWrite,
                    FileShare.None);
            }
            catch (IOException)
            {
                await CleanupStaleLockAsync(staleLockMs, cancellationToken);

                if ((DateTimeOffset.UtcNow - startedAt).TotalMilliseconds >= timeoutMs)
                {
                    throw new InvalidOperationException($"Timed out acquiring JsonFileStore lock for {_filePath}.");
                }

                await Task.Delay(retryDelayMs, cancellationToken);
                continue;
            }

            try
            {
                await using (lockStream.ConfigureAwait(false))
                {
                    await JsonSerializer.SerializeAsync(
                        lockStream,
                        new
                        {
                            pid = Environment.ProcessId,
                            acquiredAt = DateTimeOffset.UtcNow.ToString("O"),
                        },
                        JsonOptions,
                        cancellationToken);

                    await lockStream.FlushAsync(cancellationToken);
                }

                return await operation();
            }
            finally
            {
                try
                {
                    File.Delete(_lockFilePath);
                }
                catch (FileNotFoundException)
                {
                }
            }
        }
    }

    private async Task CleanupStaleLockAsync(int staleLockMs, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!File.Exists(_lockFilePath))
        {
            return;
        }

        var info = new FileInfo(_lockFilePath);
        if (DateTimeOffset.UtcNow - info.LastWriteTimeUtc <= TimeSpan.FromMilliseconds(staleLockMs))
        {
            return;
        }

        try
        {
            File.Delete(_lockFilePath);
        }
        catch (FileNotFoundException)
        {
        }

        await Task.CompletedTask;
    }

    private async Task EnsureFileExistsAsync(CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);
        if (File.Exists(_filePath))
        {
            return;
        }

        await WriteJsonAtomicallyAsync(_fallbackData, cancellationToken);
    }

    private async Task<T> ReadJsonAsync(CancellationToken cancellationToken)
    {
        await using var stream = new FileStream(
            _filePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read);

        var value = await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions, cancellationToken);
        if (value is null)
        {
            throw new InvalidOperationException($"Failed to deserialize {_filePath}.");
        }

        return value;
    }

    private async Task WriteJsonAtomicallyAsync(T value, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);

        var tempFilePath = $"{_filePath}.{Environment.ProcessId}.{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}.{Guid.NewGuid():N}.tmp";
        try
        {
            await using (var stream = new FileStream(
                tempFilePath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None))
            {
                await JsonSerializer.SerializeAsync(stream, value, JsonOptions, cancellationToken);
                await stream.WriteAsync("\n"u8.ToArray(), cancellationToken);
                await stream.FlushAsync(cancellationToken);
            }

            File.Move(tempFilePath, _filePath, true);
        }
        finally
        {
            if (File.Exists(tempFilePath))
            {
                try
                {
                    File.Delete(tempFilePath);
                }
                catch (FileNotFoundException)
                {
                }
            }
        }
    }
}
