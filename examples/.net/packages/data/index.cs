using System.Reflection;

namespace AppProtocol.Example.DotNet.Packages.Data;

public sealed class DataPackage
{
    public required DataDefaultFiles DefaultFiles { get; init; }

    public JsonFileStore<T> CreateJsonFileStore<T>(string filePath, T fallbackData)
    {
        return new JsonFileStore<T>(filePath, fallbackData);
    }
}

public sealed class DataDefaultFiles
{
    public required string Tasks { get; init; }
}

public static class DataPackageFactory
{
    public static DataPackage Create(string? baseDirectory = null)
    {
        var resolvedBaseDirectory = baseDirectory ?? ResolveDefaultBaseDirectory();

        return new DataPackage
        {
            DefaultFiles = new DataDefaultFiles
            {
                Tasks = Path.Combine(resolvedBaseDirectory, "tasks.json"),
            },
        };
    }

    private static string ResolveDefaultBaseDirectory()
    {
        foreach (var candidate in CandidateRoots())
        {
            var resolved = FindDataDirectory(candidate);
            if (resolved is not null)
            {
                return resolved;
            }
        }

        return Path.Combine(Directory.GetCurrentDirectory(), "packages", "data");
    }

    private static IEnumerable<string> CandidateRoots()
    {
        yield return Directory.GetCurrentDirectory();
        yield return AppContext.BaseDirectory;

        var assemblyLocation = Assembly.GetExecutingAssembly().Location;
        if (!string.IsNullOrWhiteSpace(assemblyLocation))
        {
            yield return Path.GetDirectoryName(assemblyLocation)!;
        }
    }

    private static string? FindDataDirectory(string start)
    {
        var current = new DirectoryInfo(start);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "packages", "data");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        return null;
    }
}
