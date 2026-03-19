import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../cases/tasks/task_create/task_create.ui.case.dart';
import '../../cases/tasks/task_list/task_list.ui.case.dart';
import '../../cases/tasks/task_move/task_move.ui.case.dart';
import '../../core/shared/app_host_contracts.dart';
import '../../core/shared/app_infra_contracts.dart';
import '../../packages/design_system/index.dart';

class FetchHttpAdapter implements AppHttpClient {
  FetchHttpAdapter(this.baseUrl, [http.Client? client])
    : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  @override
  Future<dynamic> request(dynamic config) async {
    final request = config is Map
        ? Map<String, dynamic>.from(config)
        : <String, dynamic>{};
    final method = request['method']?.toString().toUpperCase() ?? 'GET';
    final url = request['url']?.toString() ?? '/';
    final body = request['body'];
    final uri = Uri.parse(baseUrl).resolve(url);

    final response = await _client.send(
      http.Request(method, uri)
        ..headers.addAll(<String, String>{'content-type': 'application/json'})
        ..body = body == null ? '' : jsonEncode(body),
    );

    final streamed = await http.Response.fromStream(response);
    final responseBody = streamed.body.trim().isEmpty
        ? null
        : jsonDecode(streamed.body) as dynamic;

    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      String message = 'HTTP ${streamed.statusCode} while requesting $url';

      if (responseBody is Map) {
        final error = responseBody['error'];
        if (error is Map && error['message'] != null) {
          message = error['message'].toString();
        } else if (responseBody['message'] != null) {
          message = responseBody['message'].toString();
        }
      }

      throw Exception(message);
    }

    if (streamed.statusCode == 204 || responseBody == null) {
      return null;
    }

    if (responseBody is Map && responseBody['success'] is bool) {
      if (responseBody['success'] != true) {
        throw Exception(
          (responseBody['error'] is Map &&
                  responseBody['error']['message'] != null)
              ? responseBody['error']['message'].toString()
              : 'Request failed',
        );
      }

      return responseBody['data'];
    }

    return responseBody;
  }
}

class PortalConfig {
  const PortalConfig({required this.apiBaseUrl});

  final String apiBaseUrl;
}

class PortalRegistry implements AppRegistry {
  PortalRegistry({
    required AppCasesRegistry cases,
    required Map<String, dynamic> providers,
    required Map<String, dynamic> packages,
  }) : _cases = cases,
       _providers = providers,
       _packages = packages;

  final AppCasesRegistry _cases;
  final Map<String, dynamic> _providers;
  final Map<String, dynamic> _packages;

  @override
  AppCasesRegistry get cases => _cases;

  @override
  Map<String, dynamic> get providers => _providers;

  @override
  Map<String, dynamic> get packages => _packages;
}

PortalRegistry createRegistry(PortalConfig config) {
  return PortalRegistry(
    cases: <String, Map<String, AppCaseSurfaces>>{
      'tasks': <String, AppCaseSurfaces>{
        'task_create': AppCaseSurfaces(ui: (context) => TaskCreateUi(context)),
        'task_list': AppCaseSurfaces(ui: (context) => TaskListUi(context)),
        'task_move': AppCaseSurfaces(ui: (context) => TaskMoveUi(context)),
      },
    },
    providers: <String, dynamic>{
      'httpClient': FetchHttpAdapter(config.apiBaseUrl),
    },
    packages: <String, dynamic>{'designSystem': const DesignSystem()},
  );
}
