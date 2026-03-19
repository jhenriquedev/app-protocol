import '../../../core/domain.case.dart';

const List<String> taskCreateStatusValues = <String>['todo', 'doing', 'done'];

class TaskCreateTask {
  const TaskCreateTask({
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

  factory TaskCreateTask.fromJson(dynamic json) {
    final record = json is Map
        ? Map<String, dynamic>.from(json)
        : <String, dynamic>{};

    return TaskCreateTask(
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

class TaskCreateInput {
  const TaskCreateInput({required this.title, this.description, this.raw});

  final dynamic title;
  final dynamic description;
  final Dict? raw;

  factory TaskCreateInput.fromJson(dynamic json) {
    final record = json is Map
        ? Map<String, dynamic>.from(json)
        : <String, dynamic>{};

    return TaskCreateInput(
      title: record['title'],
      description: record['description'],
      raw: record,
    );
  }

  Dict toJson() {
    return {
      'title': title,
      if (description != null) 'description': description,
    };
  }
}

class TaskCreateOutput {
  const TaskCreateOutput({required this.task});

  final TaskCreateTask task;

  factory TaskCreateOutput.fromJson(dynamic json) {
    final record = json is Map
        ? Map<String, dynamic>.from(json)
        : <String, dynamic>{};
    return TaskCreateOutput(task: TaskCreateTask.fromJson(record['task']));
  }

  Dict toJson() {
    return {'task': task.toJson()};
  }
}

class TaskCreateDomain
    extends BaseDomainCase<TaskCreateInput, TaskCreateOutput> {
  @override
  String caseName() {
    return 'task_create';
  }

  @override
  String description() {
    return 'Creates a new task card for the board with an initial todo status.';
  }

  @override
  AppSchema inputSchema() {
    return {
      'type': 'object',
      'properties': {
        'title': {
          'type': 'string',
          'description': 'Visible task title shown on the card.',
        },
        'description': {
          'type': 'string',
          'description': 'Optional complementary task description.',
        },
      },
      'required': <String>['title'],
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
            'status': {'type': 'string', 'enum': taskCreateStatusValues},
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
  void validate(TaskCreateInput input) {
    final raw = input.raw ?? const <String, dynamic>{};

    if (input.title is! String) {
      throw Exception('title is required and must be a string');
    }

    if ((input.title as String).trim().isEmpty) {
      throw Exception('title must not be empty');
    }

    if (input.description != null && input.description is! String) {
      throw Exception('description must be a string when provided');
    }

    for (final field in <String>['id', 'status', 'createdAt', 'updatedAt']) {
      if (raw.containsKey(field)) {
        throw Exception('$field must not be provided by the caller');
      }
    }
  }

  @override
  List<String> invariants() {
    return const <String>[
      'Every new task starts with status todo.',
      'The backend is the source of truth for task id and timestamps.',
      'createdAt and updatedAt are equal on first creation.',
    ];
  }

  @override
  List<DomainExample<TaskCreateInput, TaskCreateOutput>> examples() {
    return const <DomainExample<TaskCreateInput, TaskCreateOutput>>[
      DomainExample<TaskCreateInput, TaskCreateOutput>(
        name: 'title_only',
        description: 'Create a task with only the required title.',
        input: TaskCreateInput(title: 'Ship the Flutter example'),
        output: TaskCreateOutput(
          task: TaskCreateTask(
            id: 'task_001',
            title: 'Ship the Flutter example',
            status: 'todo',
            createdAt: '2026-03-18T12:00:00.000Z',
            updatedAt: '2026-03-18T12:00:00.000Z',
          ),
        ),
      ),
      DomainExample<TaskCreateInput, TaskCreateOutput>(
        name: 'title_and_description',
        description: 'Create a task with an optional description.',
        input: TaskCreateInput(
          title: 'Prepare release notes',
          description: 'Summarize the scope of the Flutter APP example.',
        ),
        output: TaskCreateOutput(
          task: TaskCreateTask(
            id: 'task_002',
            title: 'Prepare release notes',
            description: 'Summarize the scope of the Flutter APP example.',
            status: 'todo',
            createdAt: '2026-03-18T12:10:00.000Z',
            updatedAt: '2026-03-18T12:10:00.000Z',
          ),
        ),
      ),
    ];
  }

  @override
  Future<void> test() async {
    final definition = this.definition();

    if (definition['caseName'] != 'task_create') {
      throw Exception('test: caseName must be task_create');
    }

    final inputSchemaDefinition = definition['inputSchema'] as AppSchema;
    final required =
        (inputSchemaDefinition['required'] as List<dynamic>? ?? const [])
            .map((dynamic item) => item.toString())
            .toList(growable: false);
    if (!required.contains('title')) {
      throw Exception('test: inputSchema must require title');
    }

    validate(
      const TaskCreateInput(title: 'Valid task', description: 'Optional text'),
    );

    var threw = false;
    try {
      validate(const TaskCreateInput(title: '   '));
    } catch (_) {
      threw = true;
    }

    if (!threw) {
      throw Exception('test: validate must reject blank title');
    }

    threw = false;
    try {
      validate(
        TaskCreateInput.fromJson(<String, dynamic>{
          'title': 'Bad task',
          'status': 'todo',
        }),
      );
    } catch (_) {
      threw = true;
    }

    if (!threw) {
      throw Exception('test: validate must reject forbidden fields');
    }

    final sampleExamples = examples();
    if (sampleExamples.isEmpty) {
      throw Exception('test: examples must be defined');
    }

    for (final example in sampleExamples) {
      validate(example.input);
      if (example.output?.task.status != 'todo') {
        throw Exception('test: example output must start in todo');
      }
    }
  }
}
