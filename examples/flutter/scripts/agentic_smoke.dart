import 'dart:io';

import 'test_support.dart';

Future<void> run() async {
  final tempDirectory = await createTempDataDirectory(
    'app-flutter-agentic-smoke-',
  );
  HttpServer? backendServer;
  HttpServer? agentServer;

  try {
    final backend = await startBackendHost(tempDirectory);
    final agent = await startAgentHost(tempDirectory);
    backendServer = backend.server;
    agentServer = agent.server;

    final catalog = await assertSuccessEnvelope(
      await getJson('${agent.baseUrl}/catalog'),
      'agent catalog',
    );
    final toolNames =
        asJsonMapList(catalog['tools'], 'catalog tools')
            .map((JsonMap tool) => tool['publishedName'].toString())
            .toList(growable: false)
          ..sort();
    expectJsonEqual(toolNames, <String>[
      'task_create',
      'task_list',
      'task_move',
    ], 'agentic_smoke: agent catalog must expose the three task tools');
    expectTrue(
      catalog['systemPrompt'].toString().contains('Tool task_create'),
      'agentic_smoke: /catalog must expose the host global prompt built from the registered tool fragments',
    );
    final resourceUris =
        asJsonMapList(catalog['resources'], 'catalog resources')
            .map((JsonMap resource) => resource['uri'].toString())
            .toList(growable: false)
          ..sort();
    expectJsonEqual(
      resourceUris,
      <String>[
        'app://agent/system/prompt',
        'app://agent/tools/task_create/semantic',
        'app://agent/tools/task_list/semantic',
        'app://agent/tools/task_move/semantic',
      ],
      'agentic_smoke: /catalog must mirror the MCP semantic resources',
    );

    await assertFailureEnvelope(
      await postJson(
        '${agent.baseUrl}/tools/task_create/execute',
        <String, dynamic>{
          'input': <String, dynamic>{'title': '   '},
        },
      ),
      'agent invalid task_create',
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    );

    final created = await assertSuccessEnvelope(
      await postJson(
        '${agent.baseUrl}/tools/task_create/execute',
        <String, dynamic>{
          'title': 'Agent-created task',
          'description': 'Created through apps/agent',
        },
      ),
      'agent task_create',
    );
    final createdTask = asJsonMap(created['task'], 'agent created task');
    expectEqual(
      createdTask['status'],
      'todo',
      'agentic_smoke: task_create must create a todo task',
    );

    final listedByAgent = await assertSuccessEnvelope(
      await postJson(
        '${agent.baseUrl}/tools/task_list/execute',
        const <String, dynamic>{},
      ),
      'agent task_list',
    );
    final listedByAgentTasks = asJsonMapList(
      listedByAgent['tasks'],
      'agent listed tasks',
    );
    expectTrue(
      listedByAgentTasks.any((JsonMap task) => task['id'] == createdTask['id']),
      'agentic_smoke: task_list must see tasks created via agent',
    );

    await assertFailureEnvelope(
      await postJson(
        '${agent.baseUrl}/tools/task_move/execute',
        <String, dynamic>{'taskId': createdTask['id'], 'targetStatus': 'doing'},
      ),
      'agent task_move without confirmation',
      statusCode: 409,
      code: 'CONFIRMATION_REQUIRED',
    );

    await assertFailureEnvelope(
      await postJson(
        '${agent.baseUrl}/tools/task_move/execute',
        <String, dynamic>{
          'input': <String, dynamic>{
            'taskId': 'missing',
            'targetStatus': 'done',
          },
          'confirmed': true,
        },
      ),
      'agent task_move missing task',
      statusCode: 404,
      code: 'NOT_FOUND',
    );

    final moved = await assertSuccessEnvelope(
      await postJson(
        '${agent.baseUrl}/tools/task_move/execute',
        <String, dynamic>{
          'input': <String, dynamic>{
            'taskId': createdTask['id'],
            'targetStatus': 'doing',
          },
          'confirmed': true,
        },
      ),
      'agent task_move',
    );
    final movedTask = asJsonMap(moved['task'], 'agent moved task');
    expectEqual(
      movedTask['status'],
      'doing',
      'agentic_smoke: confirmed task_move must mutate the task',
    );

    final listedByBackend = await assertSuccessEnvelope(
      await getJson('${backend.baseUrl}/tasks'),
      'backend list after agent execution',
    );
    final listedByBackendTasks = asJsonMapList(
      listedByBackend['tasks'],
      'backend tasks after agent execution',
    );
    final backendMovedTask = listedByBackendTasks.firstWhere(
      (JsonMap task) => task['id'] == createdTask['id'],
      orElse: () => fail(
        'agentic_smoke: backend must observe tasks mutated by apps/agent',
      ),
    );
    expectEqual(
      backendMovedTask['status'],
      'doing',
      'agentic_smoke: backend must observe the status written by task_move',
    );

    const backendBurst = 8;
    const agentBurst = 8;
    final concurrentCreates = await Future.wait(<Future<JsonMap>>[
      ...List<Future<JsonMap>>.generate(backendBurst, (int index) async {
        final result = await assertSuccessEnvelope(
          await postJson('${backend.baseUrl}/tasks', <String, dynamic>{
            'title': 'Backend burst ${index + 1}',
          }),
          'concurrent backend create ${index + 1}',
        );
        return asJsonMap(result['task'], 'backend burst task');
      }),
      ...List<Future<JsonMap>>.generate(agentBurst, (int index) async {
        final result = await assertSuccessEnvelope(
          await postJson(
            '${agent.baseUrl}/tools/task_create/execute',
            <String, dynamic>{
              'input': <String, dynamic>{'title': 'Agent burst ${index + 1}'},
            },
          ),
          'concurrent agent create ${index + 1}',
        );
        return asJsonMap(result['task'], 'agent burst task');
      }),
    ]);

    expectEqual(
      concurrentCreates.length,
      backendBurst + agentBurst,
      'agentic_smoke: concurrent creates must all complete',
    );

    final listedAfterConcurrency = await assertSuccessEnvelope(
      await getJson('${backend.baseUrl}/tasks'),
      'backend list after concurrent backend/agent writes',
    );
    expectEqual(
      asJsonMapList(
        listedAfterConcurrency['tasks'],
        'tasks after concurrent backend/agent writes',
      ).length,
      1 + backendBurst + agentBurst,
      'agentic_smoke: concurrent backend/agent writes must preserve every task',
    );

    stdout.writeln('agentic_smoke: ok');
  } finally {
    await closeServer(agentServer);
    await closeServer(backendServer);
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
