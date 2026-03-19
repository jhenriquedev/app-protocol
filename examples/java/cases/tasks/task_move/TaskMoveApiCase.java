package cases.tasks.task_move;

import core.BaseApiCase;
import core.shared.AppBaseContext.AppLogger;
import core.shared.AppStructuralContracts.AppCaseError;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class TaskMoveApiCase
    extends BaseApiCase<TaskMoveDomainCase.TaskMoveInput, TaskMoveDomainCase.TaskMoveOutput> {
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

  private final TaskMoveDomainCase domainCase = new TaskMoveDomainCase();

  public TaskMoveApiCase(ApiContext ctx) {
    super(ctx);
  }

  @Override
  public ApiResponse<TaskMoveDomainCase.TaskMoveOutput> handler(
      TaskMoveDomainCase.TaskMoveInput input
  ) throws Exception {
    ApiResponse<TaskMoveDomainCase.TaskMoveOutput> result = execute(input);
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
        "method", "PATCH",
        "path", "/tasks/:taskId/status",
        "handler", (RouteHandler) request -> {
          @SuppressWarnings("unchecked")
          Map<String, Object> params = (Map<String, Object>) request.get("params");
          @SuppressWarnings("unchecked")
          Map<String, Object> body = (Map<String, Object>) request.get("body");
          return handler(new TaskMoveDomainCase.TaskMoveInput(
              params == null ? "" : String.valueOf(params.getOrDefault("taskId", "")),
              body == null ? null : (String) body.get("targetStatus")
          ));
        }
    );
  }

  @Override
  public void test() throws Exception {
    InMemoryTaskStore store = new InMemoryTaskStore();
    store.reset();
    store.write(List.of(
        Map.of(
            "id", "task_001",
            "title", "Ship the Java example",
            "status", "todo",
            "createdAt", "2026-03-18T12:00:00.000Z",
            "updatedAt", "2026-03-18T12:00:00.000Z"
        )
    ));

    TaskMoveApiCase apiCase = new TaskMoveApiCase(testContext(store));
    ApiResponse<TaskMoveDomainCase.TaskMoveOutput> movedResult = apiCase.handler(
        new TaskMoveDomainCase.TaskMoveInput("task_001", "doing")
    );

    if (!movedResult.success || movedResult.data == null) {
      throw new IllegalStateException("test: move should return success");
    }

    if (!"doing".equals(movedResult.data.task().status())) {
      throw new IllegalStateException("test: task status must change to doing");
    }

    if (!"doing".equals(TaskMoveDomainCase.Task.fromMap(store.read().get(0), "store").status())) {
      throw new IllegalStateException("test: moved status must persist");
    }

    ApiResponse<TaskMoveDomainCase.TaskMoveOutput> idempotentResult = apiCase.handler(
        new TaskMoveDomainCase.TaskMoveInput("task_001", "doing")
    );
    if (!idempotentResult.success || idempotentResult.data == null) {
      throw new IllegalStateException("test: idempotent move should still succeed");
    }

    ApiResponse<TaskMoveDomainCase.TaskMoveOutput> notFoundResult = apiCase.handler(
        new TaskMoveDomainCase.TaskMoveInput("missing", "done")
    );
    if (notFoundResult.success || notFoundResult.statusCode == null || notFoundResult.statusCode != 404) {
      throw new IllegalStateException("test: missing task must return NOT_FOUND");
    }

    store.write(List.of(
        Map.of(
            "id", "task_002",
            "title", "Broken task",
            "description", 123,
            "status", "todo",
            "createdAt", "2026-03-18T12:00:00.000Z",
            "updatedAt", "2026-03-18T12:00:00.000Z"
        )
    ));

    ApiResponse<TaskMoveDomainCase.TaskMoveOutput> invalidPersistedResult = apiCase.handler(
        new TaskMoveDomainCase.TaskMoveInput("task_002", "doing")
    );
    if (invalidPersistedResult.success
        || invalidPersistedResult.statusCode == null
        || invalidPersistedResult.statusCode != 500) {
      throw new IllegalStateException("test: invalid persisted task must return failure");
    }
  }

  @Override
  protected void _validate(TaskMoveDomainCase.TaskMoveInput input) {
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
  protected TaskMoveDomainCase.TaskMoveOutput _service(
      TaskMoveDomainCase.TaskMoveInput input
  ) throws Exception {
    TaskStore taskStore = resolveTaskStore();
    TaskMoveDomainCase.TaskMoveOutput[] output = new TaskMoveDomainCase.TaskMoveOutput[1];
    String[] previousStatus = new String[1];

    taskStore.update(tasks -> {
      int taskIndex = -1;
      for (int index = 0; index < tasks.size(); index += 1) {
        Map<String, Object> current = tasks.get(index);
        if (input.taskId().equals(current.get("id"))) {
          taskIndex = index;
          break;
        }
      }

      if (taskIndex < 0) {
        throw new AppCaseError("NOT_FOUND", "Task " + input.taskId() + " was not found");
      }

      TaskMoveDomainCase.Task currentTask;
      try {
        currentTask = TaskMoveDomainCase.Task.fromMap(
            tasks.get(taskIndex),
            "task_move.persisted_task"
        );
      } catch (IllegalArgumentException error) {
        throw new AppCaseError("INTERNAL", error.getMessage());
      }

      if (currentTask.status().equals(input.targetStatus())) {
        output[0] = new TaskMoveDomainCase.TaskMoveOutput(currentTask);
        return tasks;
      }

      previousStatus[0] = currentTask.status();
      TaskMoveDomainCase.Task updatedTask = new TaskMoveDomainCase.Task(
          currentTask.id(),
          currentTask.title(),
          currentTask.description(),
          input.targetStatus(),
          currentTask.createdAt(),
          java.time.Instant.now().toString()
      );

      output[0] = new TaskMoveDomainCase.TaskMoveOutput(updatedTask);
      domainCase.validateOutput(output[0]);

      List<Map<String, Object>> updatedTasks = new ArrayList<>(tasks);
      updatedTasks.set(taskIndex, updatedTask.toMap());
      return updatedTasks;
    });

    if (output[0] == null) {
      throw new AppCaseError("INTERNAL", "task_move did not produce an output");
    }

    if (ctx.logger != null && previousStatus[0] != null) {
      ctx.logger.info("task_move: task status updated", Map.of(
          "taskId", output[0].task().id(),
          "from", previousStatus[0],
          "to", output[0].task().status()
      ));
    }

    return output[0];
  }

  private TaskStore resolveTaskStore() {
    Object providersValue = ctx.extra.get("providers");
    if (!(providersValue instanceof Map<?, ?> providers)) {
      throw new AppCaseError("INTERNAL", "task_move requires providers in ctx.extra");
    }

    Object taskStoreValue = providers.get("taskStore");
    if (!(taskStoreValue instanceof TaskStore taskStore)) {
      throw new AppCaseError("INTERNAL", "task_move requires a configured taskStore provider");
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
    context.correlationId = "task-move-api-test";
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
