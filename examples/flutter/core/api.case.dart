import 'shared/app_base_context.dart';
import 'shared/app_infra_contracts.dart';
import 'shared/app_structural_contracts.dart';
import 'domain.case.dart';

class ApiContext extends AppBaseContext {
  const ApiContext({
    required super.correlationId,
    required super.logger,
    super.executionId,
    super.tenantId,
    super.userId,
    super.config,
    this.httpClient,
    this.db,
    this.auth,
    this.storage,
    this.cache,
    this.cases,
    this.packages,
    this.extra,
  });

  final AppHttpClient? httpClient;
  final dynamic db;
  final dynamic auth;
  final AppStorageClient? storage;
  final AppCache? cache;
  final Dict? cases;
  final Dict? packages;
  final Dict? extra;
}

class ApiResponse<T> extends AppResult<T> {
  const ApiResponse({
    required super.success,
    super.data,
    super.error,
    this.statusCode,
  });

  ApiResponse.success(super.data, {this.statusCode}) : super.success();

  ApiResponse.failure(super.error, {this.statusCode}) : super.failure();

  final int? statusCode;
}

class RouteRequest {
  const RouteRequest({
    required this.method,
    required this.path,
    required this.params,
    this.body,
    this.request,
  });

  final dynamic body;
  final String method;
  final String path;
  final Map<String, String> params;
  final dynamic request;
}

typedef RouteHandler = Future<dynamic> Function(RouteRequest request);

class RouteBinding {
  const RouteBinding({required this.method, required this.path, this.handler});

  final String method;
  final String path;
  final RouteHandler? handler;
}

abstract class BaseApiCase<TInput, TOutput> {
  BaseApiCase(this.ctx);

  final ApiContext ctx;

  Future<ApiResponse<TOutput>> handler(TInput input);

  RouteBinding? router() => null;

  Future<void> test() async {}

  Future<ApiResponse<TOutput>> execute(
    TInput input, {
    Future<void> Function(TInput input)? validate,
    Future<void> Function(TInput input)? authorize,
    Future<TOutput> Function(TInput input)? service,
    Future<TOutput> Function(TInput input)? composition,
  }) async {
    try {
      if (validate != null) {
        await validate(input);
      }

      if (authorize != null) {
        await authorize(input);
      }

      if (composition == null && service == null) {
        throw const AppCaseError(
          'INTERNAL',
          'BaseApiCase requires a service or composition execution center',
        );
      }

      final result = composition != null
          ? await composition(input)
          : await service!(input);

      return ApiResponse.success(result);
    } on AppCaseError catch (error) {
      return ApiResponse.failure(error.toAppError());
    } catch (error) {
      ctx.logger.error('Unhandled API case error', {
        'error': error.toString(),
        'case': runtimeType.toString(),
      });

      return ApiResponse.failure(
        const AppCaseError('INTERNAL', 'Internal API case error.').toAppError(),
      );
    }
  }
}
