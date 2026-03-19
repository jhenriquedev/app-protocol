package cases.tasks.task_list;

import core.BaseAgenticCase;
import core.BaseApiCase.ApiResponse;
import core.shared.AppStructuralContracts.AppCaseError;
import java.util.List;
import java.util.Map;

public class TaskListAgenticCase extends BaseAgenticCase<
    TaskListDomainCase.TaskListInput,
    TaskListDomainCase.TaskListOutput
> {
  public TaskListAgenticCase(AgenticContext ctx) {
    super(ctx);
  }

  @Override
  protected TaskListDomainCase domain() {
    return new TaskListDomainCase();
  }

  @Override
  public AgenticDiscovery discovery() {
    AgenticDiscovery discovery = new AgenticDiscovery();
    discovery.name = domainCaseName();
    discovery.description = domainDescription();
    discovery.category = "tasks";
    discovery.tags = List.of("tasks", "listing", "board");
    discovery.aliases = List.of("list_board_tasks", "show_board", "inspect_board_state");
    discovery.capabilities = List.of("task_listing", "board_grounding");
    discovery.intents = List.of("list tasks", "show the board", "show current tasks");
    return discovery;
  }

  @Override
  public AgenticExecutionContext context() {
    AgenticExecutionContext context = new AgenticExecutionContext();
    context.requiresAuth = false;
    context.dependencies = List.of("task_list.domain", "task_list.api");
    context.preconditions = List.of("The persisted task store must be readable.");
    context.constraints = List.of(
        "This capability is read-only.",
        "No filters or pagination are supported in v1."
    );
    context.notes = List.of(
        "Use this capability to ground follow-up decisions before mutating the board."
    );
    return context;
  }

  @Override
  public AgenticPrompt prompt() {
    AgenticPrompt prompt = new AgenticPrompt();
    prompt.purpose = "List all persisted tasks so an agent can inspect the board state.";
    prompt.whenToUse = List.of(
        "When the user asks to see the board or current tasks.",
        "Before moving a task when the user has not provided an exact task identifier."
    );
    prompt.whenNotToUse = List.of(
        "When the user wants to create a new task.",
        "When the user already provided a precise task id for a direct move operation."
    );
    prompt.constraints = List.of(
        "Do not claim support for filters or search in this v1 example."
    );
    prompt.reasoningHints = List.of(
        "Treat task_list as the canonical grounding step before ambiguous task mutations."
    );
    prompt.expectedOutcome = "A flat array of task objects ordered by createdAt descending.";
    return prompt;
  }

  @Override
  public AgenticToolContract<TaskListDomainCase.TaskListInput, TaskListDomainCase.TaskListOutput> tool() {
    AgenticToolContract<TaskListDomainCase.TaskListInput, TaskListDomainCase.TaskListOutput> tool =
        new AgenticToolContract<>();
    tool.name = "task_list";
    tool.description = "List tasks through the canonical API execution flow.";
    tool.inputSchema = domainInputSchema();
    tool.outputSchema = domainOutputSchema();
    tool.isMutating = false;
    tool.requiresConfirmation = false;
    tool.executor = (input, runtimeContext) -> {
      TaskListApiCase apiCase = resolveApi(runtimeContext);
      ApiResponse<TaskListDomainCase.TaskListOutput> result = apiCase.handler(input);
      if (!result.success || result.data == null) {
        throw core.shared.AppStructuralContracts.toAppCaseError(
            result.error,
            "task_list API failed"
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
    mcp.name = "task_list";
    mcp.title = "List Tasks";
    mcp.description = "Inspect the current task board state through the canonical APP task_list API flow.";
    mcp.metadata = Map.of("category", "tasks", "mutating", false);
    return mcp;
  }

  @Override
  public AgenticRagContract rag() {
    AgenticRagContract rag = new AgenticRagContract();
    rag.topics = List.of("task_management", "board_state", "task_grounding");
    rag.resources = List.of(
        ragResource("case", "tasks/task_list", "Canonical board-state capability used for grounding agent decisions."),
        ragResource("case", "tasks/task_move", "Related board mutation capability that depends on accurate task identification."),
        ragResource("case", "tasks/task_create", "Related board mutation capability that adds new work into the backlog.")
    );
    rag.hints = List.of(
        "Use task_list before ambiguous mutations so the agent grounds itself on persisted ids and statuses."
    );
    rag.scope = "project";
    rag.mode = "recommended";
    return rag;
  }

  @Override
  public AgenticPolicy policy() {
    AgenticPolicy policy = new AgenticPolicy();
    policy.requireConfirmation = false;
    policy.riskLevel = "low";
    policy.executionMode = "direct-execution";
    return policy;
  }

  @Override
  public void test() throws Exception {
    validateDefinition();

    if (Boolean.TRUE.equals(tool().isMutating)) {
      throw new IllegalStateException("test: task_list agentic must be read-only");
    }

    if (rag().resources.isEmpty()) {
      throw new IllegalStateException("test: task_list should publish semantic RAG resources");
    }

    TaskListDomainCase.TaskListOutput example = examples().stream()
        .filter(item -> "board_with_cards".equals(item.name))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("test: task_list example must exist"))
        .output;

    AgenticContext successContext = new AgenticContext();
    successContext.correlationId = "task-list-agentic-test";
    successContext.logger = ctx.logger;
    successContext.cases.put("tasks", Map.of(
        "task_list", Map.of(
            "api", new TaskListApiCase(new core.BaseApiCase.ApiContext()) {
              @Override
              public ApiResponse<TaskListDomainCase.TaskListOutput> handler(
                  TaskListDomainCase.TaskListInput input
              ) {
                return ApiResponse.success(example, 200);
              }
            }
        )
    ));

    TaskListDomainCase.TaskListOutput result = tool().execute(
        new TaskListDomainCase.TaskListInput(),
        successContext
    );
    if (result.tasks().size() != example.tasks().size()) {
      throw new IllegalStateException("test: task_list tool must return the mocked task collection");
    }

    AgenticContext failureContext = new AgenticContext();
    failureContext.correlationId = "task-list-agentic-failure-test";
    failureContext.logger = ctx.logger;
    failureContext.cases.put("tasks", Map.of(
        "task_list", Map.of(
            "api", new TaskListApiCase(new core.BaseApiCase.ApiContext()) {
              @Override
              public ApiResponse<TaskListDomainCase.TaskListOutput> handler(
                  TaskListDomainCase.TaskListInput input
              ) {
                return ApiResponse.failure(
                    new core.shared.AppStructuralContracts.AppError(
                        "INTERNAL",
                        "Persisted task data is invalid",
                        null
                    ),
                    500
                );
              }
            }
        )
    ));

    boolean propagated = false;
    try {
      tool().execute(new TaskListDomainCase.TaskListInput(), failureContext);
    } catch (AppCaseError error) {
      propagated = "INTERNAL".equals(error.code());
    }

    if (!propagated) {
      throw new IllegalStateException("test: task_list must propagate AppCaseError failures");
    }
  }

  private TaskListApiCase resolveApi(AgenticContext runtimeContext) {
    Object tasksValue = runtimeContext.cases.get("tasks");
    if (!(tasksValue instanceof Map<?, ?> tasksMap)) {
      throw new AppCaseError("INTERNAL", "task_list.agentic requires ctx.cases.tasks");
    }

    Object caseValue = tasksMap.get("task_list");
    if (!(caseValue instanceof Map<?, ?> caseMap)) {
      throw new AppCaseError("INTERNAL", "task_list.agentic requires ctx.cases.tasks.task_list");
    }

    Object apiValue = caseMap.get("api");
    if (!(apiValue instanceof TaskListApiCase apiCase)) {
      throw new AppCaseError("INTERNAL", "task_list.agentic requires ctx.cases.tasks.task_list.api");
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
