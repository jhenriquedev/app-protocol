import '../../../core/domain.case.dart';

const List<String> taskMoveStatusValues = <String>['todo', 'doing', 'done'];

bool _isTaskMoveStatus(dynamic value) {
  return value is String && taskMoveStatusValues.contains(value);
}

class TaskMoveTask {
  const TaskMoveTask({
    required this.id,
    required this.title,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.description,
  });

  final String id;
  final String title;
  final String? description;
  final String status;
  final String createdAt;
  final String updatedAt;

  factory TaskMoveTask.fromJson(dynamic json) {
    final record = json is Map
        ? Map<String, dynamic>.from(json)
        : <String, dynamic>{};

    return TaskMoveTask(
      id: record['id']?.toString() ?? '',
      title: record['title']?.toString() ?? '',
      description: record['description']?.toString(),
      status: record['status']?.toString() ?? '',
      createdAt: record['createdAt']?.toString() ?? '',
      updatedAt: record['updatedAt']?.toString() ?? '',
    );
  }

  Dict toJson() {
    return {
      'id': id,
      'title': title,
      if (description != null) 'description': description,
      'status': status,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class TaskMoveInput {
  const TaskMoveInput({required this.taskId, required this.targetStatus});

  final dynamic taskId;
  final dynamic targetStatus;

  factory TaskMoveInput.fromJson(dynamic json) {
    final record = json is Map
        ? Map<String, dynamic>.from(json)
        : <String, dynamic>{};
    return TaskMoveInput(
      taskId: record['taskId'],
      targetStatus: record['targetStatus'],
    );
  }
}

class TaskMoveOutput {
  const TaskMoveOutput({required this.task});

  final TaskMoveTask task;

  factory TaskMoveOutput.fromJson(dynamic json) {
    final record = json is Map
        ? Map<String, dynamic>.from(json)
        : <String, dynamic>{};
    return TaskMoveOutput(task: TaskMoveTask.fromJson(record['task']));
  }

  Dict toJson() {
    return {'task': task.toJson()};
  }
}

void assertTaskMoveRecord(dynamic value, String source) {
  if (value is! Map) {
    throw Exception('$source must be an object');
  }

  final record = Map<String, dynamic>.from(value);
  for (final field in <String>['id', 'title', 'createdAt', 'updatedAt']) {
    final current = record[field];
    if (current is! String || current.trim().isEmpty) {
      throw Exception('$source.$field must be a non-empty string');
    }
  }

  if (!_isTaskMoveStatus(record['status'])) {
    throw Exception(
      '$source.status must be one of ${taskMoveStatusValues.join(', ')}',
    );
  }

  final description = record['description'];
  if (description != null && description is! String) {
    throw Exception('$source.description must be a string when provided');
  }
}

class TaskMoveDomain extends BaseDomainCase<TaskMoveInput, TaskMoveOutput> {
  @override
  String caseName() {
    return 'task_move';
  }

  @override
  String description() {
    return 'Moves an existing task card to another board column.';
  }

  @override
  AppSchema inputSchema() {
    return {
      'type': 'object',
      'properties': {
        'taskId': {
          'type': 'string',
          'description': 'Identifier of the task that will be moved.',
        },
        'targetStatus': {
          'type': 'string',
          'description': 'Destination board column for the task.',
          'enum': taskMoveStatusValues,
        },
      },
      'required': <String>['taskId', 'targetStatus'],
      'additionalProperties': false,
    };
  }

  @override
  AppSchema outputSchema() {
    return {
      'type': 'object',
      'properties': {
        'task': {
          'type': 'object',
          'properties': {
            'id': {'type': 'string'},
            'title': {'type': 'string'},
            'description': {'type': 'string'},
            'status': {'type': 'string', 'enum': taskMoveStatusValues},
            'createdAt': {'type': 'string'},
            'updatedAt': {'type': 'string'},
          },
          'required': <String>[
            'id',
            'title',
            'status',
            'createdAt',
            'updatedAt',
          ],
          'additionalProperties': false,
        },
      },
      'required': <String>['task'],
      'additionalProperties': false,
    };
  }

  @override
  void validate(TaskMoveInput input) {
    if (input.taskId is! String || (input.taskId as String).trim().isEmpty) {
      throw Exception('taskId is required');
    }

    if (!_isTaskMoveStatus(input.targetStatus)) {
      throw Exception(
        'targetStatus must be one of ${taskMoveStatusValues.join(', ')}',
      );
    }
  }

  void validateOutput(TaskMoveOutput output) {
    assertTaskMoveRecord(output.task.toJson(), 'task_move.output.task');
  }

  @override
  List<String> invariants() {
    return const <String>[
      'Moving a task never changes its identity.',
      'A move only updates status and, when applicable, updatedAt.',
      'Moving to the same status is idempotent and returns the unchanged task.',
    ];
  }

  @override
  List<DomainExample<TaskMoveInput, TaskMoveOutput>> examples() {
    return const <DomainExample<TaskMoveInput, TaskMoveOutput>>[
      DomainExample<TaskMoveInput, TaskMoveOutput>(
        name: 'move_todo_to_doing',
        description: 'A task leaves todo and enters doing.',
        input: TaskMoveInput(taskId: 'task_001', targetStatus: 'doing'),
        output: TaskMoveOutput(
          task: TaskMoveTask(
            id: 'task_001',
            title: 'Ship the Flutter example',
            status: 'doing',
            createdAt: '2026-03-18T12:00:00.000Z',
            updatedAt: '2026-03-18T12:20:00.000Z',
          ),
        ),
      ),
      DomainExample<TaskMoveInput, TaskMoveOutput>(
        name: 'idempotent_move',
        description: 'Moving to the same status keeps the task unchanged.',
        input: TaskMoveInput(taskId: 'task_002', targetStatus: 'done'),
        output: TaskMoveOutput(
          task: TaskMoveTask(
            id: 'task_002',
            title: 'Prepare release notes',
            status: 'done',
            createdAt: '2026-03-18T12:10:00.000Z',
            updatedAt: '2026-03-18T12:10:00.000Z',
          ),
        ),
      ),
    ];
  }

  @override
  Future<void> test() async {
    validate(const TaskMoveInput(taskId: 'task_001', targetStatus: 'doing'));

    var threw = false;
    try {
      validate(const TaskMoveInput(taskId: '', targetStatus: 'doing'));
    } catch (_) {
      threw = true;
    }

    if (!threw) {
      throw Exception('test: validate must reject empty taskId');
    }

    threw = false;
    try {
      validate(
        const TaskMoveInput(taskId: 'task_001', targetStatus: 'invalid'),
      );
    } catch (_) {
      threw = true;
    }

    if (!threw) {
      throw Exception('test: validate must reject invalid targetStatus');
    }

    validateOutput(
      const TaskMoveOutput(
        task: TaskMoveTask(
          id: 'task_001',
          title: 'Valid task',
          status: 'doing',
          createdAt: '2026-03-18T12:00:00.000Z',
          updatedAt: '2026-03-18T12:20:00.000Z',
        ),
      ),
    );

    threw = false;
    try {
      validateOutput(
        const TaskMoveOutput(
          task: TaskMoveTask(
            id: 'task_001',
            title: 'Broken task',
            status: 'invalid',
            createdAt: '2026-03-18T12:00:00.000Z',
            updatedAt: '2026-03-18T12:20:00.000Z',
            description: 'Broken payload',
          ),
        ),
      );
    } catch (_) {
      threw = true;
    }

    if (!threw) {
      throw Exception('test: validateOutput must reject invalid task payloads');
    }
  }
}
