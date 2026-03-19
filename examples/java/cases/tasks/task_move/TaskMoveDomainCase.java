package cases.tasks.task_move;

import core.BaseDomainCase;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class TaskMoveDomainCase
    extends BaseDomainCase<TaskMoveDomainCase.TaskMoveInput, TaskMoveDomainCase.TaskMoveOutput> {
  public static final List<String> TASK_STATUS_VALUES = List.of("todo", "doing", "done");

  public record Task(
      String id,
      String title,
      String description,
      String status,
      String createdAt,
      String updatedAt
  ) {
    public static Task fromMap(Map<String, Object> value, String source) {
      if (value == null) {
        throw new IllegalArgumentException(source + " must be an object");
      }

      String id = requiredString(value, "id", source);
      String title = requiredString(value, "title", source);
      String status = requiredString(value, "status", source);
      String createdAt = requiredString(value, "createdAt", source);
      String updatedAt = requiredString(value, "updatedAt", source);
      Object description = value.get("description");

      if (!TASK_STATUS_VALUES.contains(status)) {
        throw new IllegalArgumentException(
            source + ".status must be one of " + String.join(", ", TASK_STATUS_VALUES)
        );
      }

      if (description != null && !(description instanceof String)) {
        throw new IllegalArgumentException(source + ".description must be a string when provided");
      }

      return new Task(id, title, (String) description, status, createdAt, updatedAt);
    }

    public Map<String, Object> toMap() {
      Map<String, Object> value = new LinkedHashMap<>();
      value.put("id", id);
      value.put("title", title);
      if (description != null && !description.isBlank()) {
        value.put("description", description);
      }
      value.put("status", status);
      value.put("createdAt", createdAt);
      value.put("updatedAt", updatedAt);
      return value;
    }
  }

  public record TaskMoveInput(String taskId, String targetStatus) {
    public static TaskMoveInput fromMap(Map<String, Object> value) {
      if (value == null) {
        throw new IllegalArgumentException("input must be an object");
      }

      Object taskId = value.get("taskId");
      Object targetStatus = value.get("targetStatus");

      if (!(taskId instanceof String taskIdValue)) {
        throw new IllegalArgumentException("taskId is required");
      }

      if (!(targetStatus instanceof String targetStatusValue)) {
        throw new IllegalArgumentException("targetStatus is required");
      }

      return new TaskMoveInput(taskIdValue, targetStatusValue);
    }
  }

  public record TaskMoveOutput(Task task) {
    public static TaskMoveOutput fromMap(Map<String, Object> value) {
      if (value == null || !(value.get("task") instanceof Map<?, ?> taskMap)) {
        throw new IllegalArgumentException("task_move output must contain task");
      }

      @SuppressWarnings("unchecked")
      Map<String, Object> taskValue = (Map<String, Object>) taskMap;
      return new TaskMoveOutput(Task.fromMap(taskValue, "task_move.output.task"));
    }

    public Map<String, Object> toMap() {
      return Map.of("task", task.toMap());
    }
  }

  @Override
  public String caseName() {
    return "task_move";
  }

  @Override
  public String description() {
    return "Moves an existing task card to another board column.";
  }

  @Override
  public AppSchema inputSchema() {
    return AppSchema.object()
        .property("taskId", AppSchema.string().description("Identifier of the task that will be moved."))
        .property("targetStatus", AppSchema.string()
            .description("Destination board column for the task.")
            .enumValues("todo", "doing", "done"))
        .required("taskId", "targetStatus")
        .additionalProperties(false);
  }

  @Override
  public AppSchema outputSchema() {
    return AppSchema.object()
        .property("task", AppSchema.object()
            .property("id", AppSchema.string())
            .property("title", AppSchema.string())
            .property("description", AppSchema.string())
            .property("status", AppSchema.string().enumValues("todo", "doing", "done"))
            .property("createdAt", AppSchema.string())
            .property("updatedAt", AppSchema.string())
            .required("id", "title", "status", "createdAt", "updatedAt")
            .additionalProperties(false))
        .required("task")
        .additionalProperties(false);
  }

  @Override
  public void validate(TaskMoveInput input) {
    if (input == null) {
      throw new IllegalArgumentException("input must be an object");
    }

    if (input.taskId() == null || input.taskId().trim().isEmpty()) {
      throw new IllegalArgumentException("taskId is required");
    }

    if (!TASK_STATUS_VALUES.contains(input.targetStatus())) {
      throw new IllegalArgumentException(
          "targetStatus must be one of " + String.join(", ", TASK_STATUS_VALUES)
      );
    }
  }

  public void validateOutput(TaskMoveOutput output) {
    if (output == null) {
      throw new IllegalArgumentException("output must be an object");
    }

    if (!TASK_STATUS_VALUES.contains(output.task().status())) {
      throw new IllegalArgumentException("task_move.output.task.status is invalid");
    }
  }

  @Override
  public List<String> invariants() {
    return List.of(
        "Moving a task never changes its identity.",
        "A move only updates status and, when applicable, updatedAt.",
        "Moving to the same status is idempotent and returns the unchanged task."
    );
  }

  @Override
  public List<DomainExample<TaskMoveInput, TaskMoveOutput>> examples() {
    DomainExample<TaskMoveInput, TaskMoveOutput> moveTodoToDoing = new DomainExample<>();
    moveTodoToDoing.name = "move_todo_to_doing";
    moveTodoToDoing.description = "A task leaves todo and enters doing.";
    moveTodoToDoing.input = new TaskMoveInput("task_001", "doing");
    moveTodoToDoing.output = new TaskMoveOutput(
        new Task(
            "task_001",
            "Ship the Java example",
            null,
            "doing",
            "2026-03-18T12:00:00.000Z",
            "2026-03-18T12:20:00.000Z"
        )
    );

    DomainExample<TaskMoveInput, TaskMoveOutput> idempotentMove = new DomainExample<>();
    idempotentMove.name = "idempotent_move";
    idempotentMove.description = "Moving to the same status keeps the task unchanged.";
    idempotentMove.input = new TaskMoveInput("task_002", "done");
    idempotentMove.output = new TaskMoveOutput(
        new Task(
            "task_002",
            "Prepare release notes",
            null,
            "done",
            "2026-03-18T12:10:00.000Z",
            "2026-03-18T12:10:00.000Z"
        )
    );

    return List.of(moveTodoToDoing, idempotentMove);
  }

  @Override
  public void test() throws Exception {
    validate(new TaskMoveInput("task_001", "doing"));

    boolean rejected = false;
    try {
      validate(new TaskMoveInput("", "doing"));
    } catch (IllegalArgumentException ignored) {
      rejected = true;
    }

    if (!rejected) {
      throw new IllegalStateException("test: validate must reject empty taskId");
    }

    rejected = false;
    try {
      validate(new TaskMoveInput("task_001", "invalid"));
    } catch (IllegalArgumentException ignored) {
      rejected = true;
    }

    if (!rejected) {
      throw new IllegalStateException("test: validate must reject invalid targetStatus");
    }

    validateOutput(new TaskMoveOutput(
        new Task(
            "task_001",
            "Valid task",
            null,
            "doing",
            "2026-03-18T12:00:00.000Z",
            "2026-03-18T12:20:00.000Z"
        )
    ));
  }

  private static String requiredString(Map<String, Object> value, String field, String source) {
    Object current = value.get(field);
    if (!(current instanceof String stringValue) || stringValue.trim().isEmpty()) {
      throw new IllegalArgumentException(source + "." + field + " must be a non-empty string");
    }

    return stringValue;
  }
}
