import '../../../core/agentic.case.dart';
import '../../../core/api.case.dart';
import '../../../core/shared/app_structural_contracts.dart';
import 'task_list.domain.case.dart';

typedef _TaskListHandler =
    Future<ApiResponse<TaskListOutput>> Function(TaskListInput input);

class TaskListAgentic extends BaseAgenticCase<TaskListInput, TaskListOutput> {
  TaskListAgentic(super.ctx);

  @override
  TaskListDomain domain() {
    return TaskListDomain();
  }

  @override
  AgenticDiscovery discovery() {
    return AgenticDiscovery(
      name: domainCaseName() ?? 'task_list',
      description:
          domainDescription() ??
          'List persisted task cards for board rendering.',
      category: 'tasks',
      tags: const <String>['tasks', 'listing', 'board'],
      aliases: const <String>[
        'list_board_tasks',
        'show_board',
        'inspect_board_state',
      ],
      capabilities: const <String>['task_listing', 'board_grounding'],
      intents: const <String>[
        'list tasks',
        'show the board',
        'show current tasks',
      ],
    );
  }

  @override
  AgenticExecutionContext context() {
    return const AgenticExecutionContext(
      requiresAuth: false,
      dependencies: <String>['task_list.domain', 'task_list.api'],
      preconditions: <String>['The persisted task store must be readable.'],
      constraints: <String>[
        'This capability is read-only.',
        'No filters or pagination are supported in v1.',
      ],
      notes: <String>[
        'Use this capability to ground follow-up decisions before mutating the board.',
      ],
    );
  }

  @override
  AgenticPrompt prompt() {
    return const AgenticPrompt(
      purpose:
          'List all persisted tasks so an agent can inspect the board state.',
      whenToUse: <String>[
        'When the user asks to see the board or current tasks.',
        'Before moving a task when the user has not provided an exact task identifier.',
      ],
      whenNotToUse: <String>[
        'When the user wants to create a new task.',
        'When the user already provided a precise task id for a direct move operation.',
      ],
      constraints: <String>[
        'Do not claim support for filters or search in this v1 example.',
      ],
      reasoningHints: <String>[
        'Treat task_list as the canonical grounding step before ambiguous task mutations.',
      ],
      expectedOutcome:
          'A flat array of task objects ordered by createdAt descending.',
    );
  }

  @override
  AgenticToolContract<TaskListInput, TaskListOutput> tool() {
    final inputSchema = domainInputSchema();
    final outputSchema = domainOutputSchema();

    if (inputSchema == null || outputSchema == null) {
      throw Exception('task_list.agentic requires domain schemas');
    }

    return AgenticToolContract<TaskListInput, TaskListOutput>(
      name: 'task_list',
      description: 'List tasks through the canonical API execution flow.',
      inputSchema: inputSchema,
      outputSchema: outputSchema,
      parseInput: (dynamic value) =>
          value is TaskListInput ? value : TaskListInput.fromJson(value),
      isMutating: false,
      execute: (TaskListInput input, AgenticContext runtimeContext) async {
        final handler = _resolveHandler(runtimeContext);
        final result = await handler(input);

        if (!result.success || result.data == null) {
          throw toAppCaseError(result.error, 'task_list API failed');
        }

        return result.data!;
      },
    );
  }

  @override
  AgenticMcpContract mcp() {
    return const AgenticMcpContract(
      enabled: true,
      name: 'task_list',
      title: 'List Tasks',
      description:
          'Inspect the current task board state through the canonical APP task_list API flow.',
      metadata: <String, dynamic>{'category': 'tasks', 'mutating': false},
    );
  }

  @override
  AgenticRagContract rag() {
    return const AgenticRagContract(
      topics: <String>['task_management', 'board_state', 'task_grounding'],
      resources: <RagResource>[
        RagResource(
          kind: 'case',
          ref: 'tasks/task_list',
          description:
              'Canonical board-state capability used for grounding agent decisions.',
        ),
        RagResource(
          kind: 'case',
          ref: 'tasks/task_move',
          description:
              'Related board mutation capability that depends on accurate task identification.',
        ),
        RagResource(
          kind: 'case',
          ref: 'tasks/task_create',
          description:
              'Related board mutation capability that adds new work into the backlog.',
        ),
      ],
      hints: <String>[
        'Use task_list before ambiguous mutations so the agent grounds itself on persisted ids and statuses.',
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
    );
  }

  _TaskListHandler _resolveHandler(AgenticContext runtimeContext) {
    final tasksDomain = runtimeContext.cases?['tasks'];
    if (tasksDomain is! Map<String, dynamic>) {
      throw const AppCaseError(
        'INTERNAL',
        'task_list requires ctx.cases.tasks',
      );
    }

    final taskList = tasksDomain['task_list'];
    if (taskList is! Map<String, dynamic>) {
      throw const AppCaseError(
        'INTERNAL',
        'task_list requires ctx.cases.tasks.task_list',
      );
    }

    final handler = taskList['apiHandler'];
    if (handler is _TaskListHandler) {
      return handler;
    }

    if (handler is Function) {
      return (TaskListInput input) async {
        final response = await Function.apply(handler, <dynamic>[input]);
        if (response is ApiResponse) {
          return ApiResponse<TaskListOutput>(
            success: response.success,
            data: response.data as TaskListOutput?,
            error: response.error,
            statusCode: response.statusCode,
          );
        }

        throw const AppCaseError(
          'INTERNAL',
          'task_list canonical API handler returned an invalid response',
        );
      };
    }

    throw const AppCaseError(
      'INTERNAL',
      'task_list requires a canonical API handler',
    );
  }

  @override
  Future<void> test() async {
    validateDefinition();

    final definition = this.definition();
    if (definition.tool.isMutating == true) {
      throw Exception('test: task_list agentic must be read-only');
    }

    if ((definition.rag?.resources?.isEmpty ?? true)) {
      throw Exception('test: task_list should publish semantic RAG resources');
    }

    final example = examples().firstWhere(
      (AgenticExample<TaskListInput, TaskListOutput> item) =>
          item.name == 'board_with_cards',
    );
    Future<ApiResponse<TaskListOutput>> successHandler(TaskListInput _) async {
      return ApiResponse.success(example.output);
    }

    Future<ApiResponse<TaskListOutput>> failureHandler(TaskListInput _) async {
      return ApiResponse.failure(
        const AppErrorData(
          code: 'INTERNAL',
          message: 'Persisted task data is invalid',
        ),
      );
    }

    final result = await tool().execute(
      example.input,
      AgenticContext(
        correlationId: 'task-list-agentic-test',
        logger: ctx.logger,
        cases: <String, dynamic>{
          'tasks': <String, dynamic>{
            'task_list': <String, dynamic>{'apiHandler': successHandler},
          },
        },
      ),
    );

    if (result.tasks.length != example.output.tasks.length) {
      throw Exception(
        'test: task_list tool must return the mocked task collection',
      );
    }

    Object? propagatedError;
    try {
      await tool().execute(
        example.input,
        AgenticContext(
          correlationId: 'task-list-agentic-failure-test',
          logger: ctx.logger,
          cases: <String, dynamic>{
            'tasks': <String, dynamic>{
              'task_list': <String, dynamic>{'apiHandler': failureHandler},
            },
          },
        ),
      );
    } catch (error) {
      propagatedError = error;
    }

    if (propagatedError is! AppCaseError) {
      throw Exception('test: task_list must propagate AppCaseError failures');
    }

    if (propagatedError.code != 'INTERNAL') {
      throw Exception('test: task_list must preserve API error codes');
    }
  }
}
