import 'dart:convert';

import '../../core/shared/app_mcp_contracts.dart';

typedef _JsonRpcId = Object?;

Map<String, dynamic> _toFailure(
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

bool _isJsonRpcMessage(dynamic value) {
  return value is Map<String, dynamic> &&
      value['jsonrpc'] == '2.0' &&
      value['method'] is String;
}

AppMcpInitializeParams? _parseInitializeParams(dynamic value) {
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

AppMcpHttpResponse _toJsonResponse(
  int statusCode, {
  dynamic body,
  Map<String, String>? headers,
}) {
  return AppMcpHttpResponse(
    statusCode: statusCode,
    headers: <String, String>{
      'cache-control': 'no-store',
      if (body != null) 'content-type': 'application/json; charset=utf-8',
      ...?headers,
    },
    bodyText: body == null ? null : jsonEncode(body),
  );
}

class StreamableHttpAppMcpAdapter extends BaseAppMcpHttpAdapter {
  @override
  String get transport => 'streamable-http';

  @override
  String get endpointPath => '/mcp';

  @override
  Future<AppMcpHttpResponse?> handle(
    AppMcpHttpExchange exchange,
    AppMcpServer server,
  ) async {
    if (exchange.path != endpointPath) {
      return null;
    }

    final method = exchange.method.toUpperCase();
    if (method == 'GET' || method == 'DELETE') {
      return AppMcpHttpResponse(
        statusCode: 405,
        headers: <String, String>{'allow': 'POST', 'cache-control': 'no-store'},
      );
    }

    if (method != 'POST') {
      return AppMcpHttpResponse(
        statusCode: 405,
        headers: <String, String>{
          'allow': 'GET,POST,DELETE',
          'cache-control': 'no-store',
        },
      );
    }

    if (exchange.bodyText == null || exchange.bodyText!.trim().isEmpty) {
      return _toJsonResponse(
        400,
        body: _toFailure(null, -32600, 'Missing JSON-RPC payload.'),
      );
    }

    dynamic parsed;
    try {
      parsed = jsonDecode(exchange.bodyText!);
    } catch (error) {
      return _toJsonResponse(
        400,
        body: _toFailure(
          null,
          -32700,
          'Invalid JSON-RPC payload.',
          error.toString(),
        ),
      );
    }

    if (parsed is List && parsed.isEmpty) {
      return _toJsonResponse(
        400,
        body: _toFailure(
          null,
          -32600,
          'Empty JSON-RPC batch payload is invalid.',
        ),
      );
    }

    final messages = parsed is List ? parsed : <dynamic>[parsed];
    final responses = <Map<String, dynamic>>[];

    for (final message in messages) {
      if (!_isJsonRpcMessage(message)) {
        responses.add(
          _toFailure(null, -32600, 'Invalid JSON-RPC request shape.'),
        );
        continue;
      }

      final current = Map<String, dynamic>.from(message as Map);
      final hasId = current.containsKey('id');
      if (!hasId) {
        continue;
      }

      final requestId = current['id'];
      final context = AppMcpRequestContext(
        transport: transport,
        requestId: requestId,
        protocolVersion: current['method'] == 'initialize'
            ? _parseInitializeParams(current['params'])?.protocolVersion
            : null,
      );

      try {
        switch (current['method']) {
          case 'initialize':
            final result = await server.initialize(
              _parseInitializeParams(current['params']),
              context,
            );
            responses.add(<String, dynamic>{
              'jsonrpc': '2.0',
              'id': requestId,
              'result': result.toJson(),
            });
            break;
          case 'tools/list':
            responses.add(<String, dynamic>{
              'jsonrpc': '2.0',
              'id': requestId,
              'result': <String, dynamic>{
                'tools': (await server.listTools(context))
                    .map((AppMcpToolDescriptor item) => item.toJson())
                    .toList(growable: false),
              },
            });
            break;
          case 'resources/list':
            responses.add(<String, dynamic>{
              'jsonrpc': '2.0',
              'id': requestId,
              'result': <String, dynamic>{
                'resources': (await server.listResources(context))
                    .map((AppMcpResourceDescriptor item) => item.toJson())
                    .toList(growable: false),
              },
            });
            break;
          case 'resources/read':
            final params = current['params'];
            if (params is! Map<String, dynamic> || params['uri'] is! String) {
              throw const AppMcpProtocolError(
                -32602,
                'MCP resources/read requires a string resource uri.',
              );
            }
            responses.add(<String, dynamic>{
              'jsonrpc': '2.0',
              'id': requestId,
              'result': (await server.readResource(
                params['uri'] as String,
                context,
              )).toJson(),
            });
            break;
          case 'tools/call':
            final params = current['params'];
            if (params is! Map<String, dynamic> || params['name'] is! String) {
              throw const AppMcpProtocolError(
                -32602,
                'MCP tools/call requires a string tool name.',
              );
            }
            responses.add(<String, dynamic>{
              'jsonrpc': '2.0',
              'id': requestId,
              'result': (await server.callTool(
                params['name'] as String,
                params['arguments'],
                context,
              )).toJson(),
            });
            break;
          case 'notifications/initialized':
            break;
          default:
            throw AppMcpProtocolError(
              -32601,
              'Unsupported MCP JSON-RPC method ${current['method']}.',
            );
        }
      } on AppMcpProtocolError catch (error) {
        responses.add(
          _toFailure(requestId, error.code, error.message, error.data),
        );
      } catch (error) {
        responses.add(
          _toFailure(
            requestId,
            -32603,
            'Internal MCP server error.',
            <String, dynamic>{'message': error.toString()},
          ),
        );
      }
    }

    if (responses.isEmpty) {
      return AppMcpHttpResponse(
        statusCode: 202,
        headers: const <String, String>{'cache-control': 'no-store'},
      );
    }

    return _toJsonResponse(
      200,
      body: responses.length == 1 ? responses.first : responses,
    );
  }
}
