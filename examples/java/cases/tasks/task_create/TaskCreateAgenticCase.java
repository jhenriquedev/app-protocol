package cases.tasks.task_create;

import core.BaseAgenticCase;
import core.BaseApiCase.ApiResponse;
import core.shared.AppStructuralContracts.AppCaseError;
import java.util.List;
import java.util.Map;

public class TaskCreateAgenticCase extends BaseAgenticCase<
    TaskCreateDomainCase.TaskCreateInput,
    TaskCreateDomainCase.TaskCreateOutput
> {
  public TaskCreateAgenticCase(AgenticContext ctx) {
    super(ctx);
  }

  @Override
  protected TaskCreateDomainCase domain() {
    return new TaskCreateDomainCase();
  }

  @Override
  public AgenticDiscovery discovery() {
    AgenticDiscovery discovery = new AgenticDiscovery();
    discovery.name = domainCaseName();
    discovery.description = domainDescription();
    discovery.category = "tasks";
    discovery.tags = List.of("tasks", "creation", "board");
    discovery.aliases = List.of("create_task", "new_task_card", "add_board_task");
    discovery.capabilities = List.of("task_creation");
    discovery.intents = List.of("create a task", "add a task", "add work to the board");
    return discovery;
  }

  @Override
  public AgenticExecutionContext context() {
    AgenticExecutionContext context = new AgenticExecutionContext();
    context.requiresAuth = false;
    context.requiresTenant = false;
    context.dependencies = List.of("task_create.domain", "task_create.api");
    context.preconditions = List.of("A non-empty title must be provided.");
    context.constraints = List.of(
        "The caller must not provide id, status, createdAt, or updatedAt.",
        "Execution must delegate to the canonical API surface.",
        "Descriptions stay optional and should only be passed when the user supplied them."
    );
    context.notes = List.of(
        "New tasks always start in todo.",
        "The backend is the source of truth for identifiers and timestamps."
    );
    return context;
  }

  @Override
  public AgenticPrompt prompt() {
    AgenticPrompt prompt = new AgenticPrompt();
    prompt.purpose = "Create a new task with a required title and an optional description.";
    prompt.whenToUse = List.of(
        "When the user asks to create or add a new task card.",
        "When new work needs to be placed into the board backlog."
    );
    prompt.whenNotToUse = List.of(
        "When the user wants to inspect existing tasks.",
        "When the user wants to move an existing task between columns."
    );
    prompt.constraints = List.of(
        "Ask for a title if the user did not provide one.",
        "Do not invent backend-controlled fields."
    );
    prompt.reasoningHints = List.of(
        "Treat description as optional and pass it only when the user gave enough detail.",
        "Prefer concise titles because they are displayed directly on the board card."
    );
    prompt.expectedOutcome = "A created task object with status todo and backend-generated identity fields.";
    return prompt;
  }

  @Override
  public AgenticToolContract<TaskCreateDomainCase.TaskCreateInput, TaskCreateDomainCase.TaskCreateOutput> tool() {
    AgenticToolContract<TaskCreateDomainCase.TaskCreateInput, TaskCreateDomainCase.TaskCreateOutput> tool =
        new AgenticToolContract<>();
    tool.name = "task_create";
    tool.description = "Create a task through the canonical API execution flow.";
    tool.inputSchema = domainInputSchema();
    tool.outputSchema = domainOutputSchema();
    tool.isMutating = true;
    tool.requiresConfirmation = false;
    tool.executor = (input, runtimeContext) -> {
      TaskCreateApiCase apiCase = resolveApi(runtimeContext);
      ApiResponse<TaskCreateDomainCase.TaskCreateOutput> result = apiCase.handler(input);
      if (!result.success || result.data == null) {
        throw core.shared.AppStructuralContracts.toAppCaseError(
            result.error,
            "task_create API failed"
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
    mcp.name = "task_create";
    mcp.title = "Create Task";
    mcp.description = "Create a board task through the canonical APP task_create API flow.";
    mcp.metadata = Map.of("category", "tasks", "mutating", true);
    return mcp;
  }

  @Override
  public AgenticRagContract rag() {
    AgenticRagContract rag = new AgenticRagContract();
    rag.topics = List.of("task_management", "board_backlog", "task_creation");
    rag.resources = List.of(
        ragResource("case", "tasks/task_create", "Canonical task creation capability for new board work."),
        ragResource("case", "tasks/task_list", "Board grounding capability for inspecting current tasks before adding related work.")
    );
    rag.hints = List.of(
        "Prefer the canonical backlog language used by the board.",
        "Keep task titles concise because they render directly on cards."
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
    policy.limits = List.of("Use only for explicit task-creation intent.");
    return policy;
  }

  @Override
  public void test() throws Exception {
    validateDefinition();

    if (!Boolean.TRUE.equals(tool().isMutating)) {
      throw new IllegalStateException("test: task_create agentic must be mutating");
    }

    if (!"direct-execution".equals(policy().executionMode)) {
      throw new IllegalStateException("test: task_create should default to direct execution");
    }

    if (rag().resources.isEmpty()) {
      throw new IllegalStateException("test: task_create should publish semantic RAG resources");
    }

    TaskCreateDomainCase.TaskCreateOutput example = examples().stream()
        .filter(item -> "title_only".equals(item.name))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("test: task_create example must exist"))
        .output;

    AgenticContext successContext = new AgenticContext();
    successContext.correlationId = "task-create-agentic-test";
    successContext.logger = ctx.logger;
    successContext.cases.put("tasks", Map.of(
        "task_create", Map.of(
            "api", new TaskCreateApiCase(new core.BaseApiCase.ApiContext()) {
              @Override
              public ApiResponse<TaskCreateDomainCase.TaskCreateOutput> handler(
                  TaskCreateDomainCase.TaskCreateInput input
              ) {
                return ApiResponse.success(example, 201);
              }
            }
        )
    ));

    TaskCreateDomainCase.TaskCreateOutput result = tool().execute(
        new TaskCreateDomainCase.TaskCreateInput("Create a task", null),
        successContext
    );
    if (!"todo".equals(result.task().status())) {
      throw new IllegalStateException("test: task_create tool must return a todo task");
    }

    AgenticContext failureContext = new AgenticContext();
    failureContext.correlationId = "task-create-agentic-failure-test";
    failureContext.logger = ctx.logger;
    failureContext.cases.put("tasks", Map.of(
        "task_create", Map.of(
            "api", new TaskCreateApiCase(new core.BaseApiCase.ApiContext()) {
              @Override
              public ApiResponse<TaskCreateDomainCase.TaskCreateOutput> handler(
                  TaskCreateDomainCase.TaskCreateInput input
              ) {
                return ApiResponse.failure(
                    new core.shared.AppStructuralContracts.AppError(
                        "VALIDATION_FAILED",
                        "title must not be empty",
                        null
                    ),
                    400
                );
              }
            }
        )
    ));

    boolean propagated = false;
    try {
      tool().execute(new TaskCreateDomainCase.TaskCreateInput("Bad", null), failureContext);
    } catch (AppCaseError error) {
      propagated = "VALIDATION_FAILED".equals(error.code());
    }

    if (!propagated) {
      throw new IllegalStateException("test: task_create must propagate AppCaseError failures");
    }
  }

  private TaskCreateApiCase resolveApi(AgenticContext runtimeContext) {
    Object tasksValue = runtimeContext.cases.get("tasks");
    if (!(tasksValue instanceof Map<?, ?> tasksMap)) {
      throw new AppCaseError("INTERNAL", "task_create.agentic requires ctx.cases.tasks");
    }

    Object caseValue = tasksMap.get("task_create");
    if (!(caseValue instanceof Map<?, ?> caseMap)) {
      throw new AppCaseError("INTERNAL", "task_create.agentic requires ctx.cases.tasks.task_create");
    }

    Object apiValue = caseMap.get("api");
    if (!(apiValue instanceof TaskCreateApiCase apiCase)) {
      throw new AppCaseError("INTERNAL", "task_create.agentic requires ctx.cases.tasks.task_create.api");
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
