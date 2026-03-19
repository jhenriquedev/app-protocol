import 'dart:io';

import 'test_support.dart';

Future<void> run() async {
  final tempDirectory = await createTempDataDirectory('app-flutter-smoke-');
  HttpServer? server;

  try {
    var started = await startBackendHost(tempDirectory);
    server = started.server;

    final initialContext = started.app.createApiContext(<String, dynamic>{
      'correlationId': 'smoke',
    });
    final cases = asJsonMap(initialContext.cases, 'backend ctx.cases');
    final tasksCases = asJsonMap(cases['tasks'], 'backend ctx.cases.tasks');
    final packages = asJsonMap(initialContext.packages, 'backend ctx.packages');

    expectTrue(
      tasksCases.containsKey('task_create'),
      'smoke: backend host must materialize ctx.cases',
    );
    expectTrue(
      packages.containsKey('data'),
      'smoke: backend host must materialize ctx.packages',
    );

    final health = await parseJsonResponse(
      await getJson('${started.baseUrl}/health'),
      'health check',
    );
    expectEqual(health['ok'], true, 'smoke: health endpoint must be healthy');

    final notFoundResponse = await getJson('${started.baseUrl}/missing-route');
    final notFoundPayload = await parseJsonResponse(
      notFoundResponse,
      'unknown route',
    );
    expectEqual(
      notFoundResponse.statusCode,
      404,
      'smoke: unknown route must return 404',
    );
    expectEqual(
      asJsonMap(notFoundPayload['error'], 'unknown route error')['code'],
      'NOT_FOUND',
      'smoke: unknown route must keep structured errors',
    );

    final invalidJsonResponse = await postRaw(
      '${started.baseUrl}/tasks',
      '{ invalid json',
    );
    final invalidJsonPayload = await parseJsonResponse(
      invalidJsonResponse,
      'invalid JSON request',
    );
    expectEqual(
      invalidJsonResponse.statusCode,
      400,
      'smoke: invalid JSON must return HTTP 400',
    );
    expectEqual(
      asJsonMap(invalidJsonPayload['error'], 'invalid JSON error')['code'],
      'INVALID_REQUEST',
      'smoke: invalid JSON must keep structured errors',
    );

    final created = await assertSuccessEnvelope(
      await postJson('${started.baseUrl}/tasks', <String, dynamic>{
        'title': 'Smoke test task',
        'description': 'Created by the official smoke test',
      }),
      'create task',
    );
    final createdTask = asJsonMap(created['task'], 'created task');
    expectEqual(
      createdTask['status'],
      'todo',
      'smoke: new tasks must start in todo',
    );

    final listedBeforeMove = await assertSuccessEnvelope(
      await getJson('${started.baseUrl}/tasks'),
      'list tasks before move',
    );
    final listedBeforeMoveTasks = asJsonMapList(
      listedBeforeMove['tasks'],
      'tasks before move',
    );
    expectTrue(
      listedBeforeMoveTasks.any(
        (JsonMap task) => task['id'] == createdTask['id'],
      ),
      'smoke: created task must appear in the list',
    );

    final moved = await assertSuccessEnvelope(
      await patchJson(
        '${started.baseUrl}/tasks/${createdTask['id']}/status',
        <String, dynamic>{'targetStatus': 'doing'},
      ),
      'move task',
    );
    final movedTask = asJsonMap(moved['task'], 'moved task');
    expectEqual(
      movedTask['status'],
      'doing',
      'smoke: move must update the task status',
    );

    final listedAfterMove = await assertSuccessEnvelope(
      await getJson('${started.baseUrl}/tasks'),
      'list tasks after move',
    );
    final listedAfterMoveTasks = asJsonMapList(
      listedAfterMove['tasks'],
      'tasks after move',
    );
    final movedListedTask = listedAfterMoveTasks.firstWhere(
      (JsonMap task) => task['id'] == createdTask['id'],
      orElse: () => fail('smoke: moved task must still be listed'),
    );
    expectEqual(
      movedListedTask['status'],
      'doing',
      'smoke: list must reflect the moved status',
    );

    final concurrentCreates = await Future.wait(
      List<Future<JsonMap>>.generate(8, (int index) async {
        final response = await assertSuccessEnvelope(
          await postJson('${started.baseUrl}/tasks', <String, dynamic>{
            'title': 'Concurrent smoke task ${index + 1}',
          }),
          'concurrent create ${index + 1}',
        );
        return asJsonMap(response['task'], 'concurrent create task');
      }),
    );

    final concurrentIds = concurrentCreates
        .map((JsonMap task) => task['id'])
        .toSet();
    expectEqual(
      concurrentIds.length,
      concurrentCreates.length,
      'smoke: concurrent creates must return distinct task ids',
    );

    final listedAfterConcurrentCreate = await assertSuccessEnvelope(
      await getJson('${started.baseUrl}/tasks'),
      'list tasks after concurrent create',
    );
    expectEqual(
      asJsonMapList(
        listedAfterConcurrentCreate['tasks'],
        'tasks after concurrent create',
      ).length,
      concurrentCreates.length + 1,
      'smoke: concurrent creates must persist every task',
    );

    await closeServer(server);
    server = null;

    started = await startBackendHost(tempDirectory);
    server = started.server;

    final listedAfterRestart = await assertSuccessEnvelope(
      await getJson('${started.baseUrl}/tasks'),
      'list tasks after restart',
    );
    final listedAfterRestartTasks = asJsonMapList(
      listedAfterRestart['tasks'],
      'tasks after restart',
    );
    final persistedTask = listedAfterRestartTasks.firstWhere(
      (JsonMap task) => task['id'] == createdTask['id'],
      orElse: () => fail('smoke: task must still exist after backend restart'),
    );
    expectEqual(
      persistedTask['status'],
      'doing',
      'smoke: local persistence must survive backend restart',
    );

    stdout.writeln('smoke: ok');
  } finally {
    await closeServer(server);
    await removeTempDirectory(tempDirectory);
  }
}

Future<void> main() async {
  try {
    await run();
  } catch (error) {
    stderr.writeln(error);
    exitCode = 1;
  }
}
