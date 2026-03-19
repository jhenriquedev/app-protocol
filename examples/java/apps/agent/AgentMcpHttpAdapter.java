package apps.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import core.shared.AppMcpContracts.AppMcpCallResult;
import core.shared.AppMcpContracts.AppMcpHttpExchange;
import core.shared.AppMcpContracts.AppMcpHttpResponse;
import core.shared.AppMcpContracts.AppMcpInitializeParams;
import core.shared.AppMcpContracts.AppMcpInitializeResult;
import core.shared.AppMcpContracts.AppMcpProtocolError;
import core.shared.AppMcpContracts.AppMcpReadResourceResult;
import core.shared.AppMcpContracts.AppMcpRequestContext;
import core.shared.AppMcpContracts.AppMcpResourceDescriptor;
import core.shared.AppMcpContracts.AppMcpServer;
import core.shared.AppMcpContracts.AppMcpToolDescriptor;
import core.shared.AppMcpContracts.BaseAppMcpHttpAdapter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class AgentMcpHttpAdapter extends BaseAppMcpHttpAdapter {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private record JsonRpcRequest(Object id, String method, Object params) {}
  private record JsonRpcNotification(String method, Object params) {}

  @Override
  public String transport() {
    return "streamable-http";
  }

  @Override
  public String endpointPath() {
    return "/mcp";
  }

  @Override
  public AppMcpHttpResponse handle(AppMcpHttpExchange exchange, AppMcpServer server) throws Exception {
    if (!endpointPath().equals(exchange.path)) {
      return null;
    }

    String method = exchange.method == null ? "GET" : exchange.method.toUpperCase();
    if ("GET".equals(method) || "DELETE".equals(method)) {
      AppMcpHttpResponse response = new AppMcpHttpResponse();
      response.statusCode = 405;
      response.headers = Map.of(
          "allow", "POST",
          "cache-control", "no-store"
      );
      return response;
    }

    if (!"POST".equals(method)) {
      AppMcpHttpResponse response = new AppMcpHttpResponse();
      response.statusCode = 405;
      response.headers = Map.of(
          "allow", "GET,POST,DELETE",
          "cache-control", "no-store"
      );
      return response;
    }

    if (exchange.bodyText == null || exchange.bodyText.trim().isBlank()) {
      return jsonResponse(400, failure(null, -32600, "Missing JSON-RPC payload.", null));
    }

    Object parsed;
    try {
      parsed = MAPPER.readValue(exchange.bodyText, Object.class);
    } catch (Exception error) {
      return jsonResponse(
          400,
          failure(null, -32700, "Invalid JSON-RPC payload.", error.getMessage())
      );
    }

    if (parsed instanceof List<?> list && list.isEmpty()) {
      return jsonResponse(400, failure(null, -32600, "Empty JSON-RPC batch payload is invalid.", null));
    }

    List<?> messages = parsed instanceof List<?> list ? list : List.of(parsed);
    List<Object> responses = new ArrayList<>();

    for (Object message : messages) {
      if (!isJsonRpcMessage(message)) {
        responses.add(failure(null, -32600, "Invalid JSON-RPC request shape.", null));
        continue;
      }

      @SuppressWarnings("unchecked")
      Map<String, Object> payload = (Map<String, Object>) message;
      boolean hasId = payload.containsKey("id");
      if (!hasId) {
        handleNotification(new JsonRpcNotification((String) payload.get("method"), payload.get("params")));
        continue;
      }

      JsonRpcRequest request = new JsonRpcRequest(payload.get("id"), (String) payload.get("method"), payload.get("params"));
      try {
        responses.add(handleRequest(request, server));
      } catch (AppMcpProtocolError error) {
        responses.add(failure(request.id(), error.code(), error.getMessage(), error.data()));
      } catch (Exception error) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("message", error.getMessage() == null ? "unknown" : error.getMessage());
        details.put("type", error.getClass().getName());
        responses.add(failure(
            request.id(),
            -32603,
            "Internal MCP server error.",
            details
        ));
      }
    }

    if (responses.isEmpty()) {
      AppMcpHttpResponse response = new AppMcpHttpResponse();
      response.statusCode = 202;
      response.headers = Map.of("cache-control", "no-store");
      return response;
    }

    return jsonResponse(200, responses.size() == 1 ? responses.get(0) : responses);
  }

  private Object handleRequest(JsonRpcRequest request, AppMcpServer server) throws Exception {
    AppMcpRequestContext context = toContext(request.id());

    return switch (request.method()) {
      case "initialize" -> success(
          request.id(),
          server.initialize(
              isInitializeParams(request.params()) ? toInitializeParams(request.params()) : null,
              context
          )
      );
      case "ping" -> success(request.id(), Map.of());
      case "tools/list" -> success(request.id(), Map.of("tools", server.listTools(context)));
      case "resources/list" -> success(request.id(), Map.of("resources", server.listResources(context)));
      case "resources/read" -> {
        String uri = requireStringParam(request.params(), "uri", "MCP resources/read requires a string resource uri.");
        yield success(request.id(), server.readResource(uri, context));
      }
      case "tools/call" -> {
        String name = requireStringParam(request.params(), "name", "MCP tools/call requires a string tool name.");
        Object arguments = request.params() instanceof Map<?, ?> map ? map.get("arguments") : null;
        yield success(request.id(), server.callTool(name, arguments, context));
      }
      default -> throw new AppMcpProtocolError(
          -32601,
          "MCP method " + request.method() + " is not implemented by this server."
      );
    };
  }

  private void handleNotification(JsonRpcNotification notification) {
    if (notification == null || notification.method() == null) {
      return;
    }
  }

  private static boolean isJsonRpcMessage(Object value) {
    if (!(value instanceof Map<?, ?> map)) {
      return false;
    }

    Object jsonrpc = map.get("jsonrpc");
    Object method = map.get("method");
    return "2.0".equals(jsonrpc) && method instanceof String;
  }

  private static boolean isInitializeParams(Object value) {
    if (!(value instanceof Map<?, ?> map)) {
      return false;
    }

    Object protocolVersion = map.get("protocolVersion");
    if (!(protocolVersion instanceof String)) {
      return false;
    }

    Object clientInfo = map.get("clientInfo");
    if (clientInfo == null) {
      return true;
    }

    if (!(clientInfo instanceof Map<?, ?> clientMap)) {
      return false;
    }

    return clientMap.get("name") instanceof String && clientMap.get("version") instanceof String;
  }

  private static AppMcpInitializeParams toInitializeParams(Object value) {
    @SuppressWarnings("unchecked")
    Map<String, Object> map = (Map<String, Object>) value;
    AppMcpInitializeParams params = new AppMcpInitializeParams();
    params.protocolVersion = (String) map.get("protocolVersion");
    @SuppressWarnings("unchecked")
    Map<String, Object> capabilities = map.get("capabilities") instanceof Map<?, ?>
        ? (Map<String, Object>) map.get("capabilities")
        : null;
    params.capabilities = capabilities;
    if (map.get("clientInfo") instanceof Map<?, ?> clientInfoValue) {
      @SuppressWarnings("unchecked")
      Map<String, Object> clientMap = (Map<String, Object>) clientInfoValue;
      params.clientInfo = new core.shared.AppMcpContracts.AppMcpClientInfo(
          String.valueOf(clientMap.get("name")),
          String.valueOf(clientMap.get("version"))
      );
    }
    return params;
  }

  private static String requireStringParam(Object params, String name, String message) {
    if (!(params instanceof Map<?, ?> map)) {
      throw new AppMcpProtocolError(-32602, message);
    }

    Object value = map.get(name);
    if (!(value instanceof String stringValue)) {
      throw new AppMcpProtocolError(-32602, message);
    }

    return stringValue;
  }

  private static AppMcpRequestContext toContext(Object requestId) {
    AppMcpRequestContext context = new AppMcpRequestContext();
    context.transport = "streamable-http";
    context.requestId = normalizeId(requestId);
    context.correlationId = UUID.randomUUID().toString();
    return context;
  }

  private static Object normalizeId(Object value) {
    return value instanceof String || value instanceof Number ? value : null;
  }

  private static Map<String, Object> success(Object id, Object result) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("jsonrpc", "2.0");
    payload.put("id", normalizeId(id));
    payload.put("result", result);
    return payload;
  }

  private static Map<String, Object> failure(Object id, int code, String message, Object data) {
    Map<String, Object> error = new LinkedHashMap<>();
    error.put("code", code);
    error.put("message", message);
    if (data != null) {
      error.put("data", data);
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("jsonrpc", "2.0");
    payload.put("id", normalizeId(id));
    payload.put("error", error);
    return payload;
  }

  private static AppMcpHttpResponse jsonResponse(int statusCode, Object body) throws Exception {
    AppMcpHttpResponse response = new AppMcpHttpResponse();
    response.statusCode = statusCode;
    response.headers = Map.of(
        "cache-control", "no-store",
        "content-type", "application/json; charset=utf-8"
    );
    response.bodyText = MAPPER.writeValueAsString(body);
    return response;
  }
}
