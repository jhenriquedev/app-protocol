package cases.tasks.task_list;

import core.BaseDomainCase;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class TaskListDomainCase
    extends BaseDomainCase<TaskListDomainCase.TaskListInput, TaskListDomainCase.TaskListOutput> {
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

  public static final class TaskListInput {
    public static TaskListInput fromMap(Map<String, Object> value) {
      if (value == null) {
        return new TaskListInput();
      }

      if (!value.isEmpty()) {
        throw new IllegalArgumentException("task_list does not accept filters in v1");
      }

      return new TaskListInput();
    }
  }

  public record TaskListOutput(List<Task> tasks) {
    public static TaskListOutput fromMap(Map<String, Object> value) {
      if (value == null || !(value.get("tasks") instanceof List<?> taskValues)) {
        throw new IllegalArgumentException("task_list output must contain tasks");
      }

      return new TaskListOutput(fromPersistedCollection(taskValues, "task_list.output.tasks"));
    }

    public Map<String, Object> toMap() {
      List<Map<String, Object>> value = new ArrayList<>();
      for (Task task : tasks) {
        value.add(task.toMap());
      }
      return Map.of("tasks", value);
    }
  }

  @Override
  public String caseName() {
    return "task_list";
  }

  @Override
  public String description() {
    return "Lists persisted task cards for board rendering.";
  }

  @Override
  public AppSchema inputSchema() {
    return AppSchema.object().additionalProperties(false);
  }

  @Override
  public AppSchema outputSchema() {
    return AppSchema.object()
        .property("tasks", AppSchema.array(
            AppSchema.object()
                .property("id", AppSchema.string())
                .property("title", AppSchema.string())
                .property("description", AppSchema.string())
                .property("status", AppSchema.string().enumValues("todo", "doing", "done"))
                .property("createdAt", AppSchema.string())
                .property("updatedAt", AppSchema.string())
                .required("id", "title", "status", "createdAt", "updatedAt")
                .additionalProperties(false)
        ))
        .required("tasks")
        .additionalProperties(false);
  }

  @Override
  public void validate(TaskListInput input) {
    if (input == null) {
      throw new IllegalArgumentException("input must be an object");
    }
  }

  public void validateOutput(TaskListOutput output) {
    if (output == null) {
      throw new IllegalArgumentException("output must be an object");
    }

    for (Task task : output.tasks()) {
      if (!TASK_STATUS_VALUES.contains(task.status())) {
        throw new IllegalArgumentException(
            "task_list.output.tasks.status must be one of " + String.join(", ", TASK_STATUS_VALUES)
        );
      }
    }
  }

  @Override
  public List<String> invariants() {
    return List.of(
        "Only todo, doing, and done are valid task statuses.",
        "Listing tasks never mutates the persisted store.",
        "The response order is deterministic for the same persisted dataset."
    );
  }

  @Override
  public List<DomainExample<TaskListInput, TaskListOutput>> examples() {
    DomainExample<TaskListInput, TaskListOutput> emptyBoard = new DomainExample<>();
    emptyBoard.name = "empty_board";
    emptyBoard.description = "No persisted tasks yet.";
    emptyBoard.input = new TaskListInput();
    emptyBoard.output = new TaskListOutput(List.of());

    DomainExample<TaskListInput, TaskListOutput> boardWithCards = new DomainExample<>();
    boardWithCards.name = "board_with_cards";
    boardWithCards.description = "Returns tasks already persisted in the board.";
    boardWithCards.input = new TaskListInput();
    boardWithCards.output = new TaskListOutput(List.of(
        new Task(
            "task_002",
            "Prepare release notes",
            null,
            "todo",
            "2026-03-18T12:10:00.000Z",
            "2026-03-18T12:10:00.000Z"
        ),
        new Task(
            "task_001",
            "Ship the Java example",
            "Wire the first APP cases in the portal.",
            "doing",
            "2026-03-18T12:00:00.000Z",
            "2026-03-18T12:30:00.000Z"
        )
    ));

    return List.of(emptyBoard, boardWithCards);
  }

  @Override
  public void test() throws Exception {
    validate(new TaskListInput());

    List<Task> tasks = fromPersistedCollection(
        List.of(
            Map.of(
                "id", "task_001",
                "title", "Valid task",
                "status", "todo",
                "createdAt", "2026-03-18T12:00:00.000Z",
                "updatedAt", "2026-03-18T12:00:00.000Z"
            )
        ),
        "task_list.persisted_tasks"
    );

    validateOutput(new TaskListOutput(tasks));

    boolean rejected = false;
    try {
      fromPersistedCollection(
          List.of(
              Map.of(
                  "id", "bad",
                  "title", "Invalid task",
                  "status", "invalid",
                  "createdAt", "2026-03-18T12:00:00.000Z",
                  "updatedAt", "2026-03-18T12:00:00.000Z"
              )
          ),
          "task_list.persisted_tasks"
      );
    } catch (IllegalArgumentException ignored) {
      rejected = true;
    }

    if (!rejected) {
      throw new IllegalStateException("test: validateOutput must reject invalid task status");
    }
  }

  public static List<Task> fromPersistedCollection(List<?> values, String source) {
    List<Task> tasks = new ArrayList<>();
    for (int index = 0; index < values.size(); index += 1) {
      Object current = values.get(index);
      if (!(current instanceof Map<?, ?> mapValue)) {
        throw new IllegalArgumentException(source + "[" + index + "] must be an object");
      }

      @SuppressWarnings("unchecked")
      Map<String, Object> taskValue = (Map<String, Object>) mapValue;
      tasks.add(Task.fromMap(taskValue, source + "[" + index + "]"));
    }
    return tasks;
  }

  private static String requiredString(Map<String, Object> value, String field, String source) {
    Object current = value.get(field);
    if (!(current instanceof String stringValue) || stringValue.trim().isEmpty()) {
      throw new IllegalArgumentException(source + "." + field + " must be a non-empty string");
    }

    return stringValue;
  }
}
