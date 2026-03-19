package apps.portal;

import cases.tasks.task_create.TaskCreateUiCase;
import cases.tasks.task_list.TaskListUiCase;
import cases.tasks.task_move.TaskMoveUiCase;
import com.fasterxml.jackson.databind.ObjectMapper;
import core.shared.AppHostContracts.AppCaseSurfaces;
import core.shared.AppHostContracts.AppRegistry;
import core.shared.AppInfraContracts.AppHttpClient;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import packages.design_system.DesignSystem;

public final class PortalRegistry implements AppRegistry {
  public static final class PortalConfig {
    public String apiBaseUrl = "http://localhost:3000";
    public int port = 5173;
  }

  private final Map<String, Map<String, AppCaseSurfaces>> cases;
  private final Map<String, Object> providers;
  private final Map<String, Object> packages;

  private PortalRegistry(
      Map<String, Map<String, AppCaseSurfaces>> cases,
      Map<String, Object> providers,
      Map<String, Object> packages
  ) {
    this.cases = cases;
    this.providers = providers;
    this.packages = packages;
  }

  public static PortalRegistry createRegistry(PortalConfig config) {
    Map<String, Map<String, AppCaseSurfaces>> cases = new LinkedHashMap<>();
    Map<String, AppCaseSurfaces> taskCases = new LinkedHashMap<>();
    taskCases.put("task_create", new AppCaseSurfaces().ui(TaskCreateUiCase::new));
    taskCases.put("task_list", new AppCaseSurfaces().ui(TaskListUiCase::new));
    taskCases.put("task_move", new AppCaseSurfaces().ui(TaskMoveUiCase::new));
    cases.put("tasks", taskCases);

    Map<String, Object> providers = new LinkedHashMap<>();
    providers.put("httpClient", new FetchHttpAdapter(config.apiBaseUrl));
    providers.put("port", config.port);
    providers.put("apiBaseUrl", config.apiBaseUrl);

    Map<String, Object> packages = new LinkedHashMap<>();
    packages.put("designSystem", new PortalDesignSystemPackage(new DesignSystem()));

    return new PortalRegistry(cases, providers, packages);
  }

  @Override
  public Map<String, Map<String, AppCaseSurfaces>> cases() {
    return cases;
  }

  @Override
  public Map<String, Object> providers() {
    return providers;
  }

  @Override
  public Map<String, Object> packages() {
    return packages;
  }

  public static final class FetchHttpAdapter implements AppHttpClient {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String baseUrl;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    private FetchHttpAdapter(String baseUrl) {
      this.baseUrl = baseUrl;
    }

    @Override
    public Object request(Object config) throws Exception {
      if (!(config instanceof Map<?, ?> requestMap)) {
        throw new IllegalArgumentException("Portal HTTP config must be a map");
      }

      Object methodValue = requestMap.containsKey("method") ? requestMap.get("method") : "GET";
      String method = String.valueOf(methodValue);
      String url = String.valueOf(requestMap.get("url"));
      Object body = requestMap.get("body");

      HttpRequest.Builder builder = HttpRequest.newBuilder()
          .uri(URI.create(baseUrl + url))
          .header("content-type", "application/json");

      if ("GET".equalsIgnoreCase(method)) {
        builder.GET();
      } else {
        builder.method(method.toUpperCase(), body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(body)));
      }

      HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
      String payload = response.body() == null ? "" : response.body();
      Map<?, ?> decoded = payload.isBlank()
          ? Map.of()
          : MAPPER.readValue(payload, Map.class);

      if (response.statusCode() >= 400) {
        String message = extractErrorMessage(decoded, "HTTP " + response.statusCode() + " while requesting " + url);
        throw new IOException(message);
      }

      Object success = decoded.get("success");
      if (success instanceof Boolean successValue) {
        if (!successValue) {
          throw new IOException(extractErrorMessage(decoded, "Request failed"));
        }
        return decoded.get("data");
      }

      return decoded;
    }

    private String extractErrorMessage(Map<?, ?> payload, String fallback) {
      Object errorValue = payload.get("error");
      if (errorValue instanceof Map<?, ?> errorMap) {
        Object message = errorMap.get("message");
        if (message instanceof String stringMessage && !stringMessage.isBlank()) {
          return stringMessage;
        }
      }

      Object message = payload.get("message");
      if (message instanceof String stringMessage && !stringMessage.isBlank()) {
        return stringMessage;
      }

      return fallback;
    }
  }

  public static final class PortalDesignSystemPackage
      implements TaskCreateUiCase.DesignSystemContract,
      TaskListUiCase.DesignSystemContract,
      TaskMoveUiCase.DesignSystemContract {
    private final DesignSystem designSystem;

    private PortalDesignSystemPackage(DesignSystem designSystem) {
      this.designSystem = designSystem;
    }

    public String appShell(String title, String subtitle, String actionsHtml, String bodyHtml) {
      return designSystem.appShell(title, subtitle, actionsHtml, bodyHtml);
    }

    public String boardHeader(String title, String subtitle) {
      return designSystem.boardHeader(title, subtitle);
    }

    @Override
    public String feedback(String type, String message) {
      return designSystem.feedback(type, message);
    }

    @Override
    public String createTaskButton(String href, boolean disabled) {
      return designSystem.createTaskButton(href, disabled);
    }

    @Override
    public String createTaskRow(String buttonHtml) {
      return designSystem.createTaskRow(buttonHtml);
    }

    @Override
    public String taskFormModal(
        boolean open,
        String action,
        String titleValue,
        String descriptionValue,
        String errorMessage,
        String cancelHref,
        boolean submitting
    ) {
      return designSystem.taskFormModal(
          open,
          action,
          titleValue,
          descriptionValue,
          errorMessage,
          cancelHref,
          submitting
      );
    }

    @Override
    public String taskBoard(String columnsHtml) {
      return designSystem.taskBoard(columnsHtml);
    }

    @Override
    public String taskColumn(String title, int count, String itemsHtml) {
      return designSystem.taskColumn(title, count, itemsHtml);
    }

    @Override
    public String taskCard(String title, String description, String status, String actionsHtml) {
      return designSystem.taskCard(title, description, status, actionsHtml);
    }

    @Override
    public String emptyColumnState(String message) {
      return designSystem.emptyColumnState(message);
    }

    @Override
    public String moveTaskAction(String buttonsHtml) {
      return designSystem.moveTaskAction(buttonsHtml);
    }
  }
}
