import 'package:flutter/material.dart';

import '../../../core/ui.case.dart';
import 'task_move.domain.case.dart';

typedef TaskMovedCallback = void Function(Map<String, dynamic> task);

class TaskMoveUi extends BaseUiCase<UIState> {
  TaskMoveUi(UiContext ctx)
    : super(ctx, <String, dynamic>{'loading': false, 'error': null});

  final TaskMoveDomain _domainCase = TaskMoveDomain();
  bool _moveLocked = false;

  @override
  Widget view() {
    final designSystem = _resolveDesignSystem();
    final task = ctx.extra?['task'];

    if (task is! Map<String, dynamic>) {
      throw Exception('task_move.ui requires extra.task');
    }

    return _TaskMoveView(uiCase: this, designSystem: designSystem, task: task);
  }

  @override
  Future<void> test() async {
    view();
    final task = ctx.extra?['task'];
    if (task is! Map<String, dynamic>) {
      throw Exception('test: task_move.ui requires extra.task');
    }

    final result = await _service(
      TaskMoveInput(taskId: task['id'], targetStatus: 'doing'),
    );

    if (result.task.status != 'doing') {
      throw Exception('test: ui service must return the moved task');
    }

    var threw = false;
    try {
      await _service(const TaskMoveInput(taskId: '', targetStatus: 'done'));
    } catch (_) {
      threw = true;
    }

    if (!threw) {
      throw Exception('test: ui service must reject invalid input');
    }

    if (!_acquireMoveLock()) {
      throw Exception('test: first move lock acquisition must succeed');
    }

    if (_acquireMoveLock()) {
      throw Exception('test: move lock must reject reentry');
    }

    _releaseMoveLock();

    if (!_acquireMoveLock()) {
      throw Exception('test: move lock must be releasable');
    }

    _releaseMoveLock();
  }

  dynamic _resolveDesignSystem() {
    final packages = ctx.packages;
    final designSystem = packages?['designSystem'];

    if (designSystem == null) {
      throw Exception('task_move.ui requires packages.designSystem');
    }

    return designSystem;
  }

  Future<TaskMoveOutput> _service(TaskMoveInput input) async {
    _domainCase.validate(input);
    return _repository(input);
  }

  Future<TaskMoveOutput> _repository(TaskMoveInput input) async {
    final api = ctx.api;
    if (api == null) {
      throw Exception('task_move.ui requires ctx.api');
    }

    final response = await api.request(<String, dynamic>{
      'method': 'PATCH',
      'url': '/tasks/${input.taskId}/status',
      'body': <String, dynamic>{'targetStatus': input.targetStatus},
    });

    final result = TaskMoveOutput.fromJson(response);
    if (result.task.id.isEmpty) {
      throw Exception('task_move.ui received an invalid move response');
    }

    return result;
  }

  bool _acquireMoveLock() {
    if (_moveLocked) {
      return false;
    }

    _moveLocked = true;
    return true;
  }

  void _releaseMoveLock() {
    _moveLocked = false;
  }
}

class _TaskMoveView extends StatefulWidget {
  const _TaskMoveView({
    required this.uiCase,
    required this.designSystem,
    required this.task,
  });

  final TaskMoveUi uiCase;
  final dynamic designSystem;
  final Map<String, dynamic> task;

  @override
  State<_TaskMoveView> createState() => _TaskMoveViewState();
}

class _TaskMoveViewState extends State<_TaskMoveView> {
  late Map<String, dynamic> _state;

  @override
  void initState() {
    super.initState();
    _state = Map<String, dynamic>.from(widget.uiCase.state);
  }

  Future<void> _move(String nextStatus) async {
    if (!widget.uiCase._acquireMoveLock()) {
      return;
    }

    setState(() {
      _state = <String, dynamic>{'loading': true, 'error': null};
    });

    try {
      final result = await widget.uiCase._service(
        TaskMoveInput(taskId: widget.task['id'], targetStatus: nextStatus),
      );

      final callback = widget.uiCase.ctx.extra?['onTaskMoved'];
      if (callback is TaskMovedCallback) {
        callback(result.task.toJson());
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _state = <String, dynamic>{'loading': false, 'error': null};
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _state = <String, dynamic>{
          'loading': false,
          'error': error.toString().replaceFirst('Exception: ', ''),
        };
      });
    } finally {
      widget.uiCase._releaseMoveLock();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        widget.designSystem.moveTaskAction(
          currentStatus: widget.task['status']?.toString() ?? 'todo',
          submitting: _state['loading'] == true,
          onMove: _move,
        ),
        if (_state['error'] != null) ...<Widget>[
          const SizedBox(height: 8),
          Text(
            _state['error']?.toString() ?? '',
            style: const TextStyle(color: Color(0xFF9A2D1F), fontSize: 13),
          ),
        ],
      ],
    );
  }
}
