package cases.tasks.task_create;

import core.BaseApiCase;
import core.shared.AppBaseContext.AppLogger;
import core.shared.AppStructuralContracts.AppCaseError;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class TaskCreateApiCase
    extends BaseApiCase<TaskCreateDomainCase.TaskCreateInput, TaskCreateDomainCase.TaskCreateOutput> {
  public interface TaskStore {
    List<Map<String, Object>> read() throws Exception;
    void write(List<Map<String, Object>> value) throws Exception;
    void reset() throws Exception;
    List<Map<String, Object>> update(TaskUpdater updater) throws Exception;
  }

  @FunctionalInterface
  public interface TaskUpdater {
    List<Map<String, Object>> apply(List<Map<String, Object>> current) throws Exception;
  }

  private final TaskCreateDomainCase domainCase = new TaskCreateDomainCase();

  public TaskCreateApiCase(ApiContext ctx) {
    super(ctx);
  }

  @Override
  public ApiResponse<TaskCreateDomainCase.TaskCreateOutput> handler(
      TaskCreateDomainCase.TaskCreateInput input
  ) throws Exception {
    ApiResponse<TaskCreateDomainCase.TaskCreateOutput> result = execute(input);
    if (result.success) {
      result.statusCode = 201;
      return result;
    }

    result.statusCode = mapErrorCodeToStatus(result.error == null ? null : result.error.code());
    return result;
  }

  @Override
  public Object router() {
    Map<String, Object> route = new LinkedHashMap<>();
    route.put("method", "POST");
    route.put("path", "/tasks");
    route.put("handler", (RouteHandler) request -> {
      @SuppressWarnings("unchecked")
      Map<String, Object> body = (Map<String, Object>) request.get("body");
      return handler(TaskCreateDomainCase.TaskCreateInput.fromMap(body == null ? Map.of() : body));
    });
    return route;
  }

  @Override
  public void test() throws Exception {
    InMemoryTaskStore store = new InMemoryTaskStore();
    store.reset();

    TaskCreateApiCase apiCase = new TaskCreateApiCase(testContext(store));
    ApiResponse<TaskCreateDomainCase.TaskCreateOutput> result = apiCase.handler(
        new TaskCreateDomainCase.TaskCreateInput(
            "Test task",
            "Created by task_create.api test"
        )
    );

    if (!result.success || result.data == null) {
      throw new IllegalStateException("test: handler should return success");
    }

    if (result.statusCode == null || result.statusCode != 201) {
      throw new IllegalStateException("test: successful create must return statusCode 201");
    }

    if (!"todo".equals(result.data.task().status())) {
      throw new IllegalStateException("test: created task must start in todo");
    }

    if (store.read().size() != 1) {
      throw new IllegalStateException("test: created task must be persisted");
    }

    store.reset();
    List<ApiResponse<TaskCreateDomainCase.TaskCreateOutput>> concurrentCreates = new ArrayList<>();
    for (int index = 0; index < 4; index += 1) {
      concurrentCreates.add(apiCase.handler(
          new TaskCreateDomainCase.TaskCreateInput("Concurrent task " + (index + 1), null)
      ));
    }

    if (concurrentCreates.stream().anyMatch(item -> !item.success)) {
      throw new IllegalStateException("test: concurrent creates must all succeed");
    }

    if (store.read().size() != 4) {
      throw new IllegalStateException("test: concurrent creates must persist every task");
    }

    boolean rejected = false;
    try {
      apiCase._validate(new TaskCreateDomainCase.TaskCreateInput("   ", null));
    } catch (AppCaseError ignored) {
      rejected = true;
    }

    if (!rejected) {
      throw new IllegalStateException("test: _validate must reject blank title");
    }
  }

  @Override
  protected void _validate(TaskCreateDomainCase.TaskCreateInput input) {
    try {
      domainCase.validate(input);
    } catch (Exception error) {
      throw new AppCaseError("VALIDATION_FAILED", error.getMessage());
    }
  }

  @Override
  protected Object _repository() {
    return resolveTaskStore();
  }

  @Override
  protected TaskCreateDomainCase.TaskCreateOutput _service(
      TaskCreateDomainCase.TaskCreateInput input
  ) throws Exception {
    TaskStore taskStore = resolveTaskStore();
    String timestamp = java.time.Instant.now().toString();
    TaskCreateDomainCase.Task task = new TaskCreateDomainCase.Task(
        UUID.randomUUID().toString(),
        input.title().trim(),
        input.description() == null || input.description().trim().isEmpty()
            ? null
            : input.description().trim(),
        "todo",
        timestamp,
        timestamp
    );

    taskStore.update(tasks -> {
      List<Map<String, Object>> next = new ArrayList<>();
      next.add(task.toMap());
      next.addAll(tasks);
      return next;
    });

    if (ctx.logger != null) {
      ctx.logger.info("task_create: task persisted", Map.of(
          "taskId", task.id(),
          "title", task.title()
      ));
    }

    return new TaskCreateDomainCase.TaskCreateOutput(task);
  }

  private TaskStore resolveTaskStore() {
    Object providersValue = ctx.extra.get("providers");
    if (!(providersValue instanceof Map<?, ?> providers)) {
      throw new AppCaseError("INTERNAL", "task_create requires providers in ctx.extra");
    }

    Object taskStoreValue = providers.get("taskStore");
    if (!(taskStoreValue instanceof TaskStore taskStore)) {
      throw new AppCaseError("INTERNAL", "task_create requires a configured taskStore provider");
    }

    return taskStore;
  }

  private static int mapErrorCodeToStatus(String code) {
    if ("VALIDATION_FAILED".equals(code)) {
      return 400;
    }

    if ("NOT_FOUND".equals(code)) {
      return 404;
    }

    return 500;
  }

  private static ApiContext testContext(TaskStore store) {
    ApiContext context = new ApiContext();
    context.correlationId = "task-create-api-test";
    context.logger = new NoopLogger();
    context.extra.put("providers", Map.of("taskStore", store));
    return context;
  }

  private static final class InMemoryTaskStore implements TaskStore {
    private final List<Map<String, Object>> values = new ArrayList<>();

    @Override
    public List<Map<String, Object>> read() {
      return new ArrayList<>(values);
    }

    @Override
    public void write(List<Map<String, Object>> value) {
      values.clear();
      values.addAll(value);
    }

    @Override
    public void reset() {
      values.clear();
    }

    @Override
    public List<Map<String, Object>> update(TaskUpdater updater) throws Exception {
      List<Map<String, Object>> next = updater.apply(new ArrayList<>(values));
      values.clear();
      values.addAll(next);
      return read();
    }
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
