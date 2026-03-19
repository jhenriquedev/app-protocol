import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../apps/agent/app.dart' as agent_app;
import '../apps/agent/registry.dart';
import '../apps/backend/app.dart' as backend_app;
import '../apps/backend/registry.dart';

typedef JsonMap = Map<String, dynamic>;

class StartedHost<TApp> {
  const StartedHost({
    required this.app,
    required this.server,
    required this.baseUrl,
  });

  final TApp app;
  final HttpServer server;
  final String baseUrl;
}

Never fail(String message) {
  throw Exception(message);
}

void expectTrue(bool condition, String message) {
  if (!condition) {
    fail(message);
  }
}

void expectEqual(Object? actual, Object? expected, String message) {
  if (actual != expected) {
    fail('$message (expected: $expected, actual: $actual)');
  }
}

void expectJsonEqual(dynamic actual, dynamic expected, String message) {
  if (jsonEncode(actual) != jsonEncode(expected)) {
    fail(
      '$message (expected: ${jsonEncode(expected)}, actual: ${jsonEncode(actual)})',
    );
  }
}

JsonMap asJsonMap(dynamic value, String description) {
  if (value is! Map) {
    fail('$description must be a JSON object');
  }

  return Map<String, dynamic>.from(value);
}

List<JsonMap> asJsonMapList(dynamic value, String description) {
  if (value is! List) {
    fail('$description must be a JSON array');
  }

  return value
      .map((dynamic item) => asJsonMap(item, description))
      .toList(growable: false);
}

Future<String> createTempDataDirectory(String prefix) async {
  final directory = await Directory.systemTemp.createTemp(prefix);
  return directory.path;
}

Future<void> removeTempDirectory(String path) async {
  try {
    await Directory(path).delete(recursive: true);
  } catch (_) {
    return;
  }
}

Future<void> closeServer(HttpServer? server) async {
  if (server == null) {
    return;
  }

  await server.close(force: true);
}

Future<StartedHost<backend_app.BackendApp>> startBackendHost(
  String dataDirectory,
) async {
  final app = backend_app.bootstrap(
    BackendConfig(port: 0, dataDirectory: dataDirectory),
  );
  final server = await app.startBackend();

  return StartedHost<backend_app.BackendApp>(
    app: app,
    server: server,
    baseUrl: 'http://127.0.0.1:${server.port}',
  );
}

Future<StartedHost<agent_app.AgentApp>> startAgentHost(
  String dataDirectory,
) async {
  final app = agent_app.bootstrap(
    AgentConfig(port: 0, dataDirectory: dataDirectory),
  );
  final server = await app.startAgent();

  return StartedHost<agent_app.AgentApp>(
    app: app,
    server: server,
    baseUrl: 'http://127.0.0.1:${server.port}',
  );
}

Future<JsonMap> parseJsonResponse(
  http.Response response,
  String description,
) async {
  if (response.body.trim().isEmpty) {
    fail('$description returned an empty response body');
  }

  final decoded = jsonDecode(response.body);
  return asJsonMap(decoded, description);
}

Future<JsonMap> assertSuccessEnvelope(
  http.Response response,
  String description,
) async {
  final payload = await parseJsonResponse(response, description);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    fail('$description failed with HTTP ${response.statusCode}');
  }

  if (payload['success'] != true || payload['data'] == null) {
    final error = payload['error'];
    final message = error is Map && error['message'] != null
        ? error['message'].toString()
        : 'missing success payload';
    fail('$description failed: $message');
  }

  return asJsonMap(payload['data'], '$description data');
}

Future<JsonMap> assertFailureEnvelope(
  http.Response response,
  String description, {
  required int statusCode,
  required String code,
}) async {
  final payload = await parseJsonResponse(response, description);
  expectEqual(
    response.statusCode,
    statusCode,
    '$description must return HTTP $statusCode',
  );
  expectEqual(
    payload['success'],
    false,
    '$description must return success=false',
  );

  final error = asJsonMap(payload['error'], '$description error');
  expectEqual(error['code'], code, '$description must expose $code');
  return payload;
}

Future<http.Response> getJson(
  String url, {
  Map<String, String>? headers,
}) async {
  return http.get(Uri.parse(url), headers: headers);
}

Future<http.Response> postJson(
  String url,
  dynamic body, {
  Map<String, String>? headers,
}) async {
  return http.post(
    Uri.parse(url),
    headers: <String, String>{'content-type': 'application/json', ...?headers},
    body: jsonEncode(body),
  );
}

Future<http.Response> patchJson(
  String url,
  dynamic body, {
  Map<String, String>? headers,
}) async {
  return http.patch(
    Uri.parse(url),
    headers: <String, String>{'content-type': 'application/json', ...?headers},
    body: jsonEncode(body),
  );
}

Future<http.Response> postRaw(
  String url,
  String body, {
  Map<String, String>? headers,
}) async {
  return http.post(
    Uri.parse(url),
    headers: <String, String>{'content-type': 'application/json', ...?headers},
    body: body,
  );
}

class McpStdIoClient {
  McpStdIoClient._(this._process) {
    _stdoutSubscription = _process.stdout
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen(_handleStdoutLine);
    _stderrSubscription = _process.stderr
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen((String line) => stderrLines.add(line));
  }

  final Process _process;
  final Map<Object?, Completer<JsonMap>> _pending =
      <Object?, Completer<JsonMap>>{};
  final List<String> stderrLines = <String>[];
  late final StreamSubscription<String> _stdoutSubscription;
  late final StreamSubscription<String> _stderrSubscription;
  int _nextId = 1;

  static Future<McpStdIoClient> start({
    required String workingDirectory,
    required String dataDirectory,
  }) async {
    final process = await Process.start(
      'dart',
      <String>['run', 'apps/agent/mcp_server.dart'],
      workingDirectory: workingDirectory,
      environment: <String, String>{
        ...Platform.environment,
        'APP_FLUTTER_DATA_DIR': dataDirectory,
      },
    );

    return McpStdIoClient._(process);
  }

  void _handleStdoutLine(String line) {
    final trimmed = line.trim();
    if (trimmed.isEmpty) {
      return;
    }

    final decoded = jsonDecode(trimmed);
    if (decoded is! Map) {
      return;
    }

    final message = Map<String, dynamic>.from(decoded);
    if (!message.containsKey('id')) {
      return;
    }

    final completer = _pending.remove(message['id']);
    completer?.complete(message);
  }

  Future<JsonMap> request(String method, [dynamic params]) async {
    final id = _nextId;
    _nextId += 1;

    final completer = Completer<JsonMap>();
    _pending[id] = completer;

    _process.stdin.writeln(
      jsonEncode(<String, dynamic>{
        'jsonrpc': '2.0',
        'id': id,
        'method': method,
        if (params != null) 'params': params,
      }),
    );

    return completer.future.timeout(
      const Duration(seconds: 5),
      onTimeout: () {
        _pending.remove(id);
        throw TimeoutException('Timed out waiting for MCP response to $method');
      },
    );
  }

  void notify(String method, [dynamic params]) {
    _process.stdin.writeln(
      jsonEncode(<String, dynamic>{
        'jsonrpc': '2.0',
        'method': method,
        if (params != null) 'params': params,
      }),
    );
  }

  String stderrSummary() {
    return stderrLines.join('\n');
  }

  Future<void> close() async {
    await _process.stdin.close();
    _process.kill(ProcessSignal.sigterm);

    try {
      await _process.exitCode.timeout(const Duration(seconds: 5));
    } on TimeoutException {
      _process.kill(ProcessSignal.sigkill);
      await _process.exitCode;
    }

    await _stdoutSubscription.cancel();
    await _stderrSubscription.cancel();
  }
}
