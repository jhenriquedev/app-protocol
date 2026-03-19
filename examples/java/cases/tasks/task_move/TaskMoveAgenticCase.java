package cases.tasks.task_move;

import core.BaseAgenticCase;
import core.BaseApiCase.ApiResponse;
import core.shared.AppStructuralContracts.AppCaseError;
import java.util.List;
import java.util.Map;

public class TaskMoveAgenticCase extends BaseAgenticCase<
    TaskMoveDomainCase.TaskMoveInput,
    TaskMoveDomainCase.TaskMoveOutput
> {
  public TaskMoveAgenticCase(AgenticContext ctx) {
    super(ctx);
  }

  @Override
  protected TaskMoveDomainCase domain() {
    return new TaskMoveDomainCase();
  }

  @Override
  public AgenticDiscovery discovery() {
    AgenticDiscovery discovery = new AgenticDiscovery();
    discovery.name = domainCaseName();
    discovery.description = domainDescription();
    discovery.category = "tasks";
    discovery.tags = List.of("tasks", "move", "status");
    discovery.aliases = List.of("move_task", "change_task_status", "advance_task");
    discovery.capabilities = List.of("task_move", "board_mutation");
    discovery.intents = List.of("move a task", "change task status", "advance work on the board");
    return discovery;
  }

  @Override
  public AgenticExecutionContext context() {
    AgenticExecutionContext context = new AgenticExecutionContext();
    context.requiresAuth = false;
    context.dependencies = List.of("task_move.domain", "task_move.api", "task_list.agentic");
    context.preconditions = List.of("A concrete taskId and a valid targetStatus are required.");
    context.constraints = List.of(
        "Use task_list first when the user refers to a task ambiguously.",
        "Execution must delegate to the canonical API surface."
    );
    context.notes = List.of(
        "Moving a task is a mutating action and should be confirmed by the host runtime."
    );
    return context;
  }

  @Override
  public AgenticPrompt prompt() {
    AgenticPrompt prompt = new AgenticPrompt();
    prompt.purpose = "Move an existing task to todo, doing, or done by task id.";
    prompt.whenToUse = List.of(
        "When the user explicitly wants to move an existing task card.",
        "When the user wants to update the progress status of known work."
    );
    prompt.whenNotToUse = List.of(
        "When the user wants to create a task.",
        "When the user has not provided enough information to identify the task."
    );
    prompt.constraints = List.of(
        "Do not invent a taskId.",
        "Require confirmation before mutating the board."
    );
    prompt.reasoningHints = List.of(
        "If the task is ambiguous, list current tasks first and ask the user to confirm the intended card."
    );
    prompt.expectedOutcome = "The updated task object with the requested target status persisted.";
    return prompt;
  }

  @Override
  public AgenticToolContract<TaskMoveDomainCase.TaskMoveInput, TaskMoveDomainCase.TaskMoveOutput> tool() {
    AgenticToolContract<TaskMoveDomainCase.TaskMoveInput, TaskMoveDomainCase.TaskMoveOutput> tool =
        new AgenticToolContract<>();
    tool.name = "task_move";
    tool.description = "Move a task through the canonical API execution flow.";
    tool.inputSchema = domainInputSchema();
    tool.outputSchema = domainOutputSchema();
    tool.isMutating = true;
    tool.requiresConfirmation = true;
    tool.executor = (input, runtimeContext) -> {
      TaskMoveApiCase apiCase = resolveApi(runtimeContext);
      ApiResponse<TaskMoveDomainCase.TaskMoveOutput> result = apiCase.handler(input);
      if (!result.success || result.data == null) {
        throw core.shared.AppStructuralContracts.toAppCaseError(
            result.error,
            "task_move API failed"
        );
      }
      return result.data;
    };
    return tool;
  }

  @Override
  public AgenticMcpContract mcp() {
    AgenticMcpContract mcp = new AgenticMcpContract();
    mcp.enabled = true;
    mcp.name = "task_move";
    mcp.title = "Move Task";
    mcp.description = "Move a task between board columns through the canonical APP task_move API flow.";
    mcp.metadata = Map.of("category", "tasks", "mutating", true);
    return mcp;
  }

  @Override
  public AgenticRagContract rag() {
    AgenticRagContract rag = new AgenticRagContract();
    rag.topics = List.of("task_management", "status_transitions", "board_mutation");
    rag.resources = List.of(
        ragResource("case", "tasks/task_move", "Canonical board mutation capability for changing task status."),
        ragResource("case", "tasks/task_list", "Grounding capability used to identify persisted task ids before moving them.")
    );
    rag.hints = List.of(
        "Use task_list to ground ambiguous references before proposing or executing a move.",
        "Preserve explicit confirmation because task_move mutates persisted board state."
    );
    rag.scope = "project";
    rag.mode = "recommended";
    return rag;
  }

  @Override
  public AgenticPolicy policy() {
    AgenticPolicy policy = new AgenticPolicy();
    policy.requireConfirmation = true;
    policy.riskLevel = "medium";
    policy.executionMode = "manual-approval";
    policy.limits = List.of("Do not execute a move without explicit confirmation from the host runtime.");
    return policy;
  }

  @Override
  public void test() throws Exception {
    validateDefinition();

    if (!Boolean.TRUE.equals(tool().requiresConfirmation)) {
      throw new IllegalStateException("test: task_move tool must require confirmation");
    }

    if (!"manual-approval".equals(policy().executionMode)) {
      throw new IllegalStateException("test: task_move should default to manual approval");
    }

    if (rag().resources.isEmpty()) {
      throw new IllegalStateException("test: task_move should publish semantic RAG resources");
    }

    TaskMoveDomainCase.TaskMoveOutput example = examples().stream()
        .filter(item -> "move_todo_to_doing".equals(item.name))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("test: task_move example must exist"))
        .output;

    AgenticContext successContext = new AgenticContext();
    successContext.correlationId = "task-move-agentic-test";
    successContext.logger = ctx.logger;
    successContext.cases.put("tasks", Map.of(
        "task_move", Map.of(
            "api", new TaskMoveApiCase(new core.BaseApiCase.ApiContext()) {
              @Override
              public ApiResponse<TaskMoveDomainCase.TaskMoveOutput> handler(
                  TaskMoveDomainCase.TaskMoveInput input
              ) {
                return ApiResponse.success(example, 200);
              }
            }
        )
    ));

    TaskMoveDomainCase.TaskMoveOutput result = tool().execute(
        new TaskMoveDomainCase.TaskMoveInput("task_001", "doing"),
        successContext
    );
    if (!example.task().status().equals(result.task().status())) {
      throw new IllegalStateException("test: task_move tool must return the moved task");
    }

    AgenticContext failureContext = new AgenticContext();
    failureContext.correlationId = "task-move-agentic-failure-test";
    failureContext.logger = ctx.logger;
    failureContext.cases.put("tasks", Map.of(
        "task_move", Map.of(
            "api", new TaskMoveApiCase(new core.BaseApiCase.ApiContext()) {
              @Override
              public ApiResponse<TaskMoveDomainCase.TaskMoveOutput> handler(
                  TaskMoveDomainCase.TaskMoveInput input
              ) {
                return ApiResponse.failure(
                    new core.shared.AppStructuralContracts.AppError(
                        "NOT_FOUND",
                        "Task missing was not found",
                        null
                    ),
                    404
                );
              }
            }
        )
    ));

    boolean propagated = false;
    try {
      tool().execute(new TaskMoveDomainCase.TaskMoveInput("missing", "done"), failureContext);
    } catch (AppCaseError error) {
      propagated = "NOT_FOUND".equals(error.code());
    }

    if (!propagated) {
      throw new IllegalStateException("test: task_move must preserve NOT_FOUND from API");
    }
  }

  private TaskMoveApiCase resolveApi(AgenticContext runtimeContext) {
    Object tasksValue = runtimeContext.cases.get("tasks");
    if (!(tasksValue instanceof Map<?, ?> tasksMap)) {
      throw new AppCaseError("INTERNAL", "task_move.agentic requires ctx.cases.tasks");
    }

    Object caseValue = tasksMap.get("task_move");
    if (!(caseValue instanceof Map<?, ?> caseMap)) {
      throw new AppCaseError("INTERNAL", "task_move.agentic requires ctx.cases.tasks.task_move");
    }

    Object apiValue = caseMap.get("api");
    if (!(apiValue instanceof TaskMoveApiCase apiCase)) {
      throw new AppCaseError("INTERNAL", "task_move.agentic requires ctx.cases.tasks.task_move.api");
    }

    return apiCase;
  }

  private RagResource ragResource(String kind, String ref, String description) {
    RagResource resource = new RagResource();
    resource.kind = kind;
    resource.ref = ref;
    resource.description = description;
    return resource;
  }
}
