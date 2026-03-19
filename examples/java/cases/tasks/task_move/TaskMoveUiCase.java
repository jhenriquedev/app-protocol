package cases.tasks.task_move;

import core.BaseUiCase;
import core.shared.AppBaseContext.AppLogger;
import core.shared.AppInfraContracts.AppHttpClient;
import java.util.Map;

public class TaskMoveUiCase extends BaseUiCase<TaskMoveUiCase.ViewState> {
  public interface DesignSystemContract {
    String moveTaskAction(String buttonsHtml);
    String feedback(String type, String message);
  }

  public static class ViewState {
    public boolean loading;
    public String error;
  }

  public TaskMoveUiCase(UiContext ctx) {
    super(ctx, new ViewState());
  }

  @Override
  public String view() {
    DesignSystemContract designSystem = resolveDesignSystem();
    TaskMoveDomainCase.Task task = resolveTask();
    StringBuilder buttons = new StringBuilder();
    for (String status : TaskMoveDomainCase.TASK_STATUS_VALUES) {
      boolean disabled = status.equals(task.status());
      buttons.append("""
          <form method="post" action="/tasks/%s/status">
            <input type="hidden" name="targetStatus" value="%s" />
            <button type="submit" %s>%s</button>
          </form>
          """.formatted(
          task.id(),
          status,
          disabled ? "disabled" : "",
          status
      ));
    }

    String feedback = state.error == null ? "" : designSystem.feedback("error", state.error);
    return "<div>" + designSystem.moveTaskAction(buttons.toString()) + feedback + "</div>";
  }

  @Override
  public void test() throws Exception {
    UiContext testContext = new UiContext();
    testContext.correlationId = "task-move-ui-test";
    testContext.logger = new NoopLogger();
    testContext.api = config -> Map.of(
        "task", Map.of(
            "id", "task_001",
            "title", "Moved task",
            "status", "doing",
            "createdAt", "2026-03-18T12:00:00.000Z",
            "updatedAt", "2026-03-18T12:10:00.000Z"
        )
    );
    testContext.packages.put("designSystem", new DesignSystemContract() {
      @Override
      public String moveTaskAction(String buttonsHtml) {
        return "<div>" + buttonsHtml + "</div>";
      }

      @Override
      public String feedback(String type, String message) {
        return message == null || message.isBlank() ? "" : "<div>" + message + "</div>";
      }
    });
    testContext.extra.put("task", new TaskMoveDomainCase.Task(
        "task_001",
        "Todo task",
        null,
        "todo",
        "2026-03-18T12:00:00.000Z",
        "2026-03-18T12:00:00.000Z"
    ));

    TaskMoveUiCase uiCase = new TaskMoveUiCase(testContext);
    String view = uiCase.view();
    if (view == null || view.isBlank()) {
      throw new IllegalStateException("test: view must return a visual unit");
    }

    TaskMoveDomainCase.TaskMoveOutput result = uiCase.submit(
        new TaskMoveDomainCase.TaskMoveInput("task_001", "doing")
    );
    if (!"doing".equals(result.task().status())) {
      throw new IllegalStateException("test: ui service must return the moved task");
    }

    boolean rejected = false;
    try {
      uiCase.submit(new TaskMoveDomainCase.TaskMoveInput("", "done"));
    } catch (IllegalArgumentException ignored) {
      rejected = true;
    }

    if (!rejected) {
      throw new IllegalStateException("test: ui service must reject invalid input");
    }
  }

  public TaskMoveDomainCase.TaskMoveOutput submit(
      TaskMoveDomainCase.TaskMoveInput input
  ) throws Exception {
    return _service(input);
  }

  protected TaskMoveDomainCase.TaskMoveOutput _service(
      TaskMoveDomainCase.TaskMoveInput input
  ) throws Exception {
    TaskMoveDomainCase domainCase = new TaskMoveDomainCase();
    domainCase.validate(input);
    return _repository(input);
  }

  protected TaskMoveDomainCase.TaskMoveOutput _repository(
      TaskMoveDomainCase.TaskMoveInput input
  ) throws Exception {
    Object response = resolveApiClient().request(Map.of(
        "method", "PATCH",
        "url", "/tasks/" + input.taskId() + "/status",
        "body", Map.of("targetStatus", input.targetStatus())
    ));

    if (!(response instanceof Map<?, ?> mapResponse)) {
      throw new IllegalStateException("task_move.ui received an invalid move response");
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> output = (Map<String, Object>) mapResponse;
    return TaskMoveDomainCase.TaskMoveOutput.fromMap(output);
  }

  private TaskMoveDomainCase.Task resolveTask() {
    Object value = ctx.extra.get("task");
    if (!(value instanceof TaskMoveDomainCase.Task task)) {
      throw new IllegalStateException("task_move.ui requires extra.task");
    }
    return task;
  }

  private DesignSystemContract resolveDesignSystem() {
    Object value = ctx.packages.get("designSystem");
    if (!(value instanceof DesignSystemContract designSystem)) {
      throw new IllegalStateException("task_move.ui requires packages.designSystem");
    }
    return designSystem;
  }

  private AppHttpClient resolveApiClient() {
    if (ctx.api == null) {
      throw new IllegalStateException("task_move.ui requires ctx.api");
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
