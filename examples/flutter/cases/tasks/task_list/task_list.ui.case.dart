import 'package:flutter/material.dart';

import '../../../core/ui.case.dart';
import 'task_list.domain.case.dart';

typedef TaskCardActionsRenderer = Widget? Function(TaskListTask task);

class TaskListUi extends BaseUiCase<UIState> {
  TaskListUi(UiContext ctx)
    : super(ctx, <String, dynamic>{
        'tasks': <TaskListTask>[],
        'loading': true,
        'error': null,
      });

  final TaskListDomain _domainCase = TaskListDomain();

  @override
  Widget view() {
    final designSystem = _resolveDesignSystem();
    final refreshToken = ctx.extra?['refreshToken'] as int? ?? 0;
    final renderCardActions =
        ctx.extra?['renderCardActions'] as TaskCardActionsRenderer?;

    return _TaskListView(
      key: ValueKey<int>(refreshToken),
      uiCase: this,
      designSystem: designSystem,
      renderCardActions: renderCardActions,
    );
  }

  @override
  Future<void> test() async {
    view();
    final api = ctx.api;
    if (api == null) {
      throw Exception('task_list.ui requires ctx.api');
    }

    final createdTodo =
        await api.request(<String, dynamic>{
              'method': 'POST',
              'url': '/tasks',
              'body': <String, dynamic>{
                'title': 'Task list UI todo card',
                'description': 'Seeded by task_list.ui.test',
              },
            })
            as Map<String, dynamic>;
    final createdDoing =
        await api.request(<String, dynamic>{
              'method': 'POST',
              'url': '/tasks',
              'body': <String, dynamic>{
                'title': 'Task list UI doing card',
                'description': 'Seeded by task_list.ui.test',
              },
            })
            as Map<String, dynamic>;
    final doingTask = Map<String, dynamic>.from(
      createdDoing['task'] as Map<String, dynamic>,
    );

    await api.request(<String, dynamic>{
      'method': 'PATCH',
      'url': '/tasks/${doingTask['id']}/status',
      'body': const <String, dynamic>{'targetStatus': 'doing'},
    });

    final result = await _service(
      const TaskListInput(raw: <String, dynamic>{}),
    );
    final todoTask = Map<String, dynamic>.from(
      createdTodo['task'] as Map<String, dynamic>,
    );

    if (!result.tasks.any((TaskListTask task) => task.id == todoTask['id']) ||
        !result.tasks.any((TaskListTask task) => task.id == doingTask['id'])) {
      throw Exception('test: ui service must include the seeded tasks');
    }

    final viewModel = _viewmodel(<String, dynamic>{
      'tasks': result.tasks,
      'loading': false,
      'error': null,
    });

    final columns = viewModel['columns'] as List<Map<String, dynamic>>;
    final todoColumn = columns.firstWhere(
      (Map<String, dynamic> column) => column['status'] == 'todo',
    );
    final doingColumn = columns.firstWhere(
      (Map<String, dynamic> column) => column['status'] == 'doing',
    );

    final todoTasks = todoColumn['tasks'] as List<TaskListTask>;
    final doingTasks = doingColumn['tasks'] as List<TaskListTask>;
    if (!todoTasks.any((TaskListTask task) => task.id == todoTask['id']) ||
        !doingTasks.any((TaskListTask task) => task.id == doingTask['id'])) {
      throw Exception(
        'test: ui viewmodel must group the seeded tasks by status',
      );
    }
  }

  dynamic _resolveDesignSystem() {
    final packages = ctx.packages;
    final designSystem = packages?['designSystem'];

    if (designSystem == null) {
      throw Exception('task_list.ui requires packages.designSystem');
    }

    return designSystem;
  }

  Map<String, dynamic> _viewmodel(Map<String, dynamic> currentState) {
    final tasks = (currentState['tasks'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<TaskListTask>()
        .toList(growable: false);
    final isLoading = currentState['loading'] == true;

    return <String, dynamic>{
      'columns': <Map<String, dynamic>>[
        <String, dynamic>{
          'status': 'todo',
          'title': 'To Do',
          'tasks': tasks
              .where((TaskListTask task) => task.status == 'todo')
              .toList(growable: false),
          'emptyMessage': isLoading ? 'Loading cards...' : 'No cards in to do.',
        },
        <String, dynamic>{
          'status': 'doing',
          'title': 'Doing',
          'tasks': tasks
              .where((TaskListTask task) => task.status == 'doing')
              .toList(growable: false),
          'emptyMessage': isLoading ? 'Loading cards...' : 'No cards in doing.',
        },
        <String, dynamic>{
          'status': 'done',
          'title': 'Done',
          'tasks': tasks
              .where((TaskListTask task) => task.status == 'done')
              .toList(growable: false),
          'emptyMessage': isLoading ? 'Loading cards...' : 'No cards in done.',
        },
      ],
      'feedback': currentState['error'],
    };
  }

  Future<TaskListOutput> _service(TaskListInput input) async {
    _domainCase.validate(input);
    return _repository(input);
  }

  Future<TaskListOutput> _repository(TaskListInput _) async {
    final api = ctx.api;
    if (api == null) {
      throw Exception('task_list.ui requires ctx.api');
    }

    final response = await api.request(<String, dynamic>{
      'method': 'GET',
      'url': '/tasks',
    });

    final result = TaskListOutput.fromJson(response);
    _domainCase.validateOutput(result);
    return result;
  }
}

class _TaskListView extends StatefulWidget {
  const _TaskListView({
    super.key,
    required this.uiCase,
    required this.designSystem,
    this.renderCardActions,
  });

  final TaskListUi uiCase;
  final dynamic designSystem;
  final TaskCardActionsRenderer? renderCardActions;

  @override
  State<_TaskListView> createState() => _TaskListViewState();
}

class _TaskListViewState extends State<_TaskListView> {
  late Map<String, dynamic> _state;

  @override
  void initState() {
    super.initState();
    _state = Map<String, dynamic>.from(widget.uiCase.state);
    _loadTasks();
  }

  Future<void> _loadTasks() async {
    setState(() {
      _state = <String, dynamic>{..._state, 'loading': true, 'error': null};
    });

    try {
      final result = await widget.uiCase._service(
        const TaskListInput(raw: <String, dynamic>{}),
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _state = <String, dynamic>{
          'tasks': result.tasks,
          'loading': false,
          'error': null,
        };
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _state = <String, dynamic>{
          'tasks': <TaskListTask>[],
          'loading': false,
          'error': error.toString().replaceFirst('Exception: ', ''),
        };
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewModel = widget.uiCase._viewmodel(_state);
    final columns = viewModel['columns'] as List<Map<String, dynamic>>;
    final feedback = viewModel['feedback'] as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        if (feedback != null) ...<Widget>[
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: const BoxDecoration(
              color: Color(0xFFFFE1DD),
              borderRadius: BorderRadius.all(Radius.circular(14)),
            ),
            child: Text(
              feedback,
              style: const TextStyle(
                color: Color(0xFF9A2D1F),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
        widget.designSystem.taskBoard(
          children: columns
              .map((Map<String, dynamic> column) {
                final items = column['tasks'] as List<TaskListTask>;

                return widget.designSystem.taskColumn(
                  title: column['title'] as String,
                  count: items.length,
                  children: items.isNotEmpty
                      ? items
                            .map(
                              (TaskListTask task) =>
                                  widget.designSystem.taskCard(
                                    title: task.title,
                                    description: task.description,
                                    status: task.status,
                                    actions: widget.renderCardActions?.call(
                                      task,
                                    ),
                                  ),
                            )
                            .toList(growable: false)
                      : <Widget>[
                          widget.designSystem.emptyColumnState(
                            message: column['emptyMessage'] as String,
                          ),
                        ],
                );
              })
              .toList(growable: false),
        ),
      ],
    );
  }
}
