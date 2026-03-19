package cases.tasks.task_create;

import core.BaseDomainCase;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class TaskCreateDomainCase
    extends BaseDomainCase<TaskCreateDomainCase.TaskCreateInput, TaskCreateDomainCase.TaskCreateOutput> {
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

  public record TaskCreateInput(String title, String description) {
    public static TaskCreateInput fromMap(Map<String, Object> value) {
      if (value == null) {
        throw new IllegalArgumentException("input must be an object");
      }

      for (String forbidden : List.of("id", "status", "createdAt", "updatedAt")) {
        if (value.containsKey(forbidden)) {
          throw new IllegalArgumentException(forbidden + " must not be provided by the caller");
        }
      }

      for (String key : value.keySet()) {
        if (!List.of("title", "description").contains(key)) {
          throw new IllegalArgumentException("Unexpected input field " + key);
        }
      }

      Object title = value.get("title");
      Object description = value.get("description");

      if (!(title instanceof String)) {
        throw new IllegalArgumentException("title is required and must be a string");
      }

      if (description != null && !(description instanceof String)) {
        throw new IllegalArgumentException("description must be a string when provided");
      }

      return new TaskCreateInput((String) title, (String) description);
    }
  }

  public record TaskCreateOutput(Task task) {
    public static TaskCreateOutput fromMap(Map<String, Object> value) {
      if (value == null || !(value.get("task") instanceof Map<?, ?> taskMap)) {
        throw new IllegalArgumentException("task_create output must contain task");
      }

      @SuppressWarnings("unchecked")
      Map<String, Object> taskValue = (Map<String, Object>) taskMap;
      return new TaskCreateOutput(Task.fromMap(taskValue, "task_create.output.task"));
    }

    public Map<String, Object> toMap() {
      return Map.of("task", task.toMap());
    }
  }

  @Override
  public String caseName() {
    return "task_create";
  }

  @Override
  public String description() {
    return "Creates a new task card for the board with an initial todo status.";
  }

  @Override
  public AppSchema inputSchema() {
    return AppSchema.object()
        .property("title", AppSchema.string().description("Visible task title shown on the card."))
        .property("description", AppSchema.string().description("Optional complementary task description."))
        .required("title")
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
  public void validate(TaskCreateInput input) {
    if (input == null) {
      throw new IllegalArgumentException("input must be an object");
    }

    if (input.title() == null || input.title().trim().isEmpty()) {
      throw new IllegalArgumentException("title must not be empty");
    }
  }

  @Override
  public List<String> invariants() {
    return List.of(
        "Every new task starts with status todo.",
        "The backend is the source of truth for task id and timestamps.",
        "createdAt and updatedAt are equal on first creation."
    );
  }

  @Override
  public List<DomainExample<TaskCreateInput, TaskCreateOutput>> examples() {
    DomainExample<TaskCreateInput, TaskCreateOutput> titleOnly = new DomainExample<>();
    titleOnly.name = "title_only";
    titleOnly.description = "Create a task with only the required title.";
    titleOnly.input = new TaskCreateInput("Ship the Java example", null);
    titleOnly.output = new TaskCreateOutput(
        new Task(
            "task_001",
            "Ship the Java example",
            null,
            "todo",
            "2026-03-18T12:00:00.000Z",
            "2026-03-18T12:00:00.000Z"
        )
    );

    DomainExample<TaskCreateInput, TaskCreateOutput> titleAndDescription = new DomainExample<>();
    titleAndDescription.name = "title_and_description";
    titleAndDescription.description = "Create a task with an optional description.";
    titleAndDescription.input = new TaskCreateInput(
        "Prepare release notes",
        "Summarize the scope of the first Java APP example."
    );
    titleAndDescription.output = new TaskCreateOutput(
        new Task(
            "task_002",
            "Prepare release notes",
            "Summarize the scope of the first Java APP example.",
            "todo",
            "2026-03-18T12:10:00.000Z",
            "2026-03-18T12:10:00.000Z"
        )
    );

    return List.of(titleOnly, titleAndDescription);
  }

  @Override
  public void test() throws Exception {
    if (!"task_create".equals(caseName())) {
      throw new IllegalStateException("test: caseName must be task_create");
    }

    validate(new TaskCreateInput("Valid task", "Optional text"));

    boolean rejected = false;
    try {
      validate(new TaskCreateInput("   ", null));
    } catch (IllegalArgumentException ignored) {
      rejected = true;
    }

    if (!rejected) {
      throw new IllegalStateException("test: validate must reject blank title");
    }

    rejected = false;
    try {
      TaskCreateInput.fromMap(Map.of("title", "Bad", "status", "todo"));
    } catch (IllegalArgumentException ignored) {
      rejected = true;
    }

    if (!rejected) {
      throw new IllegalStateException("test: fromMap must reject forbidden fields");
    }

    for (DomainExample<TaskCreateInput, TaskCreateOutput> example : examples()) {
      validate(example.input);
      if (!"todo".equals(example.output.task().status())) {
        throw new IllegalStateException("test: example output must start in todo");
      }
    }
  }

  private static String requiredString(Map<String, Object> value, String field, String source) {
    Object current = value.get(field);
    if (!(current instanceof String stringValue) || stringValue.trim().isEmpty()) {
      throw new IllegalArgumentException(source + "." + field + " must be a non-empty string");
    }

    return stringValue;
  }
}
