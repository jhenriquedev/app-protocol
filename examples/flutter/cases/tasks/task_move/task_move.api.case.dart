import '../../../core/api.case.dart';
import '../../../core/shared/app_structural_contracts.dart';
import 'task_move.domain.case.dart';

int _taskMoveStatusCode(String? code) {
  switch (code) {
    case 'VALIDATION_FAILED':
      return 400;
    case 'NOT_FOUND':
      return 404;
    default:
      return 500;
  }
}

class TaskMoveApi extends BaseApiCase<TaskMoveInput, TaskMoveOutput> {
  TaskMoveApi(super.ctx);

  final TaskMoveDomain _domainCase = TaskMoveDomain();

  @override
  Future<ApiResponse<TaskMoveOutput>> handler(TaskMoveInput input) async {
    final result = await execute(input, validate: _validate, service: _service);

    if (result.success) {
      return ApiResponse.success(
        result.data as TaskMoveOutput,
        statusCode: 200,
      );
    }

    return ApiResponse.failure(
      result.error!,
      statusCode: _taskMoveStatusCode(result.error?.code),
    );
  }

  @override
  RouteBinding router() {
    return RouteBinding(
      method: 'PATCH',
      path: '/tasks/:taskId/status',
      handler: (RouteRequest request) async {
        final body = request.body is Map
            ? Map<String, dynamic>.from(request.body as Map)
            : <String, dynamic>{};
        return handler(
          TaskMoveInput(
            taskId: request.params['taskId'],
            targetStatus: body['targetStatus'],
          ),
        );
      },
    );
  }

  @override
  Future<void> test() async {
    final taskStore = _resolveTaskStore();
    await taskStore.reset();
    try {
      await taskStore.write(<Map<String, dynamic>>[
        const TaskMoveTask(
          id: 'task_001',
          title: 'Ship the Flutter example',
          status: 'todo',
          createdAt: '2026-03-18T12:00:00.000Z',
          updatedAt: '2026-03-18T12:00:00.000Z',
        ).toJson(),
      ]);

      final movedResult = await handler(
        const TaskMoveInput(taskId: 'task_001', targetStatus: 'doing'),
      );

      if (!movedResult.success || movedResult.data == null) {
        throw Exception('test: move should return success');
      }

      if (movedResult.data!.task.status != 'doing') {
        throw Exception('test: task status must change to doing');
      }

      final persisted = await taskStore.read();
      if (persisted.first['status'] != 'doing') {
        throw Exception('test: moved status must persist');
      }

      final idempotentResult = await handler(
        const TaskMoveInput(taskId: 'task_001', targetStatus: 'doing'),
      );
      if (!idempotentResult.success || idempotentResult.data == null) {
        throw Exception('test: idempotent move should still succeed');
      }

      final notFoundResult = await handler(
        const TaskMoveInput(taskId: 'missing', targetStatus: 'done'),
      );
      if (notFoundResult.success || notFoundResult.statusCode != 404) {
        throw Exception('test: missing task must return NOT_FOUND');
      }

      await taskStore.write(<Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'task_002',
          'title': 'Broken task',
          'description': 123,
          'status': 'todo',
          'createdAt': '2026-03-18T12:00:00.000Z',
          'updatedAt': '2026-03-18T12:00:00.000Z',
        },
      ]);

      final invalidPersistedResult = await handler(
        const TaskMoveInput(taskId: 'task_002', targetStatus: 'doing'),
      );
      if (invalidPersistedResult.success ||
          invalidPersistedResult.statusCode != 500) {
        throw Exception('test: invalid persisted task must return failure');
      }
    } finally {
      await taskStore.reset();
    }
  }

  Future<void> _validate(TaskMoveInput input) async {
    try {
      _domainCase.validate(input);
    } catch (error) {
      throw AppCaseError(
        'VALIDATION_FAILED',
        error is Exception
            ? error.toString().replaceFirst('Exception: ', '')
            : 'task_move validation failed',
      );
    }
  }

  dynamic _repository() {
    return _resolveTaskStore();
  }

  Future<TaskMoveOutput> _service(TaskMoveInput input) async {
    final taskStore = _repository();
    TaskMoveOutput? output;
    String? previousStatus;

    await taskStore.update((List<Map<String, dynamic>> tasks) async {
      final taskIndex = tasks.indexWhere(
        (Map<String, dynamic> task) =>
            task['id']?.toString() == input.taskId?.toString(),
      );

      if (taskIndex < 0) {
        throw AppCaseError('NOT_FOUND', 'Task ${input.taskId} was not found');
      }

      final currentTaskMap = tasks[taskIndex];
      try {
        assertTaskMoveRecord(currentTaskMap, 'task_move.persisted_task');
      } catch (error) {
        throw AppCaseError(
          'INTERNAL',
          error is Exception
              ? error.toString().replaceFirst('Exception: ', '')
              : 'Persisted task data is invalid',
        );
      }

      final currentTask = TaskMoveTask.fromJson(currentTaskMap);
      if (currentTask.status == input.targetStatus) {
        output = TaskMoveOutput(task: currentTask);
        _domainCase.validateOutput(output!);
        return tasks;
      }

      previousStatus = currentTask.status;
      final updatedTask = TaskMoveTask(
        id: currentTask.id,
        title: currentTask.title,
        description: currentTask.description,
        status: input.targetStatus as String,
        createdAt: currentTask.createdAt,
        updatedAt: DateTime.now().toUtc().toIso8601String(),
      );

      output = TaskMoveOutput(task: updatedTask);
      _domainCase.validateOutput(output!);

      final updatedTasks = List<Map<String, dynamic>>.from(tasks);
      updatedTasks[taskIndex] = updatedTask.toJson();
      return updatedTasks;
    });

    if (output == null) {
      throw const AppCaseError(
        'INTERNAL',
        'task_move did not produce an output',
      );
    }

    if (previousStatus != null) {
      ctx.logger.info('task_move: task status updated', {
        'taskId': output!.task.id,
        'from': previousStatus,
        'to': output!.task.status,
      });
    }

    return output!;
  }

  dynamic _resolveTaskStore() {
    final packages = ctx.packages;
    final dataPackage = packages?['data'];
    dynamic taskStore;

    try {
      taskStore = dataPackage?.taskStore;
    } catch (_) {
      taskStore = null;
    }

    if (taskStore == null) {
      throw const AppCaseError(
        'INTERNAL',
        'task_move requires packages.data.taskStore',
      );
    }

    return taskStore;
  }
}
