import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../core/shared/app_mcp_contracts.dart';

typedef _JsonRpcId = Object?;

Map<String, dynamic> _toStdioFailure(
  _JsonRpcId id,
  int code,
  String message, [
  dynamic data,
]) {
  return <String, dynamic>{
    'jsonrpc': '2.0',
    'id': id,
    'error': <String, dynamic>{
      'code': code,
      'message': message,
      if (data != null) 'data': data,
    },
  };
}

bool _isStdioJsonRpc(dynamic value) {
  return value is Map<String, dynamic> &&
      value['jsonrpc'] == '2.0' &&
      value['method'] is String;
}

AppMcpInitializeParams? _parseStdioInitializeParams(dynamic value) {
  if (value is! Map<String, dynamic> || value['protocolVersion'] is! String) {
    return null;
  }

  final clientInfoValue = value['clientInfo'];
  AppMcpClientInfo? clientInfo;
  if (clientInfoValue is Map<String, dynamic> &&
      clientInfoValue['name'] is String &&
      clientInfoValue['version'] is String) {
    clientInfo = AppMcpClientInfo(
      name: clientInfoValue['name'] as String,
      version: clientInfoValue['version'] as String,
    );
  }

  return AppMcpInitializeParams(
    protocolVersion: value['protocolVersion'] as String,
    capabilities: value['capabilities'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(
            value['capabilities'] as Map<String, dynamic>,
          )
        : null,
    clientInfo: clientInfo,
  );
}

class StdioAppMcpAdapter extends BaseAppMcpProcessAdapter {
  @override
  String get transport => 'stdio';

  @override
  Future<void> serve(AppMcpServer server) async {
    final sessionId = 'stdio_${DateTime.now().microsecondsSinceEpoch}';
    var phase = 'awaiting_initialize';
    String? protocolVersion;
    AppMcpClientInfo? clientInfo;

    final completer = Completer<void>();
    late final StreamSubscription<String> subscription;

    Future<void> writeMessage(Map<String, dynamic> message) async {
      stdout.writeln(jsonEncode(message));
    }

    subscription = stdin
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen(
          (String line) async {
            final trimmed = line.trim();
            if (trimmed.isEmpty) {
              return;
            }

            dynamic parsed;
            try {
              parsed = jsonDecode(trimmed);
            } catch (error) {
              await writeMessage(
                _toStdioFailure(
                  null,
                  -32700,
                  'Invalid JSON-RPC payload.',
                  error.toString(),
                ),
              );
              return;
            }

            if (!_isStdioJsonRpc(parsed)) {
              await writeMessage(
                _toStdioFailure(
                  null,
                  -32600,
                  'Invalid JSON-RPC request shape.',
                ),
              );
              return;
            }

            final message = Map<String, dynamic>.from(parsed as Map);
            final hasId = message.containsKey('id');
            final requestId = message['id'];
            final method = message['method'] as String;
            final context = AppMcpRequestContext(
              transport: transport,
              requestId: requestId,
              sessionId: sessionId,
              protocolVersion: protocolVersion,
              clientInfo: clientInfo,
            );

            if (!hasId) {
              if (method == 'notifications/initialized' &&
                  phase == 'awaiting_initialized_notification') {
                phase = 'ready';
              }
              return;
            }

            try {
              switch (method) {
                case 'initialize':
                  if (phase != 'awaiting_initialize') {
                    throw const AppMcpProtocolError(
                      -32600,
                      'MCP initialize may only run once per stdio session.',
                    );
                  }

                  final params = _parseStdioInitializeParams(message['params']);
                  final result = await server.initialize(params, context);
                  protocolVersion = result.protocolVersion;
                  clientInfo = params?.clientInfo;
                  phase = 'awaiting_initialized_notification';

                  await writeMessage(<String, dynamic>{
                    'jsonrpc': '2.0',
                    'id': requestId,
                    'result': result.toJson(),
                  });
                  return;
                case 'ping':
                  if (phase != 'ready') {
                    throw const AppMcpProtocolError(
                      -32002,
                      'MCP session is not ready; complete initialization first.',
                    );
                  }

                  await writeMessage(<String, dynamic>{
                    'jsonrpc': '2.0',
                    'id': requestId,
                    'result': <String, dynamic>{},
                  });
                  return;
                case 'tools/list':
                  if (phase != 'ready') {
                    throw const AppMcpProtocolError(
                      -32002,
                      'MCP session is not ready; complete initialization first.',
                    );
                  }

                  await writeMessage(<String, dynamic>{
                    'jsonrpc': '2.0',
                    'id': requestId,
                    'result': <String, dynamic>{
                      'tools': (await server.listTools(context))
                          .map((AppMcpToolDescriptor item) => item.toJson())
                          .toList(growable: false),
                    },
                  });
                  return;
                case 'resources/list':
                  if (phase != 'ready') {
                    throw const AppMcpProtocolError(
                      -32002,
                      'MCP session is not ready; complete initialization first.',
                    );
                  }

                  await writeMessage(<String, dynamic>{
                    'jsonrpc': '2.0',
                    'id': requestId,
                    'result': <String, dynamic>{
                      'resources': (await server.listResources(context))
                          .map((AppMcpResourceDescriptor item) => item.toJson())
                          .toList(growable: false),
                    },
                  });
                  return;
                case 'resources/read':
                  if (phase != 'ready') {
                    throw const AppMcpProtocolError(
                      -32002,
                      'MCP session is not ready; complete initialization first.',
                    );
                  }

                  final params = message['params'];
                  if (params is! Map<String, dynamic> ||
                      params['uri'] is! String) {
                    throw const AppMcpProtocolError(
                      -32602,
                      'MCP resources/read requires a string resource uri.',
                    );
                  }

                  await writeMessage(<String, dynamic>{
                    'jsonrpc': '2.0',
                    'id': requestId,
                    'result': (await server.readResource(
                      params['uri'] as String,
                      context,
                    )).toJson(),
                  });
                  return;
                case 'tools/call':
                  if (phase != 'ready') {
                    throw const AppMcpProtocolError(
                      -32002,
                      'MCP session is not ready; complete initialization first.',
                    );
                  }

                  final params = message['params'];
                  if (params is! Map<String, dynamic> ||
                      params['name'] is! String) {
                    throw const AppMcpProtocolError(
                      -32602,
                      'MCP tools/call requires a string tool name.',
                    );
                  }

                  await writeMessage(<String, dynamic>{
                    'jsonrpc': '2.0',
                    'id': requestId,
                    'result': (await server.callTool(
                      params['name'] as String,
                      params['arguments'],
                      context,
                    )).toJson(),
                  });
                  return;
                default:
                  throw AppMcpProtocolError(
                    -32601,
                    'Unsupported MCP JSON-RPC method $method.',
                  );
              }
            } on AppMcpProtocolError catch (error) {
              await writeMessage(
                _toStdioFailure(
                  requestId,
                  error.code,
                  error.message,
                  error.data,
                ),
              );
            } catch (error) {
              await writeMessage(
                _toStdioFailure(
                  requestId,
                  -32603,
                  'Internal MCP server error.',
                  <String, dynamic>{'message': error.toString()},
                ),
              );
            }
          },
          onDone: () {
            if (!completer.isCompleted) {
              completer.complete();
            }
          },
          onError: (Object error, StackTrace stackTrace) {
            stderr.writeln('[mcp-stdio] $error');
            if (!completer.isCompleted) {
              completer.completeError(error, stackTrace);
            }
          },
        );

    await completer.future;
    await subscription.cancel();
  }
}
