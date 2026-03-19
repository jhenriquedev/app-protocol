import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import '../apps/agent/app.dart' as agent_app;
import '../apps/agent/registry.dart';
import '../apps/portal/app.dart' as portal_app;
import '../apps/portal/registry.dart';
import '../cases/tasks/task_create/task_create.agentic.case.dart';
import '../cases/tasks/task_create/task_create.api.case.dart';
import '../cases/tasks/task_create/task_create.domain.case.dart';
import '../cases/tasks/task_create/task_create.ui.case.dart';
import '../cases/tasks/task_list/task_list.agentic.case.dart';
import '../cases/tasks/task_list/task_list.api.case.dart';
import '../cases/tasks/task_list/task_list.domain.case.dart';
import '../cases/tasks/task_list/task_list.ui.case.dart';
import '../cases/tasks/task_move/task_move.agentic.case.dart';
import '../cases/tasks/task_move/task_move.api.case.dart';
import '../cases/tasks/task_move/task_move.domain.case.dart';
import '../cases/tasks/task_move/task_move.ui.case.dart';
import '../scripts/test_support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  HttpOverrides.global = null;

  test('APP surface protocol validation', () async {
    final tempDirectory = await createTempDataDirectory(
      'app-flutter-protocol-validate-',
    );
    HttpServer? backendServer;

    try {
      final backend = await startBackendHost(tempDirectory);
      backendServer = backend.server;

      final backendApp = backend.app;
      final portal = portal_app.bootstrap(
        PortalConfig(apiBaseUrl: backend.baseUrl),
      );
      final agent = agent_app.bootstrap(
        AgentConfig(dataDirectory: tempDirectory),
      );

      await TaskCreateDomain().test();
      await TaskListDomain().test();
      await TaskMoveDomain().test();

      await TaskCreateApi(
        backendApp.createApiContext(<String, dynamic>{
          'correlationId': 'api-test',
        }),
      ).test();
      await TaskListApi(
        backendApp.createApiContext(<String, dynamic>{
          'correlationId': 'api-test',
        }),
      ).test();
      await TaskMoveApi(
        backendApp.createApiContext(<String, dynamic>{
          'correlationId': 'api-test',
        }),
      ).test();

      await TaskCreateUi(
        portal.createUiContext(<String, dynamic>{
          'correlationId': 'ui-test',
          'onTaskCreated': (_) {},
        }),
      ).test();
      await TaskListUi(
        portal.createUiContext(<String, dynamic>{
          'correlationId': 'ui-test',
          'renderCardActions': (_) => null,
        }),
      ).test();

      final createdTaskResponse = await TaskCreateApi(
        backendApp.createApiContext(<String, dynamic>{
          'correlationId': 'ui-task-move-seed',
        }),
      ).handler(const TaskCreateInput(title: 'Task for task_move.ui'));
      expect(
        createdTaskResponse.success,
        isTrue,
        reason: 'protocol validation must seed a task for task_move.ui',
      );
      expect(
        createdTaskResponse.data,
        isNotNull,
        reason: 'protocol validation seed must return a created task',
      );

      final moveSeed = asJsonMap(
        asJsonMap(
          createdTaskResponse.data!.toJson(),
          'task_move.ui seed data',
        )['task'],
        'task_move.ui seed task',
      );
      await TaskMoveUi(
        portal.createUiContext(<String, dynamic>{
          'correlationId': 'ui-test',
          'task': moveSeed,
          'onTaskMoved': (_) {},
        }),
      ).test();

      await TaskCreateAgentic(
        agent.createAgenticContext(<String, dynamic>{
          'correlationId': 'agentic-test',
        }),
      ).test();
      await TaskListAgentic(
        agent.createAgenticContext(<String, dynamic>{
          'correlationId': 'agentic-test',
        }),
      ).test();
      await TaskMoveAgentic(
        agent.createAgenticContext(<String, dynamic>{
          'correlationId': 'agentic-test',
        }),
      ).test();

      final runtimeSummary = await agent.validateAgenticRuntime();
      expect(
        runtimeSummary['tools'],
        3,
        reason: 'agent runtime must publish the three APP task tools',
      );
      expect(
        runtimeSummary['mcpEnabled'],
        3,
        reason: 'agent runtime must project all tools to MCP',
      );
      expect(
        runtimeSummary['requireConfirmation'],
        1,
        reason: 'agent runtime must keep task_move confirmation policy',
      );
    } finally {
      await closeServer(backendServer);
      await removeTempDirectory(tempDirectory);
    }
  });
}
