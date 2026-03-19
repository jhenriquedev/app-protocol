import 'package:flutter/material.dart';

import '../../../core/ui.case.dart';
import 'task_create.domain.case.dart';

typedef TaskCreatedCallback = void Function(Map<String, dynamic> task);

class TaskCreateUi extends BaseUiCase<UIState> {
  TaskCreateUi(UiContext ctx)
    : super(ctx, <String, dynamic>{
        'modalOpen': false,
        'title': '',
        'description': '',
        'loading': false,
        'error': null,
        'result': null,
      });

  final TaskCreateDomain _domainCase = TaskCreateDomain();
  bool _submissionLocked = false;

  @override
  Widget view() {
    final designSystem = _resolveDesignSystem();

    return _TaskCreateView(uiCase: this, designSystem: designSystem);
  }

  @override
  Future<void> test() async {
    view();
    final result = await _service(
      const TaskCreateInput(
        title: 'Create task UI test',
        description: 'UI surface repository flow',
      ),
    );

    if (result.task.id.isEmpty) {
      throw Exception('test: ui service must return a created task id');
    }

    final viewModel = _viewmodel(<String, dynamic>{
      'modalOpen': false,
      'title': '',
      'description': '',
      'loading': false,
      'error': null,
      'result': result,
    });

    if (viewModel['feedback']?['type'] != 'success') {
      throw Exception('test: ui viewmodel must expose success feedback');
    }

    var threw = false;
    try {
      await _service(const TaskCreateInput(title: '   '));
    } catch (_) {
      threw = true;
    }

    if (!threw) {
      throw Exception('test: ui service must reject blank title');
    }

    if (!_acquireSubmissionLock()) {
      throw Exception('test: first submission lock acquisition must succeed');
    }

    if (_acquireSubmissionLock()) {
      throw Exception('test: submission lock must reject reentry');
    }

    _releaseSubmissionLock();

    if (!_acquireSubmissionLock()) {
      throw Exception('test: submission lock must be releasable');
    }

    _releaseSubmissionLock();
  }

  dynamic _resolveDesignSystem() {
    final packages = ctx.packages;
    final designSystem = packages?['designSystem'];

    if (designSystem == null) {
      throw Exception('task_create.ui requires packages.designSystem');
    }

    return designSystem;
  }

  Map<String, dynamic> _viewmodel(Map<String, dynamic> currentState) {
    if (currentState['error'] != null) {
      return <String, dynamic>{
        'feedback': <String, dynamic>{
          'type': 'error',
          'message': currentState['error'],
        },
      };
    }

    final result = currentState['result'];
    if (result is TaskCreateOutput) {
      return <String, dynamic>{
        'feedback': <String, dynamic>{
          'type': 'success',
          'message': 'Task "${result.task.title}" created successfully.',
        },
      };
    }

    return <String, dynamic>{'feedback': null};
  }

  Future<TaskCreateOutput> _service(TaskCreateInput input) async {
    _domainCase.validate(input);
    return _repository(input);
  }

  Future<TaskCreateOutput> _repository(TaskCreateInput input) async {
    final api = ctx.api;
    if (api == null) {
      throw Exception('task_create.ui requires ctx.api');
    }

    final response = await api.request(<String, dynamic>{
      'method': 'POST',
      'url': '/tasks',
      'body': input.toJson(),
    });

    final result = TaskCreateOutput.fromJson(response);
    if (result.task.id.isEmpty) {
      throw Exception('task_create.ui received an invalid create response');
    }

    return result;
  }

  bool _acquireSubmissionLock() {
    if (_submissionLocked) {
      return false;
    }

    _submissionLocked = true;
    return true;
  }

  void _releaseSubmissionLock() {
    _submissionLocked = false;
  }
}

class _TaskCreateView extends StatefulWidget {
  const _TaskCreateView({required this.uiCase, required this.designSystem});

  final TaskCreateUi uiCase;
  final dynamic designSystem;

  @override
  State<_TaskCreateView> createState() => _TaskCreateViewState();
}

class _TaskCreateViewState extends State<_TaskCreateView> {
  late Map<String, dynamic> _state;

  @override
  void initState() {
    super.initState();
    _state = Map<String, dynamic>.from(widget.uiCase.state);
  }

  void _setLocalState(Map<String, dynamic> partial) {
    setState(() {
      _state = <String, dynamic>{..._state, ...partial};
    });
  }

  Future<void> _submit() async {
    if (!widget.uiCase._acquireSubmissionLock()) {
      return;
    }

    _setLocalState(<String, dynamic>{'loading': true, 'error': null});

    try {
      final result = await widget.uiCase._service(
        TaskCreateInput(
          title: _state['title'],
          description: (_state['description'] as String?)?.isEmpty ?? true
              ? null
              : _state['description'],
        ),
      );

      final callback = widget.uiCase.ctx.extra?['onTaskCreated'];
      if (callback is TaskCreatedCallback) {
        callback(result.task.toJson());
      }

      _setLocalState(<String, dynamic>{
        'modalOpen': false,
        'title': '',
        'description': '',
        'loading': false,
        'error': null,
        'result': result,
      });
    } catch (error) {
      _setLocalState(<String, dynamic>{
        'loading': false,
        'error': error
            .toString()
            .replaceFirst('Exception: ', '')
            .replaceFirst('AppCaseError(VALIDATION_FAILED): ', ''),
      });
    } finally {
      widget.uiCase._releaseSubmissionLock();
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewModel = widget.uiCase._viewmodel(_state);
    final feedback = viewModel['feedback'] as Map<String, dynamic>?;

    return Stack(
      children: <Widget>[
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: <Widget>[
            widget.designSystem.createTaskButton(
              disabled: _state['loading'] == true,
              onPressed: () {
                _setLocalState(<String, dynamic>{
                  'modalOpen': true,
                  'error': null,
                });
              },
            ),
            if (feedback != null) ...<Widget>[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                decoration: BoxDecoration(
                  color: feedback['type'] == 'success'
                      ? const Color(0xFFDFF7E4)
                      : const Color(0xFFFFE1DD),
                  borderRadius: const BorderRadius.all(Radius.circular(14)),
                ),
                child: Text(
                  feedback['message']?.toString() ?? '',
                  style: TextStyle(
                    color: feedback['type'] == 'success'
                        ? const Color(0xFF0C6A36)
                        : const Color(0xFF9A2D1F),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ],
        ),
        widget.designSystem.taskFormDialog(
          open: _state['modalOpen'] == true,
          titleValue: _state['title']?.toString() ?? '',
          descriptionValue: _state['description']?.toString() ?? '',
          submitting: _state['loading'] == true,
          onTitleChange: (String value) {
            _setLocalState(<String, dynamic>{'title': value});
          },
          onDescriptionChange: (String value) {
            _setLocalState(<String, dynamic>{'description': value});
          },
          onClose: () {
            _setLocalState(<String, dynamic>{
              'modalOpen': false,
              'error': null,
            });
          },
          onSubmit: _submit,
        ),
      ],
    );
  }
}
