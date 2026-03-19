using AppProtocol.Example.DotNet.Apps.Portal.Components;

namespace AppProtocol.Example.DotNet.Apps.Portal;

public static class Program
{
    public static void Main(string[] args)
    {
        var port = ResolvePort();
        var apiBaseUrl = Environment.GetEnvironmentVariable("API_BASE_URL") ?? "http://localhost:3000";
        var config = new PortalConfig
        {
            Port = port,
            ApiBaseUrl = apiBaseUrl,
        };

        var builder = WebApplication.CreateBuilder(args);
        builder.WebHost.ConfigureKestrel(options =>
        {
            options.ListenLocalhost(config.Port);
        });

        builder.Services.AddSingleton<HttpClient>(_ => new HttpClient
        {
            BaseAddress = new Uri(apiBaseUrl.EndsWith("/", StringComparison.Ordinal) ? apiBaseUrl : $"{apiBaseUrl}/"),
        });
        builder.Services.AddSingleton<PortalRuntime>(services =>
            PortalBootstrap.Bootstrap(config, services.GetRequiredService<HttpClient>()));

        builder.Services.AddRazorComponents()
            .AddInteractiveServerComponents();

        var app = builder.Build();

        if (!app.Environment.IsDevelopment())
        {
            app.UseExceptionHandler("/Error");
        }

        app.UseStaticFiles();
        app.UseAntiforgery();

        app.MapGet("/health", () => Results.Json(new
        {
            ok = true,
            app = "dotnet-example-portal",
            status = "ready",
        }));

        app.MapGet("/manifest", (PortalRuntime runtime) => Results.Json(new
        {
            app = "dotnet-example-portal",
            port = runtime.Config.Port,
            apiBaseUrl = runtime.Config.ApiBaseUrl,
            registeredDomains = runtime.Registry.Cases.Keys,
            routes = new[] { "GET /", "GET /health", "GET /manifest" },
            packages = runtime.Registry.Packages.Keys,
        }));

        app.MapRazorComponents<App>()
            .AddInteractiveServerRenderMode();

        app.Run();
    }

    private static int ResolvePort()
    {
        return int.TryParse(Environment.GetEnvironmentVariable("PORT"), out var port) ||
               int.TryParse(Environment.GetEnvironmentVariable("PORTAL_PORT"), out port)
            ? port
            : 3002;
    }
}
