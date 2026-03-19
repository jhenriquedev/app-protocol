import '../../../core/agentic.case.dart';
import '../../../core/api.case.dart';
import '../../../core/shared/app_structural_contracts.dart';
import 'task_move.domain.case.dart';

typedef _TaskMoveHandler =
    Future<ApiResponse<TaskMoveOutput>> Function(TaskMoveInput input);

class TaskMoveAgentic extends BaseAgenticCase<TaskMoveInput, TaskMoveOutput> {
  TaskMoveAgentic(super.ctx);

  @override
  TaskMoveDomain domain() {
    return TaskMoveDomain();
  }

  @override
  AgenticDiscovery discovery() {
    return AgenticDiscovery(
      name: domainCaseName() ?? 'task_move',
      description:
          domainDescription() ??
          'Move an existing task card to another board column.',
      category: 'tasks',
      tags: const <String>['tasks', 'move', 'status'],
      aliases: const <String>[
        'move_task',
        'change_task_status',
        'advance_task',
      ],
      capabilities: const <String>['task_move', 'board_mutation'],
      intents: const <String>[
        'move a task',
        'change task status',
        'advance work on the board',
      ],
    );
  }

  @override
  AgenticExecutionContext context() {
    return const AgenticExecutionContext(
      requiresAuth: false,
      dependencies: <String>[
        'task_move.domain',
        'task_move.api',
        'task_list.agentic',
      ],
      preconditions: <String>[
        'A concrete taskId and a valid targetStatus are required.',
      ],
      constraints: <String>[
        'Use task_list first when the user refers to a task ambiguously.',
        'Execution must delegate to the canonical API surface.',
      ],
      notes: <String>[
        'Moving a task is a mutating action and should be confirmed by the host runtime.',
      ],
    );
  }

  @override
  AgenticPrompt prompt() {
    return const AgenticPrompt(
      purpose: 'Move an existing task to todo, doing, or done by task id.',
      whenToUse: <String>[
        'When the user explicitly wants to move an existing task card.',
        'When the user wants to update the progress status of known work.',
      ],
      whenNotToUse: <String>[
        'When the user wants to create a task.',
        'When the user has not provided enough information to identify the task.',
      ],
      constraints: <String>[
        'Do not invent a taskId.',
        'Require confirmation before mutating the board.',
      ],
      reasoningHints: <String>[
        'If the task is ambiguous, list current tasks first and ask the user to confirm the intended card.',
      ],
      expectedOutcome:
          'The updated task object with the requested target status persisted.',
    );
  }

  @override
  AgenticToolContract<TaskMoveInput, TaskMoveOutput> tool() {
    final inputSchema = domainInputSchema();
    final outputSchema = domainOutputSchema();

    if (inputSchema == null || outputSchema == null) {
      throw Exception('task_move.agentic requires domain schemas');
    }

    return AgenticToolContract<TaskMoveInput, TaskMoveOutput>(
      name: 'task_move',
      description: 'Move a task through the canonical API execution flow.',
      inputSchema: inputSchema,
      outputSchema: outputSchema,
      parseInput: (dynamic value) =>
          value is TaskMoveInput ? value : TaskMoveInput.fromJson(value),
      isMutating: true,
      requiresConfirmation: true,
      execute: (TaskMoveInput input, AgenticContext runtimeContext) async {
        final handler = _resolveHandler(runtimeContext);
        final result = await handler(input);

        if (!result.success || result.data == null) {
          throw toAppCaseError(result.error, 'task_move API failed');
        }

        return result.data!;
      },
    );
  }

  @override
  AgenticMcpContract mcp() {
    return const AgenticMcpContract(
      enabled: true,
      name: 'task_move',
      title: 'Move Task',
      description:
          'Move a task between board columns through the canonical APP task_move API flow.',
      metadata: <String, dynamic>{'category': 'tasks', 'mutating': true},
    );
  }

  @override
  AgenticRagContract rag() {
    return const AgenticRagContract(
      topics: <String>[
        'task_management',
        'status_transitions',
        'board_mutation',
      ],
      resources: <RagResource>[
        RagResource(
          kind: 'case',
          ref: 'tasks/task_move',
          description:
              'Canonical board mutation capability for changing task status.',
        ),
        RagResource(
          kind: 'case',
          ref: 'tasks/task_list',
          description:
              'Grounding capability used to identify persisted task ids before moving them.',
        ),
      ],
      hints: <String>[
        'Use task_list to ground ambiguous references before proposing or executing a move.',
        'Preserve explicit confirmation because task_move mutates persisted board state.',
      ],
      scope: 'project',
      mode: 'recommended',
    );
  }

  @override
  AgenticPolicy policy() {
    return const AgenticPolicy(
      requireConfirmation: true,
      riskLevel: 'medium',
      executionMode: 'manual-approval',
      limits: <String>[
        'Do not execute a move without explicit confirmation from the host runtime.',
      ],
    );
  }

  _TaskMoveHandler _resolveHandler(AgenticContext runtimeContext) {
    final tasksDomain = runtimeContext.cases?['tasks'];
    if (tasksDomain is! Map<String, dynamic>) {
      throw const AppCaseError(
        'INTERNAL',
        'task_move requires ctx.cases.tasks',
      );
    }

    final taskMove = tasksDomain['task_move'];
    if (taskMove is! Map<String, dynamic>) {
      throw const AppCaseError(
        'INTERNAL',
        'task_move requires ctx.cases.tasks.task_move',
      );
    }

    final handler = taskMove['apiHandler'];
    if (handler is _TaskMoveHandler) {
      return handler;
    }

    if (handler is Function) {
      return (TaskMoveInput input) async {
        final response = await Function.apply(handler, <dynamic>[input]);
        if (response is ApiResponse) {
          return ApiResponse<TaskMoveOutput>(
            success: response.success,
            data: response.data as TaskMoveOutput?,
            error: response.error,
            statusCode: response.statusCode,
          );
        }

        throw const AppCaseError(
          'INTERNAL',
          'task_move canonical API handler returned an invalid response',
        );
      };
    }

    throw const AppCaseError(
      'INTERNAL',
      'task_move requires a canonical API handler',
    );
  }

  @override
  Future<void> test() async {
    validateDefinition();

    final definition = this.definition();
    if (definition.tool.requiresConfirmation != true) {
      throw Exception('test: task_move tool must require confirmation');
    }

    if (definition.policy?.executionMode != 'manual-approval') {
      throw Exception('test: task_move should default to manual approval');
    }

    if ((definition.rag?.resources?.isEmpty ?? true)) {
      throw Exception('test: task_move should publish semantic RAG resources');
    }

    final example = examples().firstWhere(
      (AgenticExample<TaskMoveInput, TaskMoveOutput> item) =>
          item.name == 'move_todo_to_doing',
    );
    Future<ApiResponse<TaskMoveOutput>> successHandler(TaskMoveInput _) async {
      return ApiResponse.success(example.output);
    }

    Future<ApiResponse<TaskMoveOutput>> failureHandler(TaskMoveInput _) async {
      return ApiResponse.failure(
        const AppErrorData(
          code: 'NOT_FOUND',
          message: 'Task missing was not found',
        ),
      );
    }

    final result = await tool().execute(
      example.input,
      AgenticContext(
        correlationId: 'task-move-agentic-test',
        logger: ctx.logger,
        cases: <String, dynamic>{
          'tasks': <String, dynamic>{
            'task_move': <String, dynamic>{'apiHandler': successHandler},
          },
        },
      ),
    );

    if (result.task.status != example.output.task.status) {
      throw Exception('test: task_move tool must return the moved task');
    }

    Object? propagatedError;
    try {
      await tool().execute(
        example.input,
        AgenticContext(
          correlationId: 'task-move-agentic-failure-test',
          logger: ctx.logger,
          cases: <String, dynamic>{
            'tasks': <String, dynamic>{
              'task_move': <String, dynamic>{'apiHandler': failureHandler},
            },
          },
        ),
      );
    } catch (error) {
      propagatedError = error;
    }

    if (propagatedError is! AppCaseError) {
      throw Exception('test: task_move must propagate AppCaseError failures');
    }

    if (propagatedError.code != 'NOT_FOUND') {
      throw Exception('test: task_move must preserve NOT_FOUND from API');
    }
  }
}
