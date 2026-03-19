namespace AppProtocol.Example.DotNet.Apps.Agent;

public static class Program
{
    public static async Task Main(string[] args)
    {
        var config = new AgentConfig
        {
            Port = ResolvePort(),
            DataDirectory = Environment.GetEnvironmentVariable("APP_DOTNET_DATA_DIR"),
        };

        var runtime = AgentBootstrap.Bootstrap(config);
        if (UseStdioMode(args))
        {
            await runtime.PublishMcpAsync();
            return;
        }

        var app = await runtime.StartAgentAsync();
        await app.WaitForShutdownAsync();
    }

    private static bool UseStdioMode(string[] args)
    {
        return args.Any(argument =>
            string.Equals(argument, "stdio", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(argument, "--stdio", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(argument, "mcp-stdio", StringComparison.OrdinalIgnoreCase));
    }

    private static int ResolvePort()
    {
        return int.TryParse(Environment.GetEnvironmentVariable("PORT"), out var port) ||
               int.TryParse(Environment.GetEnvironmentVariable("AGENT_PORT"), out port)
            ? port
            : 3001;
    }
}
