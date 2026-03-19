import 'package:flutter/material.dart';

import '../../cases/tasks/task_list/task_list.domain.case.dart';
import '../../core/ui.case.dart';
import 'registry.dart';

class PortalRoot extends StatefulWidget {
  const PortalRoot({
    super.key,
    required this.registry,
    required this.createUiContext,
  });

  final PortalRegistry registry;
  final UiContext Function([Map<String, dynamic>? extra]) createUiContext;

  @override
  State<PortalRoot> createState() => _PortalRootState();
}

class _PortalRootState extends State<PortalRoot> {
  int _refreshToken = 0;

  void _refreshBoard() {
    setState(() {
      _refreshToken += 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    final designSystem = widget.registry.packages['designSystem'];
    if (designSystem == null) {
      throw Exception('portal root requires packages.designSystem');
    }

    final taskCreateSurface =
        widget.registry.cases['tasks']?['task_create']?.ui;
    final taskListSurface = widget.registry.cases['tasks']?['task_list']?.ui;
    final taskMoveSurface = widget.registry.cases['tasks']?['task_move']?.ui;

    if (taskCreateSurface == null ||
        taskListSurface == null ||
        taskMoveSurface == null) {
      throw Exception(
        'portal root requires task_create, task_list, and task_move ui surfaces',
      );
    }

    final taskCreateView =
        (taskCreateSurface(
                      widget.createUiContext(<String, dynamic>{
                        'onTaskCreated': (Map<String, dynamic> _) =>
                            _refreshBoard(),
                      }),
                    )
                    as dynamic)
                .view()
            as Widget;

    final taskListView =
        (taskListSurface(
                      widget.createUiContext(<String, dynamic>{
                        'refreshToken': _refreshToken,
                        'renderCardActions': (TaskListTask task) {
                          final moveView =
                              (taskMoveSurface(
                                            widget.createUiContext(
                                              <String, dynamic>{
                                                'task': task.toJson(),
                                                'onTaskMoved':
                                                    (Map<String, dynamic> _) =>
                                                        _refreshBoard(),
                                              },
                                            ),
                                          )
                                          as dynamic)
                                      .view()
                                  as Widget;
                          return moveView;
                        },
                      }),
                    )
                    as dynamic)
                .view()
            as Widget;

    return (designSystem as dynamic).appShell(
          title: 'Task Board',
          subtitle:
              'Flutter + Dart APP example with create, list, and move wired through Cases.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              (designSystem as dynamic).boardHeader(
                    title: 'Board',
                    subtitle:
                        'Tasks load from the backend and each card can move across columns.',
                  )
                  as Widget,
              const SizedBox(height: 24),
              taskCreateView,
              const SizedBox(height: 24),
              taskListView,
            ],
          ),
        )
        as Widget;
  }
}
