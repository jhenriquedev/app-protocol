import '../../../core/agentic.case.dart';
import '../../../core/api.case.dart';
import '../../../core/shared/app_structural_contracts.dart';
import 'task_create.domain.case.dart';

typedef _TaskCreateHandler =
    Future<ApiResponse<TaskCreateOutput>> Function(TaskCreateInput input);

class TaskCreateAgentic
    extends BaseAgenticCase<TaskCreateInput, TaskCreateOutput> {
  TaskCreateAgentic(super.ctx);

  @override
  TaskCreateDomain domain() {
    return TaskCreateDomain();
  }

  @override
  AgenticDiscovery discovery() {
    return AgenticDiscovery(
      name: domainCaseName() ?? 'task_create',
      description:
          domainDescription() ?? 'Create a new task card for the board.',
      category: 'tasks',
      tags: const <String>['tasks', 'creation', 'board'],
      aliases: const <String>['create_task', 'new_task_card', 'add_board_task'],
      capabilities: const <String>['task_creation'],
      intents: const <String>[
        'create a task',
        'add a task',
        'add work to the board',
      ],
    );
  }

  @override
  AgenticExecutionContext context() {
    return const AgenticExecutionContext(
      requiresAuth: false,
      requiresTenant: false,
      dependencies: <String>['task_create.domain', 'task_create.api'],
      preconditions: <String>['A non-empty title must be provided.'],
      constraints: <String>[
        'The caller must not provide id, status, createdAt, or updatedAt.',
        'Execution must delegate to the canonical API surface.',
        'Descriptions stay optional and should only be passed when the user supplied them.',
      ],
      notes: <String>[
        'New tasks always start in todo.',
        'The backend is the source of truth for identifiers and timestamps.',
      ],
    );
  }

  @override
  AgenticPrompt prompt() {
    return const AgenticPrompt(
      purpose:
          'Create a new task with a required title and an optional description.',
      whenToUse: <String>[
        'When the user asks to create or add a new task card.',
        'When new work needs to be placed into the board backlog.',
      ],
      whenNotToUse: <String>[
        'When the user wants to inspect existing tasks.',
        'When the user wants to move an existing task between columns.',
      ],
      constraints: <String>[
        'Ask for a title if the user did not provide one.',
        'Do not invent backend-controlled fields.',
      ],
      reasoningHints: <String>[
        'Treat description as optional and pass it only when the user gave enough detail.',
        'Prefer concise titles because they are displayed directly on the board card.',
      ],
      expectedOutcome:
          'A created task object with status todo and backend-generated identity fields.',
    );
  }

  @override
  AgenticToolContract<TaskCreateInput, TaskCreateOutput> tool() {
    final inputSchema = domainInputSchema();
    final outputSchema = domainOutputSchema();

    if (inputSchema == null || outputSchema == null) {
      throw Exception('task_create.agentic requires domain schemas');
    }

    return AgenticToolContract<TaskCreateInput, TaskCreateOutput>(
      name: 'task_create',
      description: 'Create a task through the canonical API execution flow.',
      inputSchema: inputSchema,
      outputSchema: outputSchema,
      parseInput: (dynamic value) =>
          value is TaskCreateInput ? value : TaskCreateInput.fromJson(value),
      isMutating: true,
      execute: (TaskCreateInput input, AgenticContext runtimeContext) async {
        final handler = _resolveHandler(runtimeContext);
        final result = await handler(input);

        if (!result.success || result.data == null) {
          throw toAppCaseError(result.error, 'task_create API failed');
        }

        return result.data!;
      },
    );
  }

  @override
  AgenticMcpContract mcp() {
    return const AgenticMcpContract(
      enabled: true,
      name: 'task_create',
      title: 'Create Task',
      description:
          'Create a board task through the canonical APP task_create API flow.',
      metadata: <String, dynamic>{'category': 'tasks', 'mutating': true},
    );
  }

  @override
  AgenticRagContract rag() {
    return const AgenticRagContract(
      topics: <String>['task_management', 'board_backlog', 'task_creation'],
      resources: <RagResource>[
        RagResource(
          kind: 'case',
          ref: 'tasks/task_create',
          description: 'Canonical task creation capability for new board work.',
        ),
        RagResource(
          kind: 'case',
          ref: 'tasks/task_list',
          description:
              'Board grounding capability for inspecting current tasks before adding related work.',
        ),
      ],
      hints: <String>[
        'Prefer the canonical backlog language used by the board.',
        'Keep task titles concise because they render directly on cards.',
      ],
      scope: 'project',
      mode: 'recommended',
    );
  }

  @override
  AgenticPolicy policy() {
    return const AgenticPolicy(
      requireConfirmation: false,
      riskLevel: 'low',
      executionMode: 'direct-execution',
      limits: <String>['Use only for explicit task-creation intent.'],
    );
  }

  _TaskCreateHandler _resolveHandler(AgenticContext runtimeContext) {
    final tasksDomain = runtimeContext.cases?['tasks'];
    if (tasksDomain is! Map<String, dynamic>) {
      throw const AppCaseError(
        'INTERNAL',
        'task_create requires ctx.cases.tasks',
      );
    }

    final taskCreate = tasksDomain['task_create'];
    if (taskCreate is! Map<String, dynamic>) {
      throw const AppCaseError(
        'INTERNAL',
        'task_create requires ctx.cases.tasks.task_create',
      );
    }

    final handler = taskCreate['apiHandler'];
    if (handler is _TaskCreateHandler) {
      return handler;
    }

    if (handler is Function) {
      return (TaskCreateInput input) async {
        final response = await Function.apply(handler, <dynamic>[input]);
        if (response is ApiResponse) {
          return ApiResponse<TaskCreateOutput>(
            success: response.success,
            data: response.data as TaskCreateOutput?,
            error: response.error,
            statusCode: response.statusCode,
          );
        }

        throw const AppCaseError(
          'INTERNAL',
          'task_create canonical API handler returned an invalid response',
        );
      };
    }

    throw const AppCaseError(
      'INTERNAL',
      'task_create requires a canonical API handler',
    );
  }

  @override
  Future<void> test() async {
    validateDefinition();

    final definition = this.definition();
    if (definition.tool.isMutating != true) {
      throw Exception('test: task_create agentic must be mutating');
    }

    if (definition.policy?.executionMode != 'direct-execution') {
      throw Exception('test: task_create should default to direct execution');
    }

    if ((definition.rag?.resources?.isEmpty ?? true)) {
      throw Exception(
        'test: task_create should publish semantic RAG resources',
      );
    }

    final example = examples().firstWhere(
      (AgenticExample<TaskCreateInput, TaskCreateOutput> item) =>
          item.name == 'title_only',
    );
    Future<ApiResponse<TaskCreateOutput>> successHandler(
      TaskCreateInput _,
    ) async {
      return ApiResponse.success(example.output);
    }

    Future<ApiResponse<TaskCreateOutput>> failureHandler(
      TaskCreateInput _,
    ) async {
      return ApiResponse.failure(
        const AppErrorData(
          code: 'VALIDATION_FAILED',
          message: 'title must not be empty',
        ),
      );
    }

    final result = await tool().execute(
      example.input,
      AgenticContext(
        correlationId: 'task-create-agentic-test',
        logger: ctx.logger,
        cases: <String, dynamic>{
          'tasks': <String, dynamic>{
            'task_create': <String, dynamic>{'apiHandler': successHandler},
          },
        },
      ),
    );

    if (result.task.status != 'todo') {
      throw Exception('test: task_create tool must return a todo task');
    }

    Object? propagatedError;
    try {
      await tool().execute(
        example.input,
        AgenticContext(
          correlationId: 'task-create-agentic-failure-test',
          logger: ctx.logger,
          cases: <String, dynamic>{
            'tasks': <String, dynamic>{
              'task_create': <String, dynamic>{'apiHandler': failureHandler},
            },
          },
        ),
      );
    } catch (error) {
      propagatedError = error;
    }

    if (propagatedError is! AppCaseError) {
      throw Exception('test: task_create must propagate AppCaseError failures');
    }

    if (propagatedError.code != 'VALIDATION_FAILED') {
      throw Exception('test: task_create must preserve validation error codes');
    }
  }
}
