namespace AppProtocol.Example.DotNet.Apps.Backend;

public class Program
{
    public static async Task Main(string[] args)
    {
        var resolvedPort = ResolvePort(Environment.GetEnvironmentVariable("PORT")) ??
                           ResolvePort(Environment.GetEnvironmentVariable("API_PORT")) ??
                           3000;

        var runtime = BackendBootstrap.Bootstrap(new BackendConfig
        {
            Port = resolvedPort,
            DataDirectory = Environment.GetEnvironmentVariable("APP_DOTNET_DATA_DIR"),
        });

        var app = await runtime.StartBackendAsync();
        await app.WaitForShutdownAsync();
    }

    private static int? ResolvePort(string? value)
    {
        return int.TryParse(value, out var parsed) ? parsed : null;
    }
}
