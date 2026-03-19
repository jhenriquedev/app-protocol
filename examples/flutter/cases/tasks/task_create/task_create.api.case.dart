import '../../../core/api.case.dart';
import '../../../core/shared/app_structural_contracts.dart';
import 'task_create.domain.case.dart';

int _taskCreateIdCounter = 0;

String _generateTaskId() {
  _taskCreateIdCounter += 1;
  return 'task_${DateTime.now().microsecondsSinceEpoch}_$_taskCreateIdCounter';
}

int _mapErrorCodeToStatus(String? code) {
  switch (code) {
    case 'VALIDATION_FAILED':
      return 400;
    case 'NOT_FOUND':
      return 404;
    default:
      return 500;
  }
}

class TaskCreateApi extends BaseApiCase<TaskCreateInput, TaskCreateOutput> {
  TaskCreateApi(super.ctx);

  final TaskCreateDomain _domainCase = TaskCreateDomain();

  @override
  Future<ApiResponse<TaskCreateOutput>> handler(TaskCreateInput input) async {
    final result = await execute(input, validate: _validate, service: _service);

    if (result.success) {
      return ApiResponse.success(
        result.data as TaskCreateOutput,
        statusCode: 201,
      );
    }

    return ApiResponse.failure(
      result.error!,
      statusCode: _mapErrorCodeToStatus(result.error?.code),
    );
  }

  @override
  RouteBinding router() {
    return RouteBinding(
      method: 'POST',
      path: '/tasks',
      handler: (RouteRequest request) async {
        return handler(TaskCreateInput.fromJson(request.body));
      },
    );
  }

  @override
  Future<void> test() async {
    final store = _resolveTaskStore();
    await store.reset();
    try {
      final result = await handler(
        const TaskCreateInput(
          title: 'Test task',
          description: 'Created by task_create.api test',
        ),
      );

      if (!result.success || result.data == null) {
        throw Exception('test: handler should return success');
      }

      if (result.statusCode != 201) {
        throw Exception('test: successful create must return statusCode 201');
      }

      if (result.data!.task.status != 'todo') {
        throw Exception('test: created task must start in todo');
      }

      final persisted = await store.read();
      if (persisted.length != 1) {
        throw Exception('test: created task must be persisted');
      }

      await store.reset();

      final concurrentCreates = await Future.wait(
        List<Future<ApiResponse<TaskCreateOutput>>>.generate(
          4,
          (int index) =>
              handler(TaskCreateInput(title: 'Concurrent task ${index + 1}')),
        ),
      );

      if (concurrentCreates.any(
        (ApiResponse<TaskCreateOutput> item) => !item.success,
      )) {
        throw Exception('test: concurrent creates must all succeed');
      }

      final concurrentPersisted = await store.read();
      if (concurrentPersisted.length != 4) {
        throw Exception('test: concurrent creates must persist every task');
      }

      var threw = false;
      try {
        await _validate(const TaskCreateInput(title: '   '));
      } catch (_) {
        threw = true;
      }

      if (!threw) {
        throw Exception('test: _validate must reject blank title');
      }
    } finally {
      await store.reset();
    }
  }

  Future<void> _validate(TaskCreateInput input) async {
    try {
      _domainCase.validate(input);
    } catch (error) {
      throw AppCaseError(
        'VALIDATION_FAILED',
        error is Exception
            ? error.toString().replaceFirst('Exception: ', '')
            : 'task_create validation failed',
      );
    }
  }

  dynamic _repository() {
    return _resolveTaskStore();
  }

  Future<TaskCreateOutput> _service(TaskCreateInput input) async {
    final taskStore = _repository();
    final timestamp = DateTime.now().toUtc().toIso8601String();
    final task = TaskCreateTask(
      id: _generateTaskId(),
      title: (input.title as String).trim(),
      description: (input.description as String?)?.trim().isEmpty ?? true
          ? null
          : (input.description as String?)?.trim(),
      status: 'todo',
      createdAt: timestamp,
      updatedAt: timestamp,
    );

    await taskStore.update((List<Map<String, dynamic>> tasks) async {
      return <Map<String, dynamic>>[task.toJson(), ...tasks];
    });

    ctx.logger.info('task_create: task persisted', {
      'taskId': task.id,
      'title': task.title,
    });

    return TaskCreateOutput(task: task);
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
        'task_create requires packages.data.taskStore',
      );
    }

    return taskStore;
  }
}
