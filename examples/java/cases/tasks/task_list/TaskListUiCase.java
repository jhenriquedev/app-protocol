package cases.tasks.task_list;

import core.BaseUiCase;
import core.shared.AppBaseContext.AppLogger;
import core.shared.AppInfraContracts.AppHttpClient;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class TaskListUiCase extends BaseUiCase<TaskListUiCase.ViewState> {
  public interface DesignSystemContract {
    String feedback(String type, String message);
    String taskBoard(String columnsHtml);
    String taskColumn(String title, int count, String itemsHtml);
    String taskCard(String title, String description, String status, String actionsHtml);
    String emptyColumnState(String message);
  }

  @FunctionalInterface
  public interface RenderCardActions {
    String render(TaskListDomainCase.Task task) throws Exception;
  }

  public static class ViewState {
    public List<TaskListDomainCase.Task> tasks = List.of();
    public boolean loading;
    public String error;
  }

  public static class ColumnViewModel {
    public String status;
    public String title;
    public List<TaskListDomainCase.Task> tasks = List.of();
    public String emptyMessage;
  }

  public static class ViewModel {
    public List<ColumnViewModel> columns = List.of();
    public String feedback;
  }

  public TaskListUiCase(UiContext ctx) {
    super(ctx, new ViewState());
  }

  @Override
  public String view() throws Exception {
    DesignSystemContract designSystem = resolveDesignSystem();
    ViewState currentState = new ViewState();
    currentState.loading = true;

    try {
      TaskListDomainCase.TaskListOutput result = load(new TaskListDomainCase.TaskListInput());
      currentState.tasks = result.tasks();
      currentState.loading = false;
    } catch (Exception error) {
      currentState.tasks = List.of();
      currentState.loading = false;
      currentState.error = error.getMessage();
    }

    ViewModel model = _viewmodel(currentState);
    RenderCardActions renderCardActions = resolveRenderCardActions();

    StringBuilder columnsHtml = new StringBuilder();
    for (ColumnViewModel column : model.columns) {
      StringBuilder itemsHtml = new StringBuilder();
      if (!column.tasks.isEmpty()) {
        for (TaskListDomainCase.Task task : column.tasks) {
          String actionsHtml = renderCardActions == null ? "" : renderCardActions.render(task);
          itemsHtml.append(designSystem.taskCard(
              task.title(),
              task.description(),
              task.status(),
              actionsHtml
          ));
        }
      } else {
        itemsHtml.append(designSystem.emptyColumnState(column.emptyMessage));
      }

      columnsHtml.append(
          designSystem.taskColumn(column.title, column.tasks.size(), itemsHtml.toString())
      );
    }

    return designSystem.feedback("error", model.feedback)
        + designSystem.taskBoard(columnsHtml.toString());
  }

  @Override
  public void test() throws Exception {
    UiContext testContext = new UiContext();
    testContext.correlationId = "task-list-ui-test";
    testContext.logger = new NoopLogger();
    testContext.api = config -> Map.of(
        "tasks", List.of(
            Map.of(
                "id", "task_001",
                "title", "Todo task",
                "status", "todo",
                "createdAt", "2026-03-18T12:00:00.000Z",
                "updatedAt", "2026-03-18T12:00:00.000Z"
            ),
            Map.of(
                "id", "task_002",
                "title", "Doing task",
                "status", "doing",
                "createdAt", "2026-03-18T12:10:00.000Z",
                "updatedAt", "2026-03-18T12:10:00.000Z"
            )
        )
    );
    testContext.packages.put("designSystem", new DesignSystemContract() {
      @Override
      public String feedback(String type, String message) {
        return message == null || message.isBlank() ? "" : "<div>" + message + "</div>";
      }

      @Override
      public String taskBoard(String columnsHtml) {
        return "<section>" + columnsHtml + "</section>";
      }

      @Override
      public String taskColumn(String title, int count, String itemsHtml) {
        return "<div>" + title + count + itemsHtml + "</div>";
      }

      @Override
      public String taskCard(String title, String description, String status, String actionsHtml) {
        return "<article>" + title + status + actionsHtml + "</article>";
      }

      @Override
      public String emptyColumnState(String message) {
        return "<div>" + message + "</div>";
      }
    });

    TaskListUiCase uiCase = new TaskListUiCase(testContext);
    String view = uiCase.view();
    if (view == null || view.isBlank()) {
      throw new IllegalStateException("test: view must return a visual unit");
    }

    TaskListDomainCase.TaskListOutput result = uiCase.load(new TaskListDomainCase.TaskListInput());
    if (result.tasks().size() != 2) {
      throw new IllegalStateException("test: ui service must return the mocked task list");
    }

    ViewState viewState = new ViewState();
    viewState.tasks = result.tasks();
    viewState.loading = false;
    ViewModel viewModel = uiCase._viewmodel(viewState);

    long todoCount = viewModel.columns.stream()
        .filter(column -> "todo".equals(column.status))
        .findFirst()
        .orElseThrow()
        .tasks
        .size();
    long doingCount = viewModel.columns.stream()
        .filter(column -> "doing".equals(column.status))
        .findFirst()
        .orElseThrow()
        .tasks
        .size();

    if (todoCount != 1 || doingCount != 1) {
      throw new IllegalStateException("test: ui viewmodel must group tasks by status");
    }
  }

  public TaskListDomainCase.TaskListOutput load(TaskListDomainCase.TaskListInput input) throws Exception {
    return _service(input);
  }

  protected ViewModel _viewmodel(ViewState currentState) {
    ViewModel model = new ViewModel();
    model.feedback = currentState.error;
    model.columns = List.of(
        column("todo", "To Do", currentState, currentState.tasks.stream()
            .filter(task -> "todo".equals(task.status()))
            .toList()),
        column("doing", "Doing", currentState, currentState.tasks.stream()
            .filter(task -> "doing".equals(task.status()))
            .toList()),
        column("done", "Done", currentState, currentState.tasks.stream()
            .filter(task -> "done".equals(task.status()))
            .toList())
    );
    return model;
  }

  protected TaskListDomainCase.TaskListOutput _service(
      TaskListDomainCase.TaskListInput input
  ) throws Exception {
    TaskListDomainCase domainCase = new TaskListDomainCase();
    domainCase.validate(input);
    return _repository(input);
  }

  protected TaskListDomainCase.TaskListOutput _repository(
      TaskListDomainCase.TaskListInput input
  ) throws Exception {
    Object response = resolveApiClient().request(Map.of(
        "method", "GET",
        "url", "/tasks"
    ));

    if (!(response instanceof Map<?, ?> mapResponse)) {
      throw new IllegalStateException("task_list.ui received an invalid list response");
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> output = (Map<String, Object>) mapResponse;
    TaskListDomainCase.TaskListOutput result = TaskListDomainCase.TaskListOutput.fromMap(output);
    new TaskListDomainCase().validateOutput(result);
    return result;
  }

  private ColumnViewModel column(
      String status,
      String title,
      ViewState currentState,
      List<TaskListDomainCase.Task> tasks
  ) {
    ColumnViewModel column = new ColumnViewModel();
    column.status = status;
    column.title = title;
    column.tasks = tasks;
    column.emptyMessage = currentState.loading
        ? "Loading cards..."
        : "No cards in " + status + ".";
    return column;
  }

  private DesignSystemContract resolveDesignSystem() {
    Object value = ctx.packages.get("designSystem");
    if (!(value instanceof DesignSystemContract designSystem)) {
      throw new IllegalStateException("task_list.ui requires packages.designSystem");
    }
    return designSystem;
  }

  private RenderCardActions resolveRenderCardActions() {
    Object value = ctx.extra.get("renderCardActions");
    if (value == null) {
      return null;
    }

    if (!(value instanceof RenderCardActions renderCardActions)) {
      throw new IllegalStateException("task_list.ui requires a valid renderCardActions callback");
    }

    return renderCardActions;
  }

  private AppHttpClient resolveApiClient() {
    if (ctx.api == null) {
      throw new IllegalStateException("task_list.ui requires ctx.api");
    }

    return ctx.api;
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
