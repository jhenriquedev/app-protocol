import 'dart:io';

import 'package:http/http.dart' as http;

import 'test_support.dart';

const String mcpProtocolVersion = '2025-11-25';
const String mcpLegacyProtocolVersion = '2025-06-18';

Future<({http.Response response, JsonMap body})> mcpPost(
  String endpoint,
  JsonMap payload,
) async {
  final response = await postJson(
    endpoint,
    payload,
    headers: <String, String>{'accept': 'application/json, text/event-stream'},
  );
  final body = await parseJsonResponse(response, 'MCP HTTP response');
  return (response: response, body: body);
}

Future<void> run() async {
  final tempDirectory = await createTempDataDirectory(
    'app-flutter-agent-mcp-http-smoke-',
  );
  HttpServer? backendServer;
  HttpServer? agentServer;

  try {
    final backend = await startBackendHost(tempDirectory);
    final agent = await startAgentHost(tempDirectory);
    backendServer = backend.server;
    agentServer = agent.server;

    final mcpUrl = '${agent.baseUrl}/mcp';

    final getResponse = await getJson(
      mcpUrl,
      headers: <String, String>{'accept': 'text/event-stream'},
    );
    expectEqual(
      getResponse.statusCode,
      405,
      'agent_mcp_http_smoke: GET /mcp should explicitly reject SSE when unsupported',
    );

    final invalidInitialize = await mcpPost(mcpUrl, <String, dynamic>{
      'jsonrpc': '2.0',
      'id': 1,
      'method': 'initialize',
      'params': <String, dynamic>{
        'protocolVersion': '1999-01-01',
        'capabilities': <String, dynamic>{'tools': <String, dynamic>{}},
        'clientInfo': <String, dynamic>{
          'name': 'agent-mcp-http-smoke',
          'version': '1.0.0',
        },
      },
    });
    expectEqual(
      invalidInitialize.response.statusCode,
      200,
      'agent_mcp_http_smoke: initialize errors should return JSON-RPC payloads',
    );
    expectTrue(
      asJsonMap(
        invalidInitialize.body['error'],
        'invalid initialize error',
      )['message'].toString().contains('Unsupported MCP protocol version'),
      'agent_mcp_http_smoke: initialize must reject unsupported MCP versions',
    );

    final initialize = await mcpPost(mcpUrl, <String, dynamic>{
      'jsonrpc': '2.0',
      'id': 2,
      'method': 'initialize',
      'params': <String, dynamic>{
        'protocolVersion': mcpLegacyProtocolVersion,
        'capabilities': <String, dynamic>{'tools': <String, dynamic>{}},
        'clientInfo': <String, dynamic>{
          'name': 'agent-mcp-http-smoke',
          'version': '1.0.0',
        },
      },
    });
    final initializeResult = asJsonMap(
      initialize.body['result'],
      'initialize result',
    );
    expectEqual(
      initializeResult['protocolVersion'],
      mcpProtocolVersion,
      'agent_mcp_http_smoke: initialize must negotiate the host-supported protocol version',
    );
    expectEqual(
      asJsonMap(initializeResult['serverInfo'], 'serverInfo')['name'],
      'flutter-task-board-agent',
      'agent_mcp_http_smoke: initialize must expose the agent host server name',
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
      'agent_mcp_http_smoke: initialize must advertise MCP resources support',
    );
    expectTrue(
      initializeResult['instructions'].toString().contains('Tool task_list'),
      'agent_mcp_http_smoke: initialize instructions must include registry-derived prompt fragments',
    );

    final initializedNotification = await postJson(
      mcpUrl,
      <String, dynamic>{
        'jsonrpc': '2.0',
        'method': 'notifications/initialized',
        'params': const <String, dynamic>{},
      },
      headers: <String, String>{
        'accept': 'application/json, text/event-stream',
      },
    );
    expectEqual(
      initializedNotification.statusCode,
      202,
      'agent_mcp_http_smoke: notifications/initialized should be accepted',
    );

    final listedTools = await mcpPost(mcpUrl, <String, dynamic>{
      'jsonrpc': '2.0',
      'id': 3,
      'method': 'tools/list',
      'params': const <String, dynamic>{},
    });
    final listedToolsResult = asJsonMap(
      listedTools.body['result'],
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
      'agent_mcp_http_smoke: remote MCP tools/list must expose the three task tools',
    );
    expectTrue(
      listedToolDescriptors.any(
        (JsonMap tool) =>
            tool['name'] == 'task_list' &&
            tool['description'].toString().contains(
              'Use when: When the user asks to see the board',
            ),
      ),
      'agent_mcp_http_smoke: remote MCP descriptors must include semantic summaries from prompt/discovery/context',
    );

    final listedResources = await mcpPost(mcpUrl, <String, dynamic>{
      'jsonrpc': '2.0',
      'id': 4,
      'method': 'resources/list',
      'params': const <String, dynamic>{},
    });
    final listedResourcesResult = asJsonMap(
      listedResources.body['result'],
      'resources/list result',
    );
    final resourceUris =
        asJsonMapList(
              listedResourcesResult['resources'],
              'resources/list resources',
            )
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
      'agent_mcp_http_smoke: remote MCP resources/list must publish the system prompt plus per-tool semantic resources',
    );

    final promptResource = await mcpPost(mcpUrl, <String, dynamic>{
      'jsonrpc': '2.0',
      'id': 5,
      'method': 'resources/read',
      'params': <String, dynamic>{'uri': 'app://agent/system/prompt'},
    });
    final promptResult = asJsonMap(
      promptResource.body['result'],
      'resources/read result',
    );
    final promptText = asJsonMapList(
      promptResult['contents'],
      'prompt contents',
    ).first['text'].toString();
    expectTrue(
      promptText.contains('Tool task_move'),
      'agent_mcp_http_smoke: resources/read must expose the host global prompt built from tool fragments',
    );

    final invalidCreate = await mcpPost(mcpUrl, <String, dynamic>{
      'jsonrpc': '2.0',
      'id': 6,
      'method': 'tools/call',
      'params': <String, dynamic>{
        'name': 'task_create',
        'arguments': <String, dynamic>{'title': '   '},
      },
    });
    final invalidCreateResult = asJsonMap(
      invalidCreate.body['result'],
      'invalid create result',
    );
    expectEqual(
      invalidCreateResult['isError'],
      true,
      'agent_mcp_http_smoke: invalid task_create must fail through remote MCP',
    );
    expectEqual(
      asJsonMap(
        asJsonMap(
          invalidCreateResult['structuredContent'],
          'invalid create structuredContent',
        )['error'],
        'invalid create error',
      )['code'],
      'VALIDATION_FAILED',
      'agent_mcp_http_smoke: invalid task_create must preserve the APP validation code',
    );

    final created = await mcpPost(mcpUrl, <String, dynamic>{
      'jsonrpc': '2.0',
      'id': 7,
      'method': 'tools/call',
      'params': <String, dynamic>{
        'name': 'task_create',
        'arguments': <String, dynamic>{
          'title': 'Remote MCP task',
          'description': 'Created through streamable HTTP MCP',
        },
      },
    });
    final createdResult = asJsonMap(created.body['result'], 'created result');
    expectEqual(
      createdResult['isError'],
      false,
      'agent_mcp_http_smoke: task_create must succeed through remote MCP',
    );
    final createdTask = asJsonMap(
      asJsonMap(
        createdResult['structuredContent'],
        'created structuredContent',
      )['task'],
      'created task',
    );

    final moveWithoutConfirmation = await mcpPost(mcpUrl, <String, dynamic>{
      'jsonrpc': '2.0',
      'id': 8,
      'method': 'tools/call',
      'params': <String, dynamic>{
        'name': 'task_move',
        'arguments': <String, dynamic>{
          'taskId': createdTask['id'],
          'targetStatus': 'doing',
        },
      },
    });
    final moveWithoutConfirmationResult = asJsonMap(
      moveWithoutConfirmation.body['result'],
      'move without confirmation result',
    );
    expectEqual(
      moveWithoutConfirmationResult['isError'],
      true,
      'agent_mcp_http_smoke: task_move without confirmation must fail through remote MCP',
    );
    expectEqual(
      asJsonMap(
        asJsonMap(
          moveWithoutConfirmationResult['structuredContent'],
          'move without confirmation structuredContent',
        )['error'],
        'move without confirmation error',
      )['code'],
      'CONFIRMATION_REQUIRED',
      'agent_mcp_http_smoke: task_move without confirmation must preserve the confirmation code',
    );

    final moved = await mcpPost(mcpUrl, <String, dynamic>{
      'jsonrpc': '2.0',
      'id': 9,
      'method': 'tools/call',
      'params': <String, dynamic>{
        'name': 'task_move',
        'arguments': <String, dynamic>{
          'taskId': createdTask['id'],
          'targetStatus': 'doing',
          'confirmed': true,
        },
      },
    });
    final movedResult = asJsonMap(moved.body['result'], 'moved result');
    expectEqual(
      movedResult['isError'],
      false,
      'agent_mcp_http_smoke: confirmed task_move must succeed through remote MCP',
    );

    final backendTasks = await assertSuccessEnvelope(
      await getJson('${backend.baseUrl}/tasks'),
      'backend list after remote MCP execution',
    );
    final backendTaskList = asJsonMapList(
      backendTasks['tasks'],
      'backend tasks after remote MCP execution',
    );
    final backendCreatedTask = backendTaskList.firstWhere(
      (JsonMap task) => task['id'] == createdTask['id'],
      orElse: () => fail(
        'agent_mcp_http_smoke: backend must observe tasks created through remote MCP',
      ),
    );
    expectEqual(
      backendCreatedTask['status'],
      'doing',
      'agent_mcp_http_smoke: backend must observe status changes made through remote MCP',
    );

    stdout.writeln('agent_mcp_http_smoke: ok');
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
