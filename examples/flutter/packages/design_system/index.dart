import 'package:flutter/material.dart';

const List<String> taskStatuses = <String>['todo', 'doing', 'done'];

const _shellBackground = LinearGradient(
  colors: <Color>[Color(0xFFF5F7FB), Color(0xFFEDF1F7), Color(0xFFFDFEFE)],
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
);

const _surfaceDecoration = BoxDecoration(
  color: Colors.white,
  borderRadius: BorderRadius.all(Radius.circular(20)),
  border: Border.fromBorderSide(BorderSide(color: Color(0xFFD8DDE6))),
  boxShadow: <BoxShadow>[
    BoxShadow(color: Color(0x14121A29), blurRadius: 45, offset: Offset(0, 20)),
  ],
);

const _buttonShape = StadiumBorder();

const Map<String, Color> _statusBackground = <String, Color>{
  'todo': Color(0xFFFFF4CC),
  'doing': Color(0xFFD9EFFF),
  'done': Color(0xFFDFF7E4),
};

const Map<String, Color> _statusForeground = <String, Color>{
  'todo': Color(0xFF7A5D00),
  'doing': Color(0xFF005A91),
  'done': Color(0xFF0C6A36),
};

class DesignSystem {
  const DesignSystem();

  AppShell appShell({
    required String title,
    String? subtitle,
    Widget? actions,
    required Widget child,
  }) {
    return AppShell(
      title: title,
      subtitle: subtitle,
      actions: actions,
      child: child,
    );
  }

  BoardHeader boardHeader({required String title, String? subtitle}) {
    return BoardHeader(title: title, subtitle: subtitle);
  }

  CreateTaskButton createTaskButton({
    bool disabled = false,
    VoidCallback? onPressed,
  }) {
    return CreateTaskButton(disabled: disabled, onPressed: onPressed);
  }

  TaskBoard taskBoard({required List<Widget> children}) {
    return TaskBoard(children: children);
  }

  TaskColumn taskColumn({
    required String title,
    required int count,
    required List<Widget> children,
  }) {
    return TaskColumn(title: title, count: count, children: children);
  }

  TaskCard taskCard({
    required String title,
    String? description,
    required String status,
    Widget? actions,
  }) {
    return TaskCard(
      title: title,
      description: description,
      status: status,
      actions: actions,
    );
  }

  TaskStatusBadge taskStatusBadge({required String status}) {
    return TaskStatusBadge(status: status);
  }

  MoveTaskAction moveTaskAction({
    required String currentStatus,
    bool submitting = false,
    ValueChanged<String>? onMove,
  }) {
    return MoveTaskAction(
      currentStatus: currentStatus,
      submitting: submitting,
      onMove: onMove,
    );
  }

  TaskFormDialog taskFormDialog({
    required bool open,
    required String titleValue,
    required String descriptionValue,
    bool submitting = false,
    ValueChanged<String>? onTitleChange,
    ValueChanged<String>? onDescriptionChange,
    VoidCallback? onClose,
    VoidCallback? onSubmit,
  }) {
    return TaskFormDialog(
      open: open,
      titleValue: titleValue,
      descriptionValue: descriptionValue,
      submitting: submitting,
      onTitleChange: onTitleChange,
      onDescriptionChange: onDescriptionChange,
      onClose: onClose,
      onSubmit: onSubmit,
    );
  }

  EmptyColumnState emptyColumnState({required String message}) {
    return EmptyColumnState(message: message);
  }
}

class AppShell extends StatelessWidget {
  const AppShell({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
    this.actions,
  });

  final String title;
  final String? subtitle;
  final Widget? actions;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final isCompact = media.size.width < 760;

    return DecoratedBox(
      decoration: const BoxDecoration(gradient: _shellBackground),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            isCompact ? 14 : 24,
            isCompact ? 20 : 40,
            isCompact ? 14 : 24,
            isCompact ? 28 : 48,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1120),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Flex(
                    direction: isCompact ? Axis.vertical : Axis.horizontal,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: <Widget>[
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            const Text(
                              'APP Flutter Example',
                              style: TextStyle(
                                color: Color(0xFF637083),
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.2,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              title,
                              style: TextStyle(
                                color: const Color(0xFF1F2430),
                                fontSize: isCompact ? 30 : 40,
                                fontWeight: FontWeight.w800,
                                height: 1.05,
                              ),
                            ),
                            if (subtitle != null) ...<Widget>[
                              const SizedBox(height: 10),
                              Text(
                                subtitle!,
                                style: const TextStyle(
                                  color: Color(0xFF5F646D),
                                  fontSize: 16,
                                  height: 1.5,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      if (actions != null) ...<Widget>[
                        SizedBox(
                          width: isCompact ? 0 : 24,
                          height: isCompact ? 16 : 0,
                        ),
                        SizedBox(
                          width: isCompact ? double.infinity : null,
                          child: actions,
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 24),
                  child,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class BoardHeader extends StatelessWidget {
  const BoardHeader({super.key, required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(18),
      decoration: _surfaceDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            title,
            style: const TextStyle(
              color: Color(0xFF1F2430),
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (subtitle != null) ...<Widget>[
            const SizedBox(height: 8),
            Text(
              subtitle!,
              style: const TextStyle(
                color: Color(0xFF5F646D),
                fontSize: 15,
                height: 1.45,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class CreateTaskButton extends StatelessWidget {
  const CreateTaskButton({super.key, this.disabled = false, this.onPressed});

  final bool disabled;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: disabled ? null : onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: const Color(0xFF1F2430),
        disabledBackgroundColor: const Color(0xFFCFD5DF),
        shape: _buttonShape,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      ),
      child: const Text(
        'New Task',
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
    );
  }
}

class TaskBoard extends StatelessWidget {
  const TaskBoard({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final width = constraints.maxWidth;
        final columns = width >= 1024
            ? 3
            : width >= 760
            ? 2
            : 1;
        final spacing = 16.0;
        final itemWidth = columns == 1
            ? width
            : (width - ((columns - 1) * spacing)) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: children
              .map((child) => SizedBox(width: itemWidth, child: child))
              .toList(growable: false),
        );
      },
    );
  }
}

class TaskColumn extends StatelessWidget {
  const TaskColumn({
    super.key,
    required this.title,
    required this.count,
    required this.children,
  });

  final String title;
  final int count;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 320),
      padding: const EdgeInsets.all(16),
      decoration: _surfaceDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1F2430),
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: const BoxDecoration(
                  color: Color(0xFFEDF1F7),
                  borderRadius: BorderRadius.all(Radius.circular(999)),
                ),
                child: Text(
                  '$count',
                  style: const TextStyle(
                    color: Color(0xFF425166),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...children.expand(
            (Widget child) => <Widget>[child, const SizedBox(height: 14)],
          ),
        ],
      ),
    );
  }
}

class TaskStatusBadge extends StatelessWidget {
  const TaskStatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: _statusBackground[status] ?? const Color(0xFFEDF1F7),
        borderRadius: const BorderRadius.all(Radius.circular(999)),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: _statusForeground[status] ?? const Color(0xFF2F3745),
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

class TaskCard extends StatelessWidget {
  const TaskCard({
    super.key,
    required this.title,
    required this.status,
    this.description,
    this.actions,
  });

  final String title;
  final String? description;
  final String status;
  final Widget? actions;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFDFEFE),
        borderRadius: const BorderRadius.all(Radius.circular(16)),
        border: Border.all(color: const Color(0xFFE5EAF1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1F2430),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              TaskStatusBadge(status: status),
            ],
          ),
          if (description != null &&
              description!.trim().isNotEmpty) ...<Widget>[
            const SizedBox(height: 10),
            Text(
              description!,
              style: const TextStyle(
                color: Color(0xFF5F646D),
                fontSize: 14,
                height: 1.45,
              ),
            ),
          ],
          if (actions != null) ...<Widget>[
            const SizedBox(height: 14),
            actions!,
          ],
        ],
      ),
    );
  }
}

class MoveTaskAction extends StatelessWidget {
  const MoveTaskAction({
    super.key,
    required this.currentStatus,
    this.submitting = false,
    this.onMove,
  });

  final String currentStatus;
  final bool submitting;
  final ValueChanged<String>? onMove;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: taskStatuses
          .map(
            (String status) => OutlinedButton(
              onPressed: submitting || status == currentStatus
                  ? null
                  : () => onMove?.call(status),
              style: OutlinedButton.styleFrom(
                backgroundColor: submitting || status == currentStatus
                    ? const Color(0xFFD6DCE5)
                    : const Color(0xFFEDF1F7),
                foregroundColor: const Color(0xFF2F3745),
                shape: _buttonShape,
                side: BorderSide.none,
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
              ),
              child: Text(
                'Move to $status',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          )
          .toList(growable: false),
    );
  }
}

class TaskFormDialog extends StatefulWidget {
  const TaskFormDialog({
    super.key,
    required this.open,
    required this.titleValue,
    required this.descriptionValue,
    this.submitting = false,
    this.onTitleChange,
    this.onDescriptionChange,
    this.onClose,
    this.onSubmit,
  });

  final bool open;
  final String titleValue;
  final String descriptionValue;
  final bool submitting;
  final ValueChanged<String>? onTitleChange;
  final ValueChanged<String>? onDescriptionChange;
  final VoidCallback? onClose;
  final VoidCallback? onSubmit;

  @override
  State<TaskFormDialog> createState() => _TaskFormDialogState();
}

class _TaskFormDialogState extends State<TaskFormDialog> {
  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.titleValue);
    _descriptionController = TextEditingController(
      text: widget.descriptionValue,
    );

    _titleController.addListener(() {
      widget.onTitleChange?.call(_titleController.text);
    });
    _descriptionController.addListener(() {
      widget.onDescriptionChange?.call(_descriptionController.text);
    });
  }

  @override
  void didUpdateWidget(covariant TaskFormDialog oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.titleValue != widget.titleValue &&
        _titleController.text != widget.titleValue) {
      _titleController.value = TextEditingValue(
        text: widget.titleValue,
        selection: TextSelection.collapsed(offset: widget.titleValue.length),
      );
    }

    if (oldWidget.descriptionValue != widget.descriptionValue &&
        _descriptionController.text != widget.descriptionValue) {
      _descriptionController.value = TextEditingValue(
        text: widget.descriptionValue,
        selection: TextSelection.collapsed(
          offset: widget.descriptionValue.length,
        ),
      );
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.open) {
      return const SizedBox.shrink();
    }

    return Positioned.fill(
      child: DecoratedBox(
        decoration: const BoxDecoration(color: Color(0x75121A29)),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Material(
              color: Colors.transparent,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: _surfaceDecoration,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      const Text(
                        'Create task',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1F2430),
                        ),
                      ),
                      const SizedBox(height: 18),
                      TextField(
                        controller: _titleController,
                        enabled: !widget.submitting,
                        decoration: const InputDecoration(
                          labelText: 'Title',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _descriptionController,
                        enabled: !widget.submitting,
                        minLines: 3,
                        maxLines: 5,
                        decoration: const InputDecoration(
                          labelText: 'Description',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        alignment: WrapAlignment.end,
                        children: <Widget>[
                          OutlinedButton(
                            onPressed: widget.submitting
                                ? null
                                : widget.onClose,
                            style: OutlinedButton.styleFrom(
                              shape: _buttonShape,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 18,
                                vertical: 14,
                              ),
                            ),
                            child: const Text('Cancel'),
                          ),
                          FilledButton(
                            onPressed: widget.submitting
                                ? null
                                : widget.onSubmit,
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF1F2430),
                              shape: _buttonShape,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 18,
                                vertical: 14,
                              ),
                            ),
                            child: Text(
                              widget.submitting ? 'Creating...' : 'Create task',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class EmptyColumnState extends StatelessWidget {
  const EmptyColumnState({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 18),
      decoration: BoxDecoration(
        color: const Color(0xFFF6F8FC),
        borderRadius: const BorderRadius.all(Radius.circular(14)),
        border: Border.all(color: const Color(0xFFE2E8F2)),
      ),
      child: Text(
        message,
        style: const TextStyle(color: Color(0xFF66758A), fontSize: 14),
      ),
    );
  }
}
