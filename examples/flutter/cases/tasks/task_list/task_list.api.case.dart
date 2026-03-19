import '../../../core/api.case.dart';
import '../../../core/shared/app_structural_contracts.dart';
import 'task_list.domain.case.dart';

int _taskListStatusCode(String? code) {
  switch (code) {
    case 'VALIDATION_FAILED':
      return 400;
    default:
      return 500;
  }
}

class TaskListApi extends BaseApiCase<TaskListInput, TaskListOutput> {
  TaskListApi(super.ctx);

  final TaskListDomain _domainCase = TaskListDomain();

  @override
  Future<ApiResponse<TaskListOutput>> handler([
    TaskListInput input = const TaskListInput(raw: <String, dynamic>{}),
  ]) async {
    final result = await execute(input, validate: _validate, service: _service);

    if (result.success) {
      return ApiResponse.success(
        result.data as TaskListOutput,
        statusCode: 200,
      );
    }

    return ApiResponse.failure(
      result.error!,
      statusCode: _taskListStatusCode(result.error?.code),
    );
  }

  @override
  RouteBinding router() {
    return RouteBinding(
      method: 'GET',
      path: '/tasks',
      handler: (RouteRequest _) async {
        return handler();
      },
    );
  }

  @override
  Future<void> test() async {
    final taskStore = _resolveTaskStore();
    await taskStore.reset();
    try {
      await taskStore.write(<Map<String, dynamic>>[
        const TaskListTask(
          id: 'task_001',
          title: 'Older task',
          status: 'todo',
          createdAt: '2026-03-18T12:00:00.000Z',
          updatedAt: '2026-03-18T12:00:00.000Z',
        ).toJson(),
        const TaskListTask(
          id: 'task_002',
          title: 'Newer task',
          status: 'doing',
          createdAt: '2026-03-18T12:30:00.000Z',
          updatedAt: '2026-03-18T12:30:00.000Z',
        ).toJson(),
      ]);

      final result = await handler();
      if (!result.success || result.data == null) {
        throw Exception('test: handler should return a successful task list');
      }

      if (result.data!.tasks.length != 2) {
        throw Exception('test: task list should return all persisted tasks');
      }

      if (result.data!.tasks.first.id != 'task_002') {
        throw Exception('test: task list should sort by createdAt descending');
      }

      await taskStore.write(<Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'broken',
          'title': 'Broken task',
          'status': 'broken',
          'createdAt': '2026-03-18T12:00:00.000Z',
          'updatedAt': '2026-03-18T12:00:00.000Z',
        },
      ]);

      final invalidResult = await handler();
      if (invalidResult.success) {
        throw Exception('test: invalid persisted records must return failure');
      }
    } finally {
      await taskStore.reset();
    }
  }

  Future<void> _validate(TaskListInput input) async {
    try {
      _domainCase.validate(input);
    } catch (error) {
      throw AppCaseError(
        'VALIDATION_FAILED',
        error is Exception
            ? error.toString().replaceFirst('Exception: ', '')
            : 'task_list validation failed',
      );
    }
  }

  dynamic _repository() {
    return _resolveTaskStore();
  }

  Future<TaskListOutput> _service(TaskListInput _) async {
    final taskStore = _repository();
    final tasks = await taskStore.read();

    try {
      assertTaskCollection(tasks, 'task_list.persisted_tasks');
    } catch (error) {
      throw AppCaseError(
        'INTERNAL',
        error is Exception
            ? error.toString().replaceFirst('Exception: ', '')
            : 'Persisted task data is invalid',
      );
    }

    final sortedTasks =
        (tasks as List)
            .map(
              (dynamic item) =>
                  TaskListTask.fromJson(Map<String, dynamic>.from(item as Map)),
            )
            .toList(growable: true)
          ..sort(
            (TaskListTask left, TaskListTask right) => DateTime.parse(
              right.createdAt,
            ).compareTo(DateTime.parse(left.createdAt)),
          );

    final output = TaskListOutput(tasks: sortedTasks);
    _domainCase.validateOutput(output);
    return output;
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
        'task_list requires packages.data.taskStore',
      );
    }

    return taskStore;
  }
}
