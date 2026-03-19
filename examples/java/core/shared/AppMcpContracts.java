package core.shared;

import core.BaseDomainCase.AppSchema;
import java.util.List;
import java.util.Map;

public final class AppMcpContracts {
  private AppMcpContracts() {}

  public record AppMcpClientInfo(String name, String version) {}

  public static class AppMcpServerInfo {
    public String name;
    public String version;
    public String protocolVersion;
    public String instructions;
  }

  public static class AppMcpInitializeParams {
    public String protocolVersion;
    public Map<String, Object> capabilities;
    public AppMcpClientInfo clientInfo;
  }

  public static class AppMcpInitializeResult {
    public String protocolVersion;
    public Map<String, Object> capabilities;
    public Map<String, Object> serverInfo;
    public String instructions;
  }

  public static class AppMcpTextContent {
    public String type = "text";
    public String text;
  }

  public static class AppMcpToolDescriptor {
    public String name;
    public String title;
    public String description;
    public AppSchema inputSchema;
    public AppSchema outputSchema;
    public Map<String, Object> annotations;
  }

  public static class AppMcpResourceDescriptor {
    public String uri;
    public String name;
    public String title;
    public String description;
    public String mimeType;
    public Map<String, Object> annotations;
  }

  public static class AppMcpTextResourceContent {
    public String uri;
    public String mimeType;
    public String text;
  }

  public static class AppMcpCallResult {
    public List<AppMcpTextContent> content;
    public Object structuredContent;
    public Boolean isError;
  }

  public static class AppMcpReadResourceResult {
    public List<AppMcpTextResourceContent> contents;
  }

  public static class AppMcpRequestContext {
    public String transport;
    public Object requestId;
    public String sessionId;
    public String correlationId;
    public AppMcpClientInfo clientInfo;
    public String protocolVersion;
  }

  public interface AppMcpServer {
    AppMcpServerInfo serverInfo();
    AppMcpInitializeResult initialize(
        AppMcpInitializeParams params,
        AppMcpRequestContext parent
    ) throws Exception;
    List<AppMcpToolDescriptor> listTools(AppMcpRequestContext parent) throws Exception;
    List<AppMcpResourceDescriptor> listResources(AppMcpRequestContext parent) throws Exception;
    AppMcpReadResourceResult readResource(String uri, AppMcpRequestContext parent) throws Exception;
    AppMcpCallResult callTool(String name, Object args, AppMcpRequestContext parent) throws Exception;
  }

  public abstract static class BaseAppMcpAdapter {
    public abstract String transport();
  }

  public abstract static class BaseAppMcpProcessAdapter extends BaseAppMcpAdapter {
    public abstract void serve(AppMcpServer server) throws Exception;
  }

  public static class AppMcpHttpExchange {
    public String method;
    public String path;
    public Map<String, String> headers;
    public String bodyText;
  }

  public static class AppMcpHttpResponse {
    public int statusCode;
    public Map<String, String> headers;
    public String bodyText;
  }

  public abstract static class BaseAppMcpHttpAdapter extends BaseAppMcpAdapter {
    public abstract String endpointPath();
    public abstract AppMcpHttpResponse handle(
        AppMcpHttpExchange exchange,
        AppMcpServer server
    ) throws Exception;
  }

  public static class AppMcpProtocolError extends RuntimeException {
    private final int code;
    private final Object data;

    public AppMcpProtocolError(int code, String message) {
      this(code, message, null);
    }

    public AppMcpProtocolError(int code, String message, Object data) {
      super(message);
      this.code = code;
      this.data = data;
    }

    public int code() {
      return code;
    }

    public Object data() {
      return data;
    }
  }
}
