import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../core/api.case.dart';
import '../../core/shared/app_base_context.dart';
import '../../core/shared/app_host_contracts.dart';
import '../../core/shared/app_structural_contracts.dart';
import 'registry.dart';

class _BackendLogger implements AppLogger {
  const _BackendLogger();

  void _log(String level, String message, [Map<String, dynamic>? meta]) {
    stdout.writeln('[backend][$level] $message${meta == null ? '' : ' $meta'}');
  }

  @override
  void debug(String message, [Map<String, dynamic>? meta]) =>
      _log('debug', message, meta);

  @override
  void info(String message, [Map<String, dynamic>? meta]) =>
      _log('info', message, meta);

  @override
  void warn(String message, [Map<String, dynamic>? meta]) =>
      _log('warn', message, meta);

  @override
  void error(String message, [Map<String, dynamic>? meta]) =>
      _log('error', message, meta);
}

class _RouteMatch {
  const _RouteMatch({required this.route, required this.params});

  final RouteBinding route;
  final Map<String, String> params;
}

int _backendIdCounter = 0;

String _generateId() {
  _backendIdCounter += 1;
  return 'backend_${DateTime.now().microsecondsSinceEpoch}_$_backendIdCounter';
}

int _mapErrorCodeToStatus(String? code) {
  switch (code) {
    case 'INVALID_REQUEST':
    case 'VALIDATION_FAILED':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    default:
      return 500;
  }
}

dynamic _toSerializable(dynamic value) {
  if (value == null || value is num || value is String || value is bool) {
    return value;
  }

  if (value is Map) {
    return value.map(
      (dynamic key, dynamic item) =>
          MapEntry(key.toString(), _toSerializable(item)),
    );
  }

  if (value is Iterable) {
    return value.map(_toSerializable).toList(growable: false);
  }

  if (value is AppResult) {
    return value.toJson(_toSerializable);
  }

  try {
    return _toSerializable((value as dynamic).toJson());
  } catch (_) {
    return value.toString();
  }
}

Future<dynamic> _readRequestBody(HttpRequest request) async {
  final content = await utf8.decoder.bind(request).join();
  final normalized = content.trim();
  if (normalized.isEmpty) {
    return null;
  }

  return jsonDecode(normalized);
}

void _sendJson(HttpResponse response, int statusCode, dynamic body) {
  response.statusCode = statusCode;
  response.headers.contentType = ContentType.json;
  response.headers.set('access-control-allow-origin', '*');
  response.headers.set(
    'access-control-allow-methods',
    'GET,POST,PATCH,OPTIONS',
  );
  response.headers.set('access-control-allow-headers', 'content-type');
  response.headers.set('cache-control', 'no-store');
  response.write(
    const JsonEncoder.withIndent('  ').convert(_toSerializable(body)),
  );
  response.close();
}

void _sendStructuredError(
  HttpResponse response,
  int statusCode,
  String code,
  String message, [
  dynamic details,
]) {
  _sendJson(response, statusCode, <String, dynamic>{
    'success': false,
    'error': <String, dynamic>{
      'code': code,
      'message': message,
      if (details != null) 'details': details,
    },
  });
}

Map<String, String>? _matchRoutePath(String routePath, String actualPath) {
  final routeSegments = routePath
      .split('/')
      .where((String segment) => segment.isNotEmpty)
      .toList(growable: false);
  final pathSegments = actualPath
      .split('/')
      .where((String segment) => segment.isNotEmpty)
      .toList(growable: false);

  if (routeSegments.length != pathSegments.length) {
    return null;
  }

  final params = <String, String>{};
  for (var index = 0; index < routeSegments.length; index += 1) {
    final routeSegment = routeSegments[index];
    final pathSegment = pathSegments[index];

    if (routeSegment.startsWith(':')) {
      params[routeSegment.substring(1)] = Uri.decodeComponent(pathSegment);
      continue;
    }

    if (routeSegment != pathSegment) {
      return null;
    }
  }

  return params;
}

class BackendApp {
  BackendApp({
    required this.registry,
    required this.createApiContext,
    required this.handleRequest,
    required this.startBackend,
  });

  final BackendRegistry registry;
  final ApiContext Function([Map<String, dynamic>? parent]) createApiContext;
  final Future<void> Function(HttpRequest request) handleRequest;
  final Future<HttpServer> Function() startBackend;
}

BackendApp bootstrap([BackendConfig config = const BackendConfig()]) {
  const logger = _BackendLogger();
  final registry = createRegistry(config);

  Map<String, dynamic> materializeCases(ApiContext context) {
    final cases = <String, dynamic>{};

    registry.cases.forEach((
      String domain,
      Map<String, AppCaseSurfaces> domainCases,
    ) {
      final resolvedDomain = <String, dynamic>{};
      domainCases.forEach((String caseName, AppCaseSurfaces surfaces) {
        final entry = <String, dynamic>{};
        if (surfaces.api != null) {
          entry['apiHandler'] = (dynamic input) async {
            final runtimeInstance = surfaces.api!(context) as dynamic;
            return runtimeInstance.handler(input);
          };
          entry['api'] = <String, dynamic>{
            'handler': (dynamic input) async {
              final runtimeInstance = surfaces.api!(context) as dynamic;
              return runtimeInstance.handler(input);
            },
          };
        }
        resolvedDomain[caseName] = entry;
      });
      cases[domain] = resolvedDomain;
    });

    return cases;
  }

  ApiContext createApiContext([Map<String, dynamic>? parent]) {
    final context = ApiContext(
      correlationId: parent?['correlationId']?.toString() ?? _generateId(),
      executionId: _generateId(),
      tenantId: parent?['tenantId']?.toString(),
      userId: parent?['userId']?.toString(),
      config: parent?['config'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(parent!['config'] as Map<String, dynamic>)
          : null,
      logger: logger,
      packages: registry.packages,
      extra: <String, dynamic>{'providers': registry.providers},
    );

    return ApiContext(
      correlationId: context.correlationId,
      executionId: context.executionId,
      tenantId: context.tenantId,
      userId: context.userId,
      config: context.config,
      logger: context.logger,
      packages: context.packages,
      extra: context.extra,
      cases: materializeCases(context),
    );
  }

  final routes = <RouteBinding>[];
  for (final domainCases in registry.cases.values) {
    for (final surfaces in domainCases.values) {
      if (surfaces.api == null) {
        continue;
      }

      final bootInstance =
          surfaces.api!(
                createApiContext(<String, dynamic>{'correlationId': 'boot'}),
              )
              as dynamic;
      final route = bootInstance.router() as RouteBinding?;
      if (route == null) {
        continue;
      }

      routes.add(
        RouteBinding(
          method: route.method.toUpperCase(),
          path: route.path,
          handler: (RouteRequest request) async {
            final runtimeInstance =
                surfaces.api!(createApiContext()) as dynamic;
            final runtimeRoute = runtimeInstance.router() as RouteBinding?;

            if (runtimeRoute?.handler != null) {
              return runtimeRoute!.handler!(request);
            }

            return runtimeInstance.handler(request.body);
          },
        ),
      );
    }
  }

  _RouteMatch? resolveRoute(String method, String path) {
    for (final route in routes) {
      if (route.method != method) {
        continue;
      }

      final params = _matchRoutePath(route.path, path);
      if (params != null) {
        return _RouteMatch(route: route, params: params);
      }
    }

    return null;
  }

  Future<void> handleRequest(HttpRequest request) async {
    final path = request.uri.path;
    final method = request.method.toUpperCase();

    if (method == 'OPTIONS') {
      request.response.statusCode = HttpStatus.noContent;
      request.response.headers.set('access-control-allow-origin', '*');
      request.response.headers.set(
        'access-control-allow-methods',
        'GET,POST,PATCH,OPTIONS',
      );
      request.response.headers.set(
        'access-control-allow-headers',
        'content-type',
      );
      await request.response.close();
      return;
    }

    if (method == 'GET' && path == '/health') {
      _sendJson(request.response, HttpStatus.ok, <String, dynamic>{
        'ok': true,
        'app': 'flutter-example-backend',
        'status': 'ready',
      });
      return;
    }

    if (method == 'GET' && path == '/manifest') {
      _sendJson(request.response, HttpStatus.ok, <String, dynamic>{
        'app': 'flutter-example-backend',
        'port': registry.providers['port'],
        'registeredDomains': registry.cases.keys.toList(growable: false),
        'packages': registry.packages.keys.toList(growable: false),
        'routes': routes
            .map((RouteBinding route) => '${route.method} ${route.path}')
            .toList(growable: false),
      });
      return;
    }

    final matchedRoute = resolveRoute(method, path);
    if (matchedRoute?.route.handler != null) {
      dynamic body;
      try {
        body = await _readRequestBody(request);
      } catch (error) {
        _sendStructuredError(
          request.response,
          HttpStatus.badRequest,
          'INVALID_REQUEST',
          error.toString().replaceFirst('FormatException: ', ''),
        );
        return;
      }

      try {
        final response = await matchedRoute!.route.handler!(
          RouteRequest(
            body: body,
            method: method,
            path: path,
            params: matchedRoute.params,
            request: request,
          ),
        );

        if (response is ApiResponse) {
          _sendJson(
            request.response,
            response.statusCode ??
                (response.success
                    ? HttpStatus.ok
                    : _mapErrorCodeToStatus(response.error?.code)),
            response,
          );
          return;
        }

        _sendJson(request.response, HttpStatus.ok, response);
        return;
      } on AppCaseError catch (error) {
        _sendStructuredError(
          request.response,
          _mapErrorCodeToStatus(error.code),
          error.code,
          error.message,
          error.details,
        );
        return;
      } catch (error) {
        logger.error('Unhandled backend route error', <String, dynamic>{
          'error': error.toString(),
          'method': method,
          'path': path,
        });

        _sendStructuredError(
          request.response,
          HttpStatus.internalServerError,
          'INTERNAL',
          'Internal backend scaffold error.',
        );
        return;
      }
    }

    _sendStructuredError(
      request.response,
      HttpStatus.notFound,
      'NOT_FOUND',
      'Route not found in structural scaffold.',
      <String, dynamic>{'method': method, 'path': path},
    );
  }

  Future<HttpServer> startBackend() async {
    final server = await HttpServer.bind(
      InternetAddress.loopbackIPv4,
      registry.providers['port'] as int,
    );

    unawaited(
      server.forEach((HttpRequest request) async {
        await handleRequest(request);
      }),
    );

    logger.info('Backend scaffold started', <String, dynamic>{
      'port': server.port,
      'packages': registry.packages.keys.toList(growable: false),
    });

    return server;
  }

  return BackendApp(
    registry: registry,
    createApiContext: createApiContext,
    handleRequest: handleRequest,
    startBackend: startBackend,
  );
}

final BackendApp app = bootstrap();
