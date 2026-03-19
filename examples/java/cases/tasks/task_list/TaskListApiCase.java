package cases.tasks.task_list;

import core.BaseApiCase;
import core.shared.AppBaseContext.AppLogger;
import core.shared.AppStructuralContracts.AppCaseError;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public class TaskListApiCase
    extends BaseApiCase<TaskListDomainCase.TaskListInput, TaskListDomainCase.TaskListOutput> {
  public interface TaskStore {
    List<Map<String, Object>> read() throws Exception;
    void write(List<Map<String, Object>> value) throws Exception;
    void reset() throws Exception;
  }

  private final TaskListDomainCase domainCase = new TaskListDomainCase();

  public TaskListApiCase(ApiContext ctx) {
    super(ctx);
  }

  @Override
  public ApiResponse<TaskListDomainCase.TaskListOutput> handler(
      TaskListDomainCase.TaskListInput input
  ) throws Exception {
    ApiResponse<TaskListDomainCase.TaskListOutput> result =
        execute(input == null ? new TaskListDomainCase.TaskListInput() : input);

    if (result.success) {
      result.statusCode = 200;
      return result;
    }

    result.statusCode = mapErrorCodeToStatus(result.error == null ? null : result.error.code());
    return result;
  }

  @Override
  public Object router() {
    return Map.of(
        "method", "GET",
        "path", "/tasks",
        "handler", (RouteHandler) request -> handler(new TaskListDomainCase.TaskListInput())
    );
  }

  @Override
  public void test() throws Exception {
    InMemoryTaskStore store = new InMemoryTaskStore();
    store.reset();
    store.write(List.of(
        Map.of(
            "id", "task_001",
            "title", "Older task",
            "status", "todo",
            "createdAt", "2026-03-18T12:00:00.000Z",
            "updatedAt", "2026-03-18T12:00:00.000Z"
        ),
        Map.of(
            "id", "task_002",
            "title", "Newer task",
            "status", "doing",
            "createdAt", "2026-03-18T12:30:00.000Z",
            "updatedAt", "2026-03-18T12:30:00.000Z"
        )
    ));

    TaskListApiCase apiCase = new TaskListApiCase(testContext(store));
    ApiResponse<TaskListDomainCase.TaskListOutput> result = apiCase.handler(
        new TaskListDomainCase.TaskListInput()
    );

    if (!result.success || result.data == null) {
      throw new IllegalStateException("test: handler should return a successful task list");
    }

    if (result.data.tasks().size() != 2) {
      throw new IllegalStateException("test: task list should return all persisted tasks");
    }

    if (!"task_002".equals(result.data.tasks().get(0).id())) {
      throw new IllegalStateException("test: task list should sort by createdAt descending");
    }

    store.write(List.of(
        Map.of(
            "id", "broken",
            "title", "Broken task",
            "status", "broken",
            "createdAt", "2026-03-18T12:00:00.000Z",
            "updatedAt", "2026-03-18T12:00:00.000Z"
        )
    ));

    ApiResponse<TaskListDomainCase.TaskListOutput> invalidResult = apiCase.handler(
        new TaskListDomainCase.TaskListInput()
    );

    if (invalidResult.success) {
      throw new IllegalStateException("test: invalid persisted records must return failure");
    }
  }

  @Override
  protected void _validate(TaskListDomainCase.TaskListInput input) {
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
  protected TaskListDomainCase.TaskListOutput _service(
      TaskListDomainCase.TaskListInput input
  ) throws Exception {
    List<Map<String, Object>> persisted = resolveTaskStore().read();
    List<TaskListDomainCase.Task> tasks;

    try {
      tasks = TaskListDomainCase.fromPersistedCollection(
          persisted,
          "task_list.persisted_tasks"
      );
    } catch (IllegalArgumentException error) {
      throw new AppCaseError("INTERNAL", error.getMessage());
    }

    tasks.sort(Comparator.comparing(task -> Instant.parse(task.createdAt())));
    List<TaskListDomainCase.Task> sorted = new ArrayList<>(tasks);
    sorted.sort((left, right) -> right.createdAt().compareTo(left.createdAt()));

    TaskListDomainCase.TaskListOutput output = new TaskListDomainCase.TaskListOutput(sorted);
    domainCase.validateOutput(output);
    return output;
  }

  private TaskStore resolveTaskStore() {
    Object providersValue = ctx.extra.get("providers");
    if (!(providersValue instanceof Map<?, ?> providers)) {
      throw new AppCaseError("INTERNAL", "task_list requires providers in ctx.extra");
    }

    Object taskStoreValue = providers.get("taskStore");
    if (!(taskStoreValue instanceof TaskStore taskStore)) {
      throw new AppCaseError("INTERNAL", "task_list requires a configured taskStore provider");
    }

    return taskStore;
  }

  private static int mapErrorCodeToStatus(String code) {
    if ("VALIDATION_FAILED".equals(code)) {
      return 400;
    }
    return 500;
  }

  private static ApiContext testContext(TaskStore store) {
    ApiContext context = new ApiContext();
    context.correlationId = "task-list-api-test";
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
