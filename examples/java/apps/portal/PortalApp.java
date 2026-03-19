package apps.portal;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import core.BaseUiCase.UiContext;
import core.shared.AppBaseContext.AppLogger;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public final class PortalApp {
  private final PortalRegistry registry;
  private final AppLogger logger;

  private PortalApp(PortalRegistry registry) {
    this.registry = registry;
    this.logger = new AppLogger() {
      @Override
      public void debug(String message, Map<String, Object> meta) {
        System.out.println("[portal] DEBUG " + message + " " + meta);
      }

      @Override
      public void info(String message, Map<String, Object> meta) {
        System.out.println("[portal] INFO " + message + " " + meta);
      }

      @Override
      public void warn(String message, Map<String, Object> meta) {
        System.out.println("[portal] WARN " + message + " " + meta);
      }

      @Override
      public void error(String message, Map<String, Object> meta) {
        System.err.println("[portal] ERROR " + message + " " + meta);
      }
    };
  }

  public static PortalApp bootstrap(PortalRegistry.PortalConfig config) {
    return new PortalApp(PortalRegistry.createRegistry(config));
  }

  public UiContext createUiContext(Map<String, Object> extra) {
    UiContext context = new UiContext();
    context.correlationId = UUID.randomUUID().toString();
    context.executionId = UUID.randomUUID().toString();
    context.logger = logger;
    context.api = (core.shared.AppInfraContracts.AppHttpClient) registry.providers().get("httpClient");
    context.packages.putAll(registry.packages());
    context.renderer = Map.of("runtime", "java-http");
    if (extra != null) {
      context.extra.putAll(extra);
    }
    return context;
  }

  public HttpServer startPortal() throws Exception {
    int port = ((Number) registry.providers().get("port")).intValue();
    HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
    server.createContext("/", exchange -> {
      try {
        handle(exchange);
      } catch (Exception error) {
        logger.error("Unhandled portal error", errorMeta(error));
        sendHtml(exchange, 500, "<h1>Internal portal error</h1>");
      }
    });
    server.start();

    logger.info("Portal scaffold started", Map.of(
        "port", port,
        "apiBaseUrl", registry.providers().get("apiBaseUrl")
    ));
    return server;
  }

  private void handle(HttpExchange exchange) throws Exception {
    String method = exchange.getRequestMethod().toUpperCase();
    String path = exchange.getRequestURI().getPath();

    if ("GET".equals(method) && "/".equals(path)) {
      sendHtml(exchange, 200, renderPage(pageModelFromQuery(exchange)));
      return;
    }

    if ("POST".equals(method) && "/tasks".equals(path)) {
      Map<String, String> form = readForm(exchange);
      try {
        new cases.tasks.task_create.TaskCreateUiCase(createUiContext(Map.of())).submit(
            cases.tasks.task_create.TaskCreateDomainCase.TaskCreateInput.fromMap(Map.of(
                "title", form.getOrDefault("title", ""),
                "description", form.getOrDefault("description", "")
            ))
        );
        redirect(exchange, "/?success=" + urlEncode("Task created successfully."));
      } catch (Exception error) {
        PortalRoot.PageModel pageModel = new PortalRoot.PageModel();
        pageModel.createOpen = true;
        pageModel.createTitle = form.getOrDefault("title", "");
        pageModel.createDescription = form.getOrDefault("description", "");
        pageModel.createError = error.getMessage();
        sendHtml(exchange, 400, renderPage(pageModel));
      }
      return;
    }

    if ("POST".equals(method) && path.matches("^/tasks/[^/]+/status$")) {
      String taskId = path.substring("/tasks/".length(), path.length() - "/status".length());
      Map<String, String> form = readForm(exchange);
      try {
        new cases.tasks.task_move.TaskMoveUiCase(createUiContext(Map.of())).submit(
            new cases.tasks.task_move.TaskMoveDomainCase.TaskMoveInput(
                taskId,
                form.get("targetStatus")
            )
        );
        redirect(exchange, "/?success=" + urlEncode("Task moved successfully."));
      } catch (Exception error) {
        PortalRoot.PageModel pageModel = pageModelFromQuery(exchange);
        pageModel.bannerError = error.getMessage();
        sendHtml(exchange, 400, renderPage(pageModel));
      }
      return;
    }

    sendHtml(exchange, 404, "<h1>Not found</h1>");
  }

  private String renderPage(PortalRoot.PageModel pageModel) throws Exception {
    return new PortalRoot(registry, this::createUiContext).render(pageModel);
  }

  private PortalRoot.PageModel pageModelFromQuery(HttpExchange exchange) {
    PortalRoot.PageModel pageModel = new PortalRoot.PageModel();
    Map<String, String> query = parseQuery(exchange.getRequestURI().getRawQuery());
    pageModel.createOpen = "open".equals(query.get("create"));
    pageModel.successMessage = query.getOrDefault("success", "");
    return pageModel;
  }

  private Map<String, String> readForm(HttpExchange exchange) throws IOException {
    String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    return parseQuery(body);
  }

  private Map<String, String> parseQuery(String query) {
    Map<String, String> values = new LinkedHashMap<>();
    if (query == null || query.isBlank()) {
      return values;
    }

    String[] pairs = query.split("&");
    for (String pair : pairs) {
      if (pair.isBlank()) {
        continue;
      }

      String[] parts = pair.split("=", 2);
      String key = urlDecode(parts[0]);
      String value = parts.length > 1 ? urlDecode(parts[1]) : "";
      values.put(key, value);
    }

    return values;
  }

  private void redirect(HttpExchange exchange, String location) throws IOException {
    exchange.getResponseHeaders().set("Location", location);
    exchange.sendResponseHeaders(302, -1);
  }

  private void sendHtml(HttpExchange exchange, int statusCode, String html) throws IOException {
    byte[] bytes = html.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
    exchange.getResponseHeaders().set("Cache-Control", "no-store");
    exchange.sendResponseHeaders(statusCode, bytes.length);
    try (OutputStream outputStream = exchange.getResponseBody()) {
      outputStream.write(bytes);
    }
  }

  private static String urlDecode(String value) {
    return URLDecoder.decode(value, StandardCharsets.UTF_8);
  }

  private static String urlEncode(String value) {
    return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8);
  }

  private static Map<String, Object> errorMeta(Throwable error) {
    Map<String, Object> meta = new LinkedHashMap<>();
    meta.put("error", error == null || error.getMessage() == null ? "unknown" : error.getMessage());
    if (error != null) {
      meta.put("type", error.getClass().getName());
    }
    return meta;
  }
}
