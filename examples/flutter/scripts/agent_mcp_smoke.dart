import 'dart:convert';
import 'dart:io';

import 'test_support.dart';

const String mcpProtocolVersion = '2025-11-25';
const String mcpLegacyProtocolVersion = '2025-06-18';

Future<void> run() async {
  final tempDirectory = await createTempDataDirectory(
    'app-flutter-agent-mcp-smoke-',
  );
  HttpServer? backendServer;
  McpStdIoClient? mcpClient;

  try {
    final backend = await startBackendHost(tempDirectory);
    backendServer = backend.server;
    mcpClient = await McpStdIoClient.start(
      workingDirectory: Directory.current.path,
      dataDirectory: tempDirectory,
    );

    final invalidInitialize = await mcpClient.request(
      'initialize',
      <String, dynamic>{
        'protocolVersion': '1999-01-01',
        'capabilities': <String, dynamic>{'tools': <String, dynamic>{}},
        'clientInfo': <String, dynamic>{
          'name': 'agent-mcp-smoke',
          'version': '1.0.0',
        },
      },
    );
    final invalidInitializeError = asJsonMap(
      invalidInitialize['error'],
      'invalid initialize error',
    );
    expectTrue(
      invalidInitializeError['message'].toString().contains(
        'Unsupported MCP protocol version',
      ),
      'agent_mcp_smoke: initialize must reject unknown protocol versions explicitly',
    );

    final initialize = await mcpClient.request('initialize', <String, dynamic>{
      'protocolVersion': mcpLegacyProtocolVersion,
      'capabilities': <String, dynamic>{'tools': <String, dynamic>{}},
      'clientInfo': <String, dynamic>{
        'name': 'agent-mcp-smoke',
        'version': '1.0.0',
      },
    });
    final initializeResult = asJsonMap(
      initialize['result'],
      'initialize result',
    );
    expectEqual(
      initializeResult['protocolVersion'],
      mcpProtocolVersion,
      'agent_mcp_smoke: initialize must negotiate the host-supported MCP protocol version',
    );
    expectEqual(
      asJsonMap(initializeResult['serverInfo'], 'serverInfo')['name'],
      'flutter-task-board-agent',
      'agent_mcp_smoke: initialize must expose the agent host server name',
    );
    expectEqual(
      asJsonMap(initializeResult['capabilities'], 'capabilities')['resources']
          is Map,
      true,
      'agent_mcp_smoke: initialize must advertise MCP resources support',
    );
    expectEqual(
      asJsonMap(
        asJsonMap(
          initializeResult['capabilities'],
          'capabilities',
        )['resources'],
        'resource capabilities',
      )['listChanged'],
      false,
      'agent_mcp_smoke: initialize must advertise MCP resources support',
    );
    expectTrue(
      initializeResult['instructions'].toString().contains('Tool task_create'),
      'agent_mcp_smoke: initialize instructions must include the registry-derived prompt fragments',
    );

    mcpClient.notify('notifications/initialized');

    final listedToolsResponse = await mcpClient.request('tools/list');
    final listedToolsResult = asJsonMap(
      listedToolsResponse['result'],
      'tools/list result',
    );
    final listedToolDescriptors = asJsonMapList(
      listedToolsResult['tools'],
      'tools/list tools',
    );
    final listedToolNames =
        listedToolDescriptors
            .map((JsonMap tool) => tool['name'].toString())
            .toList(growable: false)
          ..sort();
    expectJsonEqual(
      listedToolNames,
      <String>['task_create', 'task_list', 'task_move'],
      'agent_mcp_smoke: MCP tools/list must expose the three task tools',
    );
    expectTrue(
      listedToolDescriptors.any(
        (JsonMap tool) =>
            tool['name'] == 'task_move' &&
            tool['description'].toString().contains(
              'Require confirmation before mutating the board',
            ),
      ),
      'agent_mcp_smoke: MCP tool descriptions must project semantic prompt/constraint data',
    );

    final resourcesResponse = await mcpClient.request('resources/list');
    final resourcesResult = asJsonMap(
      resourcesResponse['result'],
      'resources/list result',
    );
    final resourceUris =
        asJsonMapList(resourcesResult['resources'], 'resources/list resources')
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
      'agent_mcp_smoke: resources/list must publish the system prompt plus one semantic resource per tool',
    );

    final moveSemanticResponse = await mcpClient.request(
      'resources/read',
      <String, dynamic>{'uri': 'app://agent/tools/task_move/semantic'},
    );
    final moveSemanticResult = asJsonMap(
      moveSemanticResponse['result'],
      'resources/read result',
    );
    final moveSemanticContents = asJsonMapList(
      moveSemanticResult['contents'],
      'resources/read contents',
    );
    final moveSemanticPayload = asJsonMap(
      jsonDecode(moveSemanticContents.first['text'].toString()),
      'task_move semantic payload',
    );
    expectTrue(
      moveSemanticPayload['promptFragment'].toString().contains(
        'Tool task_move',
      ),
      'agent_mcp_smoke: resources/read must expose the tool prompt fragment',
    );
    final moveSemanticDefinition = asJsonMap(
      moveSemanticPayload['definition'],
      'task_move semantic definition',
    );
    final moveSemanticRag = asJsonMap(
      moveSemanticDefinition['rag'],
      'task_move semantic rag',
    );
    final moveSemanticResources = asJsonMapList(
      moveSemanticRag['resources'],
      'task_move semantic rag resources',
    );
    expectTrue(
      moveSemanticResources.any(
        (JsonMap resource) => resource['ref'] == 'tasks/task_list',
      ),
      'agent_mcp_smoke: resources/read must preserve RAG resources from the registry definition',
    );

    final invalidCreateResponse = await mcpClient.request(
      'tools/call',
      <String, dynamic>{
        'name': 'task_create',
        'arguments': <String, dynamic>{'title': '   '},
      },
    );
    final invalidCreateResult = asJsonMap(
      invalidCreateResponse['result'],
      'invalid task_create result',
    );
    expectEqual(
      invalidCreateResult['isError'],
      true,
      'agent_mcp_smoke: invalid task_create must surface an MCP tool error result',
    );
    final invalidCreateStructuredContent = asJsonMap(
      invalidCreateResult['structuredContent'],
      'invalid task_create structuredContent',
    );
    expectEqual(
      invalidCreateStructuredContent['success'],
      false,
      'agent_mcp_smoke: invalid task_create must preserve success=false in structuredContent',
    );
    expectEqual(
      asJsonMap(
        invalidCreateStructuredContent['error'],
        'invalid task_create error',
      )['code'],
      'VALIDATION_FAILED',
      'agent_mcp_smoke: invalid task_create must preserve the APP validation code',
    );

    final createdResponse = await mcpClient.request(
      'tools/call',
      <String, dynamic>{
        'name': 'task_create',
        'arguments': <String, dynamic>{
          'title': 'MCP-created task',
          'description': 'Created through MCP stdio',
        },
      },
    );
    final createdResult = asJsonMap(createdResponse['result'], 'create result');
    expectEqual(
      createdResult['isError'],
      false,
      'agent_mcp_smoke: task_create must succeed through MCP',
    );
    final createdPayload = asJsonMap(
      createdResult['structuredContent'],
      'created structuredContent',
    );
    final createdTask = asJsonMap(createdPayload['task'], 'created task');
    expectEqual(
      createdTask['status'],
      'todo',
      'agent_mcp_smoke: MCP task_create must create todo tasks',
    );

    final listedResponse = await mcpClient.request(
      'tools/call',
      <String, dynamic>{
        'name': 'task_list',
        'arguments': const <String, dynamic>{},
      },
    );
    final listedResult = asJsonMap(listedResponse['result'], 'list result');
    final listedPayload = asJsonMap(
      listedResult['structuredContent'],
      'list structuredContent',
    );
    final listedTasks = asJsonMapList(listedPayload['tasks'], 'listed tasks');
    expectTrue(
      listedTasks.any((JsonMap task) => task['id'] == createdTask['id']),
      'agent_mcp_smoke: MCP task_list must see tasks created through MCP',
    );

    final moveWithoutConfirmationResponse = await mcpClient.request(
      'tools/call',
      <String, dynamic>{
        'name': 'task_move',
        'arguments': <String, dynamic>{
          'taskId': createdTask['id'],
          'targetStatus': 'doing',
        },
      },
    );
    final moveWithoutConfirmationResult = asJsonMap(
      moveWithoutConfirmationResponse['result'],
      'move without confirmation result',
    );
    expectEqual(
      moveWithoutConfirmationResult['isError'],
      true,
      'agent_mcp_smoke: task_move without confirmation must fail through MCP',
    );
    final moveWithoutConfirmationContent = asJsonMap(
      moveWithoutConfirmationResult['structuredContent'],
      'move without confirmation structuredContent',
    );
    expectEqual(
      moveWithoutConfirmationContent['success'],
      false,
      'agent_mcp_smoke: task_move without confirmation must preserve success=false',
    );
    final moveWithoutConfirmationError = asJsonMap(
      moveWithoutConfirmationContent['error'],
      'move without confirmation error',
    );
    expectEqual(
      moveWithoutConfirmationError['code'],
      'CONFIRMATION_REQUIRED',
      'agent_mcp_smoke: MCP task_move must preserve confirmation error codes',
    );
    expectJsonEqual(
      asJsonMap(
        moveWithoutConfirmationError['details'],
        'move without confirmation details',
      ),
      <String, dynamic>{
        'toolName': 'task_move',
        'executionMode': 'manual-approval',
      },
      'agent_mcp_smoke: MCP task_move must preserve confirmation details',
    );

    final movedResponse = await mcpClient.request(
      'tools/call',
      <String, dynamic>{
        'name': 'task_move',
        'arguments': <String, dynamic>{
          'taskId': createdTask['id'],
          'targetStatus': 'doing',
          'confirmed': true,
        },
      },
    );
    final movedResult = asJsonMap(movedResponse['result'], 'moved result');
    expectEqual(
      movedResult['isError'],
      false,
      'agent_mcp_smoke: confirmed task_move must succeed through MCP',
    );
    final movedPayload = asJsonMap(
      movedResult['structuredContent'],
      'moved structuredContent',
    );
    expectEqual(
      asJsonMap(movedPayload['task'], 'moved task')['status'],
      'doing',
      'agent_mcp_smoke: MCP task_move must mutate the task',
    );

    final listedByBackend = await assertSuccessEnvelope(
      await getJson('${backend.baseUrl}/tasks'),
      'backend list after MCP execution',
    );
    final backendTasks = asJsonMapList(
      listedByBackend['tasks'],
      'backend tasks after MCP execution',
    );
    final backendMovedTask = backendTasks.firstWhere(
      (JsonMap task) => task['id'] == createdTask['id'],
      orElse: () => fail(
        'agent_mcp_smoke: backend must observe tasks written through the MCP agent host',
      ),
    );
    expectEqual(
      backendMovedTask['status'],
      'doing',
      'agent_mcp_smoke: backend must observe the status written through MCP',
    );

    stdout.writeln('agent_mcp_smoke: ok');
  } finally {
    await mcpClient?.close();
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
