package apps.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import core.shared.AppMcpContracts.AppMcpInitializeParams;
import core.shared.AppMcpContracts.AppMcpProtocolError;
import core.shared.AppMcpContracts.AppMcpRequestContext;
import core.shared.AppMcpContracts.AppMcpServer;
import core.shared.AppMcpContracts.BaseAppMcpProcessAdapter;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public final class AgentMcpStdioAdapter extends BaseAppMcpProcessAdapter {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private enum SessionPhase {
    AWAITING_INITIALIZE,
    AWAITING_INITIALIZED_NOTIFICATION,
    READY
  }

  @Override
  public String transport() {
    return "stdio";
  }

  @Override
  public void serve(AppMcpServer server) throws Exception {
    String sessionId = UUID.randomUUID().toString();
    BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
    PrintWriter writer = new PrintWriter(System.out, true, StandardCharsets.UTF_8);
    SessionState state = new SessionState(sessionId);

    String line;
    while ((line = reader.readLine()) != null) {
      String trimmed = line.trim();
      if (trimmed.isEmpty()) {
        continue;
      }

      Object parsed;
      try {
        parsed = MAPPER.readValue(trimmed, Object.class);
      } catch (Exception error) {
        write(writer, failure(null, -32700, "Invalid JSON-RPC payload.", error.getMessage()));
        continue;
      }

      if (parsed instanceof java.util.List<?>) {
        write(writer, failure(null, -32600, "MCP stdio transport does not accept JSON-RPC batch payloads.", null));
        continue;
      }

      if (!isJsonRpcMessage(parsed)) {
        write(writer, failure(null, -32600, "Invalid JSON-RPC request shape for MCP stdio transport.", null));
        continue;
      }

      @SuppressWarnings("unchecked")
      Map<String, Object> payload = (Map<String, Object>) parsed;
      boolean hasId = payload.containsKey("id");
      if (!hasId) {
        handleNotification(state, payload);
        continue;
      }

      Object requestId = normalizeId(payload.get("id"));
      try {
        Map<String, Object> response = handleRequest(
            state,
            requestId,
            (String) payload.get("method"),
            payload.get("params"),
            server
        );
        write(writer, response);
      } catch (AppMcpProtocolError error) {
        write(writer, failure(requestId, error.code(), error.getMessage(), error.data()));
      } catch (Exception error) {
        System.err.println("[agent:mcp] unhandled request error: " + error.getMessage());
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("message", error.getMessage() == null ? "unknown" : error.getMessage());
        details.put("type", error.getClass().getName());
        write(writer, failure(
            requestId,
            -32603,
            "Internal MCP server error.",
            details
        ));
      }
    }
  }

  private Map<String, Object> handleRequest(
      SessionState state,
      Object requestId,
      String method,
      Object params,
      AppMcpServer server
  ) throws Exception {
    AppMcpRequestContext context = state.toContext(requestId);

    return switch (method) {
      case "initialize" -> {
        if (state.phase != SessionPhase.AWAITING_INITIALIZE) {
          throw new AppMcpProtocolError(
              -32600,
              "MCP initialize may only run once per stdio session."
          );
        }

        AppMcpInitializeParams initializeParams = AgentMcpHttpAdapter_isInitializeParams(params)
            ? AgentMcpHttpAdapter_toInitializeParams(params)
            : null;
        Object result = server.initialize(initializeParams, context);
        if (result instanceof core.shared.AppMcpContracts.AppMcpInitializeResult initializeResult) {
          state.protocolVersion = initializeResult.protocolVersion;
        }
        if (params instanceof Map<?, ?> map && map.get("clientInfo") instanceof Map<?, ?> clientInfoValue) {
          @SuppressWarnings("unchecked")
          Map<String, Object> clientInfo = (Map<String, Object>) clientInfoValue;
          state.clientInfo = new core.shared.AppMcpContracts.AppMcpClientInfo(
              String.valueOf(clientInfo.get("name")),
              String.valueOf(clientInfo.get("version"))
          );
        }
        state.phase = SessionPhase.AWAITING_INITIALIZED_NOTIFICATION;
        yield success(requestId, result);
      }
      case "ping" -> {
        ensureReady(state);
        yield success(requestId, Map.of());
      }
      case "tools/list" -> {
        ensureReady(state);
        yield success(requestId, Map.of("tools", server.listTools(context)));
      }
      case "resources/list" -> {
        ensureReady(state);
        yield success(requestId, Map.of("resources", server.listResources(context)));
      }
      case "resources/read" -> {
        ensureReady(state);
        String uri = requireStringParam(params, "uri", "MCP resources/read requires a string resource uri.");
        yield success(requestId, server.readResource(uri, context));
      }
      case "tools/call" -> {
        ensureReady(state);
        String name = requireStringParam(params, "name", "MCP tools/call requires a string tool name.");
        Object arguments = params instanceof Map<?, ?> map ? map.get("arguments") : null;
        yield success(requestId, server.callTool(name, arguments, context));
      }
      default -> throw new AppMcpProtocolError(
          -32601,
          "MCP method " + method + " is not implemented by this server."
      );
    };
  }

  private void handleNotification(SessionState state, Map<String, Object> payload) {
    Object method = payload.get("method");
    if (!("notifications/initialized".equals(method) || "notifications/cancelled".equals(method))) {
      return;
    }

    if ("notifications/initialized".equals(method)
        && state.phase == SessionPhase.AWAITING_INITIALIZED_NOTIFICATION) {
      state.phase = SessionPhase.READY;
    }
  }

  private static void ensureReady(SessionState state) {
    if (state.phase != SessionPhase.READY) {
      throw new AppMcpProtocolError(
          -32002,
          "MCP session is not ready; complete initialization first."
      );
    }
  }

  private static boolean isJsonRpcMessage(Object value) {
    if (!(value instanceof Map<?, ?> map)) {
      return false;
    }

    return "2.0".equals(map.get("jsonrpc")) && map.get("method") instanceof String;
  }

  private static String requireStringParam(Object params, String name, String message) {
    if (!(params instanceof Map<?, ?> map) || !(map.get(name) instanceof String stringValue)) {
      throw new AppMcpProtocolError(-32602, message);
    }
    return stringValue;
  }

  private static void write(PrintWriter writer, Object body) throws Exception {
    writer.println(MAPPER.writeValueAsString(body));
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

  private static boolean AgentMcpHttpAdapter_isInitializeParams(Object value) {
    if (!(value instanceof Map<?, ?> map)) {
      return false;
    }

    if (!(map.get("protocolVersion") instanceof String)) {
      return false;
    }

    Object clientInfo = map.get("clientInfo");
    if (clientInfo == null) {
      return true;
    }

    return clientInfo instanceof Map<?, ?> clientMap
        && clientMap.get("name") instanceof String
        && clientMap.get("version") instanceof String;
  }

  private static AppMcpInitializeParams AgentMcpHttpAdapter_toInitializeParams(Object value) {
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

  private static final class SessionState {
    private final String sessionId;
    private SessionPhase phase = SessionPhase.AWAITING_INITIALIZE;
    private String protocolVersion;
    private core.shared.AppMcpContracts.AppMcpClientInfo clientInfo;

    private SessionState(String sessionId) {
      this.sessionId = sessionId;
    }

    private AppMcpRequestContext toContext(Object requestId) {
      AppMcpRequestContext context = new AppMcpRequestContext();
      context.transport = "stdio";
      context.requestId = normalizeId(requestId);
      context.sessionId = sessionId;
      context.correlationId = UUID.randomUUID().toString();
      context.clientInfo = clientInfo;
      context.protocolVersion = protocolVersion;
      return context;
    }
  }
}
