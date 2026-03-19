package apps.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import core.BaseApiCase;
import core.BaseApiCase.ApiContext;
import core.BaseApiCase.ApiResponse;
import core.shared.AppBaseContext.AppLogger;
import core.shared.AppHostContracts.AppCaseSurfaces;
import core.shared.AppStructuralContracts.AppCaseError;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class BackendApp {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final BackendRegistry registry;
  private final AppLogger logger;

  private BackendApp(BackendRegistry registry) {
    this.registry = registry;
    this.logger = new AppLogger() {
      @Override
      public void debug(String message, Map<String, Object> meta) {
        System.out.println("[backend] DEBUG " + message + " " + meta);
      }

      @Override
      public void info(String message, Map<String, Object> meta) {
        System.out.println("[backend] INFO " + message + " " + meta);
      }

      @Override
      public void warn(String message, Map<String, Object> meta) {
        System.out.println("[backend] WARN " + message + " " + meta);
      }

      @Override
      public void error(String message, Map<String, Object> meta) {
        System.err.println("[backend] ERROR " + message + " " + meta);
      }
    };
  }

  public static BackendApp bootstrap(BackendRegistry.BackendConfig config) {
    return new BackendApp(BackendRegistry.createRegistry(config));
  }

  public BackendRegistry registry() {
    return registry;
  }

  public ApiContext createApiContext(Map<String, Object> parent) {
    ApiContext context = new ApiContext();
    context.correlationId = stringValue(parent == null ? null : parent.get("correlationId"), UUID.randomUUID().toString());
    context.executionId = UUID.randomUUID().toString();
    context.tenantId = stringValue(parent == null ? null : parent.get("tenantId"), null);
    context.userId = stringValue(parent == null ? null : parent.get("userId"), null);
    context.logger = logger;
    context.packages.putAll(registry.packages());
    context.extra.put("providers", registry.providers());
    context.cases.putAll(materializeCases(context));
    return context;
  }

  public HttpServer startBackend() throws Exception {
    int port = ((Number) registry.providers().get("port")).intValue();
    HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
    server.createContext("/", exchange -> {
      try {
        handle(exchange);
      } catch (Throwable error) {
        logger.error("Unhandled backend scaffold error", errorMeta(error));
        sendStructuredError(exchange, 500, "INTERNAL", "Internal backend scaffold error.", null);
      }
    });
    server.start();

    logger.info("Backend scaffold started", Map.of(
        "port", port,
        "packages", registry.packages().keySet()
    ));
    return server;
  }

  private Map<String, Object> materializeCases(ApiContext context) {
    Map<String, Object> result = new LinkedHashMap<>();
    for (Map.Entry<String, Map<String, AppCaseSurfaces>> domainEntry : registry.cases().entrySet()) {
      Map<String, Object> domainCases = new LinkedHashMap<>();
      for (Map.Entry<String, AppCaseSurfaces> caseEntry : domainEntry.getValue().entrySet()) {
        Map<String, Object> surfaces = new LinkedHashMap<>();
        if (caseEntry.getValue().api != null) {
          surfaces.put("api", caseEntry.getValue().api.create(context));
        }
        domainCases.put(caseEntry.getKey(), surfaces);
      }
      result.put(domainEntry.getKey(), domainCases);
    }
    return result;
  }

  private void handle(HttpExchange exchange) throws Exception {
    String method = exchange.getRequestMethod().toUpperCase();
    String path = exchange.getRequestURI().getPath();

    if ("OPTIONS".equals(method)) {
      exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
      exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
      exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "content-type");
      exchange.sendResponseHeaders(204, -1);
      return;
    }

    if ("GET".equals(method) && "/health".equals(path)) {
      sendJson(exchange, 200, Map.of(
          "ok", true,
          "app", "java-example-backend",
          "status", "ready"
      ));
      return;
    }

    if ("GET".equals(method) && "/manifest".equals(path)) {
      List<String> routes = new ArrayList<>();
      for (RouteBinding route : routes()) {
        routes.add(route.method + " " + route.path);
      }

      sendJson(exchange, 200, Map.of(
          "app", "java-example-backend",
          "port", registry.providers().get("port"),
          "registeredDomains", registry.cases().keySet(),
          "packages", registry.packages().keySet(),
          "routes", routes
      ));
      return;
    }

    RouteMatch routeMatch = resolveRoute(method, path);
    if (routeMatch != null) {
      Object body;
      if ("POST".equals(method) || "PATCH".equals(method) || "PUT".equals(method)) {
        try {
          body = readRequestBody(exchange);
        } catch (Exception error) {
          sendStructuredError(exchange, 400, "INVALID_REQUEST", error.getMessage(), null);
          return;
        }
      } else {
        body = null;
      }

      try {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("body", body);
        request.put("method", method);
        request.put("path", path);
        request.put("params", routeMatch.params);
        request.put("exchange", exchange);
        Object response = routeMatch.route.handler.handle(request);

        if (response instanceof ApiResponse<?> apiResponse) {
          int statusCode = apiResponse.statusCode == null
              ? apiResponse.success
              ? 200
              : mapErrorCodeToStatus(apiResponse.error == null ? null : apiResponse.error.code())
              : apiResponse.statusCode;
          sendJson(exchange, statusCode, apiResponse);
          return;
        }

        sendJson(exchange, 200, response);
        return;
      } catch (AppCaseError error) {
        sendStructuredError(
            exchange,
            mapErrorCodeToStatus(error.code()),
            error.code(),
            error.getMessage(),
            error.details()
        );
        return;
      }
    }

    sendStructuredError(
        exchange,
        404,
        "NOT_FOUND",
        "Route not found in structural scaffold.",
        Map.of("method", method, "path", path)
    );
  }

  private List<RouteBinding> routes() {
    List<RouteBinding> routes = new ArrayList<>();
    for (Map<String, AppCaseSurfaces> domainCases : registry.cases().values()) {
      for (AppCaseSurfaces surfaces : domainCases.values()) {
        if (surfaces.api == null) {
          continue;
        }

        Object bootInstance = surfaces.api.create(createApiContext(Map.of("correlationId", "boot")));
        if (!(bootInstance instanceof BaseApiCase<?, ?> apiCase)) {
          continue;
        }

        RouteBinding binding = toRouteBinding(apiCase.router());
        if (binding == null) {
          continue;
        }

        RouteBinding runtimeBinding = new RouteBinding();
        runtimeBinding.method = binding.method;
        runtimeBinding.path = binding.path;
        runtimeBinding.handler = request -> {
          Object runtimeInstance = surfaces.api.create(createApiContext(Map.of()));
          if (!(runtimeInstance instanceof BaseApiCase<?, ?> runtimeApiCase)) {
            throw new IllegalStateException("Mounted route does not expose an API case");
          }

          RouteBinding runtimeRoute = toRouteBinding(runtimeApiCase.router());
          if (runtimeRoute != null && runtimeRoute.handler != null) {
            return runtimeRoute.handler.handle(request);
          }

	          @SuppressWarnings("unchecked")
	          BaseApiCase<Object, Object> untypedApiCase = (BaseApiCase<Object, Object>) runtimeApiCase;
	          return untypedApiCase.handler(request.get("body"));
	        };
        routes.add(runtimeBinding);
      }
    }
    return routes;
  }

  private RouteBinding toRouteBinding(Object value) {
    if (!(value instanceof Map<?, ?> routeMap)) {
      return null;
    }

    Object method = routeMap.get("method");
    Object path = routeMap.get("path");
    Object handler = routeMap.get("handler");
    if (!(method instanceof String methodValue)
        || !(path instanceof String pathValue)
        || !(handler instanceof BaseApiCase.RouteHandler routeHandler)) {
      return null;
    }

    RouteBinding binding = new RouteBinding();
    binding.method = methodValue.toUpperCase();
    binding.path = pathValue;
    binding.handler = routeHandler;
    return binding;
  }

  private RouteMatch resolveRoute(String method, String path) {
    for (RouteBinding route : routes()) {
      if (!route.method.equals(method)) {
        continue;
      }

      Map<String, Object> params = matchRoutePath(route.path, path);
      if (params != null) {
        RouteMatch match = new RouteMatch();
        match.route = route;
        match.params = params;
        return match;
      }
    }
    return null;
  }

  private Map<String, Object> matchRoutePath(String routePath, String actualPath) {
    String[] routeSegments = routePath.split("/");
    String[] actualSegments = actualPath.split("/");
    List<String> normalizedRoute = new ArrayList<>();
    List<String> normalizedActual = new ArrayList<>();
    for (String segment : routeSegments) {
      if (!segment.isBlank()) {
        normalizedRoute.add(segment);
      }
    }
    for (String segment : actualSegments) {
      if (!segment.isBlank()) {
        normalizedActual.add(segment);
      }
    }

    if (normalizedRoute.size() != normalizedActual.size()) {
      return null;
    }

    Map<String, Object> params = new LinkedHashMap<>();
    for (int index = 0; index < normalizedRoute.size(); index += 1) {
      String routeSegment = normalizedRoute.get(index);
      String actualSegment = normalizedActual.get(index);

      if (routeSegment.startsWith(":")) {
        params.put(routeSegment.substring(1), actualSegment);
        continue;
      }

      if (!routeSegment.equals(actualSegment)) {
        return null;
      }
    }

    return params;
  }

  private Object readRequestBody(HttpExchange exchange) throws Exception {
    byte[] bytes = exchange.getRequestBody().readAllBytes();
    if (bytes.length == 0) {
      return null;
    }

    String content = new String(bytes, StandardCharsets.UTF_8).trim();
    if (content.isEmpty()) {
      return null;
    }

    return MAPPER.readValue(content, Object.class);
  }

  private void sendJson(HttpExchange exchange, int statusCode, Object body) throws IOException {
    byte[] bytes = MAPPER.writerWithDefaultPrettyPrinter()
        .writeValueAsString(body)
        .getBytes(StandardCharsets.UTF_8);

    exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
    exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "content-type");
    exchange.getResponseHeaders().set("Cache-Control", "no-store");
    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
    exchange.sendResponseHeaders(statusCode, bytes.length);
    try (OutputStream outputStream = exchange.getResponseBody()) {
      outputStream.write(bytes);
    }
  }

  private void sendStructuredError(
      HttpExchange exchange,
      int statusCode,
      String code,
      String message,
      Object details
  ) throws IOException {
    Map<String, Object> error = new LinkedHashMap<>();
    error.put("code", code);
    error.put("message", message);
    if (details != null) {
      error.put("details", details);
    }

    sendJson(exchange, statusCode, Map.of(
        "success", false,
        "error", error
    ));
  }

  private static int mapErrorCodeToStatus(String code) {
    if ("INVALID_REQUEST".equals(code) || "VALIDATION_FAILED".equals(code)) {
      return 400;
    }
    if ("UNAUTHORIZED".equals(code)) {
      return 401;
    }
    if ("FORBIDDEN".equals(code)) {
      return 403;
    }
    if ("NOT_FOUND".equals(code)) {
      return 404;
    }
    if ("CONFLICT".equals(code)) {
      return 409;
    }
    return 500;
  }

  private static String stringValue(Object value, String fallback) {
    return value instanceof String stringValue ? stringValue : fallback;
  }

  private static Map<String, Object> errorMeta(Throwable error) {
    Map<String, Object> meta = new LinkedHashMap<>();
    meta.put("error", error == null || error.getMessage() == null ? "unknown" : error.getMessage());
    if (error != null) {
      meta.put("type", error.getClass().getName());
    }
    return meta;
  }

  private static final class RouteBinding {
    String method;
    String path;
    BaseApiCase.RouteHandler handler;
  }

  private static final class RouteMatch {
    RouteBinding route;
    Map<String, Object> params;
  }
}
