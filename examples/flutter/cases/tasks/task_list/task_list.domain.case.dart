import '../../../core/domain.case.dart';

const List<String> taskListStatusValues = <String>['todo', 'doing', 'done'];

bool _isTaskStatus(dynamic value) {
  return value is String && taskListStatusValues.contains(value);
}

class TaskListTask {
  const TaskListTask({
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

  factory TaskListTask.fromJson(dynamic json) {
    final record = json is Map
        ? Map<String, dynamic>.from(json)
        : <String, dynamic>{};

    return TaskListTask(
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

class TaskListInput {
  const TaskListInput({required this.raw});

  final Dict raw;

  factory TaskListInput.fromJson(dynamic json) {
    if (json is Map) {
      return TaskListInput(raw: Map<String, dynamic>.from(json));
    }

    return const TaskListInput(raw: <String, dynamic>{});
  }
}

class TaskListOutput {
  const TaskListOutput({required this.tasks});

  final List<TaskListTask> tasks;

  factory TaskListOutput.fromJson(dynamic json) {
    final record = json is Map
        ? Map<String, dynamic>.from(json)
        : <String, dynamic>{};
    final items = record['tasks'] is List
        ? record['tasks'] as List<dynamic>
        : const <dynamic>[];

    return TaskListOutput(
      tasks: items.map(TaskListTask.fromJson).toList(growable: false),
    );
  }

  Dict toJson() {
    return {
      'tasks': tasks
          .map((TaskListTask task) => task.toJson())
          .toList(growable: false),
    };
  }
}

void assertTaskCollection(dynamic value, String source) {
  if (value is! List) {
    throw Exception('$source must be an array');
  }

  for (var index = 0; index < value.length; index += 1) {
    _assertTaskRecord(value[index], '$source[$index]');
  }
}

void _assertTaskRecord(dynamic value, String source) {
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

  if (!_isTaskStatus(record['status'])) {
    throw Exception(
      '$source.status must be one of ${taskListStatusValues.join(', ')}',
    );
  }

  final description = record['description'];
  if (description != null && description is! String) {
    throw Exception('$source.description must be a string when provided');
  }
}

class TaskListDomain extends BaseDomainCase<TaskListInput, TaskListOutput> {
  @override
  String caseName() {
    return 'task_list';
  }

  @override
  String description() {
    return 'Lists persisted task cards for board rendering.';
  }

  @override
  AppSchema inputSchema() {
    return {
      'type': 'object',
      'properties': <String, dynamic>{},
      'additionalProperties': false,
    };
  }

  @override
  AppSchema outputSchema() {
    return {
      'type': 'object',
      'properties': {
        'tasks': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'id': {'type': 'string'},
              'title': {'type': 'string'},
              'description': {'type': 'string'},
              'status': {'type': 'string', 'enum': taskListStatusValues},
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
      },
      'required': <String>['tasks'],
      'additionalProperties': false,
    };
  }

  @override
  void validate(TaskListInput input) {
    if (input.raw.isNotEmpty) {
      throw Exception('task_list does not accept filters in v1');
    }
  }

  void validateOutput(TaskListOutput output) {
    assertTaskCollection(
      output.tasks
          .map((TaskListTask item) => item.toJson())
          .toList(growable: false),
      'task_list.output.tasks',
    );
  }

  @override
  List<String> invariants() {
    return const <String>[
      'Only todo, doing, done are valid task statuses.',
      'Listing tasks never mutates the persisted store.',
      'The response order is deterministic for the same persisted dataset.',
    ];
  }

  @override
  List<DomainExample<TaskListInput, TaskListOutput>> examples() {
    return const <DomainExample<TaskListInput, TaskListOutput>>[
      DomainExample<TaskListInput, TaskListOutput>(
        name: 'empty_board',
        description: 'No persisted tasks yet.',
        input: TaskListInput(raw: <String, dynamic>{}),
        output: TaskListOutput(tasks: <TaskListTask>[]),
      ),
      DomainExample<TaskListInput, TaskListOutput>(
        name: 'board_with_cards',
        description: 'Returns tasks already persisted in the board.',
        input: TaskListInput(raw: <String, dynamic>{}),
        output: TaskListOutput(
          tasks: <TaskListTask>[
            TaskListTask(
              id: 'task_002',
              title: 'Prepare release notes',
              status: 'todo',
              createdAt: '2026-03-18T12:10:00.000Z',
              updatedAt: '2026-03-18T12:10:00.000Z',
            ),
            TaskListTask(
              id: 'task_001',
              title: 'Ship the Flutter example',
              description: 'Wire the first APP cases in the portal.',
              status: 'doing',
              createdAt: '2026-03-18T12:00:00.000Z',
              updatedAt: '2026-03-18T12:30:00.000Z',
            ),
          ],
        ),
      ),
    ];
  }

  @override
  Future<void> test() async {
    validate(const TaskListInput(raw: <String, dynamic>{}));

    var threw = false;
    try {
      validate(const TaskListInput(raw: <String, dynamic>{'status': 'todo'}));
    } catch (_) {
      threw = true;
    }

    if (!threw) {
      throw Exception('test: task_list input must reject filters');
    }

    final example = examples().firstWhere(
      (DomainExample<TaskListInput, TaskListOutput> item) =>
          item.name == 'board_with_cards',
    );
    validateOutput(example.output!);

    threw = false;
    try {
      validateOutput(
        TaskListOutput(
          tasks: const <TaskListTask>[
            TaskListTask(
              id: 'bad',
              title: 'Invalid task',
              status: 'invalid',
              createdAt: '2026-03-18T12:00:00.000Z',
              updatedAt: '2026-03-18T12:00:00.000Z',
            ),
          ],
        ),
      );
    } catch (_) {
      threw = true;
    }

    if (!threw) {
      throw Exception('test: validateOutput must reject invalid task status');
    }
  }
}
