package cases.tasks.task_create;

import core.BaseUiCase;
import core.shared.AppBaseContext.AppLogger;
import core.shared.AppInfraContracts.AppHttpClient;
import java.util.Map;

public class TaskCreateUiCase extends BaseUiCase<TaskCreateUiCase.ViewState> {
  public interface DesignSystemContract {
    String feedback(String type, String message);
    String createTaskButton(String href, boolean disabled);
    String createTaskRow(String buttonHtml);
    String taskFormModal(
        boolean open,
        String action,
        String titleValue,
        String descriptionValue,
        String errorMessage,
        String cancelHref,
        boolean submitting
    );
  }

  public static class ViewState {
    public boolean modalOpen;
    public String title = "";
    public String description = "";
    public boolean loading;
    public String error;
    public String successMessage;
    public TaskCreateDomainCase.TaskCreateOutput result;
  }

  public TaskCreateUiCase(UiContext ctx) {
    super(ctx, new ViewState());
  }

  @Override
  public String view() {
    DesignSystemContract designSystem = resolveDesignSystem();
    ViewState currentState = fromExtra();
    ViewModel viewModel = _viewmodel(currentState);

    return designSystem.feedback("success", viewModel.successMessage)
        + designSystem.createTaskRow(
            designSystem.createTaskButton("/?create=open", currentState.loading)
        )
        + designSystem.taskFormModal(
            currentState.modalOpen,
            "/tasks",
            currentState.title,
            currentState.description,
            viewModel.errorMessage,
            "/",
            currentState.loading
        );
  }

  @Override
  public void test() throws Exception {
    UiContext testContext = new UiContext();
    testContext.correlationId = "task-create-ui-test";
    testContext.logger = new NoopLogger();
    testContext.api = config -> Map.of(
        "task", Map.of(
            "id", "task_001",
            "title", "Create task UI test",
            "status", "todo",
            "createdAt", "2026-03-18T12:00:00.000Z",
            "updatedAt", "2026-03-18T12:00:00.000Z"
        )
    );
    testContext.packages.put("designSystem", new DesignSystemContract() {
      @Override
      public String feedback(String type, String message) {
        return message == null || message.isBlank() ? "" : "<div>" + message + "</div>";
      }

      @Override
      public String createTaskButton(String href, boolean disabled) {
        return "<a href=\"" + href + "\">New Task</a>";
      }

      @Override
      public String createTaskRow(String buttonHtml) {
        return "<section>" + buttonHtml + "</section>";
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
        return open ? "<form action=\"" + action + "\"></form>" : "";
      }
    });

    TaskCreateUiCase uiCase = new TaskCreateUiCase(testContext);
    String view = uiCase.view();
    if (view == null || view.isBlank()) {
      throw new IllegalStateException("test: view must return a visual unit");
    }

    TaskCreateDomainCase.TaskCreateOutput result = uiCase.submit(
        new TaskCreateDomainCase.TaskCreateInput(
            "Create task UI test",
            "UI surface repository flow"
        )
    );

    if (result.task().id() == null || result.task().id().isBlank()) {
      throw new IllegalStateException("test: ui service must return a created task id");
    }

    ViewState state = new ViewState();
    state.result = result;
    ViewModel viewModel = uiCase._viewmodel(state);
    if (viewModel.successMessage == null || !viewModel.successMessage.contains("created successfully")) {
      throw new IllegalStateException("test: ui viewmodel must expose success feedback");
    }

    boolean rejected = false;
    try {
      uiCase.submit(new TaskCreateDomainCase.TaskCreateInput("   ", null));
    } catch (IllegalArgumentException ignored) {
      rejected = true;
    }

    if (!rejected) {
      throw new IllegalStateException("test: ui service must reject blank title");
    }
  }

  public TaskCreateDomainCase.TaskCreateOutput submit(
      TaskCreateDomainCase.TaskCreateInput input
  ) throws Exception {
    return _service(input);
  }

  protected ViewModel _viewmodel(ViewState currentState) {
    ViewModel model = new ViewModel();
    model.errorMessage = currentState.error;

    if (currentState.result != null) {
      model.successMessage = "Task \"" + currentState.result.task().title() + "\" created successfully.";
    } else {
      model.successMessage = currentState.successMessage;
    }

    return model;
  }

  protected TaskCreateDomainCase.TaskCreateOutput _service(
      TaskCreateDomainCase.TaskCreateInput input
  ) throws Exception {
    TaskCreateDomainCase domainCase = new TaskCreateDomainCase();
    domainCase.validate(input);
    return _repository(input);
  }

  protected TaskCreateDomainCase.TaskCreateOutput _repository(
      TaskCreateDomainCase.TaskCreateInput input
  ) throws Exception {
    Object response = resolveApiClient().request(Map.of(
        "method", "POST",
        "url", "/tasks",
        "body", Map.of(
            "title", input.title(),
            "description", input.description()
        )
    ));

    if (!(response instanceof Map<?, ?> mapResponse)) {
      throw new IllegalStateException("task_create.ui received an invalid create response");
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> output = (Map<String, Object>) mapResponse;
    return TaskCreateDomainCase.TaskCreateOutput.fromMap(output);
  }

  private ViewState fromExtra() {
    ViewState currentState = new ViewState();
    currentState.modalOpen = Boolean.TRUE.equals(ctx.extra.get("modalOpen"));
    currentState.title = stringExtra("title");
    currentState.description = stringExtra("description");
    currentState.error = stringExtra("errorMessage");
    currentState.successMessage = stringExtra("successMessage");
    return currentState;
  }

  private String stringExtra(String key) {
    Object value = ctx.extra.get(key);
    return value instanceof String stringValue ? stringValue : "";
  }

  private DesignSystemContract resolveDesignSystem() {
    Object value = ctx.packages.get("designSystem");
    if (!(value instanceof DesignSystemContract designSystem)) {
      throw new IllegalStateException("task_create.ui requires packages.designSystem");
    }
    return designSystem;
  }

  private AppHttpClient resolveApiClient() {
    if (ctx.api == null) {
      throw new IllegalStateException("task_create.ui requires ctx.api");
    }
    return ctx.api;
  }

  protected static class ViewModel {
    public String errorMessage;
    public String successMessage;
  }

  private static final class NoopLogger implements AppLogger {
    @Override
    public void debug(String message, Map<String, Object> meta) {}

    @Override
    public void info(String message, Map<String, Object> meta) {}

    @Override
    public void warn(String message, Map<String, Object> meta) {}

    @Override
    public void error(String message, Map<String, Object> meta) {}
  }
}
