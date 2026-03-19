import 'shared/app_base_context.dart';
import 'shared/app_infra_contracts.dart';
import 'shared/app_structural_contracts.dart';
import 'domain.case.dart';

class StreamContext extends AppBaseContext {
  const StreamContext({
    required super.correlationId,
    required super.logger,
    super.executionId,
    super.tenantId,
    super.userId,
    super.config,
    this.eventPublisher,
    this.queue,
    this.cases,
    this.packages,
    this.extra,
  });

  final AppEventPublisher? eventPublisher;
  final dynamic queue;
  final Dict? cases;
  final Dict? packages;
  final Dict? extra;
}

class StreamRecoveryPolicy {
  const StreamRecoveryPolicy({
    this.maxAttempts,
    this.backoffSeconds,
    this.deadLetterEvent,
  });

  final int? maxAttempts;
  final int? backoffSeconds;
  final String? deadLetterEvent;

  Dict toJson() {
    return {
      if (maxAttempts != null) 'maxAttempts': maxAttempts,
      if (backoffSeconds != null) 'backoffSeconds': backoffSeconds,
      if (deadLetterEvent != null) 'deadLetterEvent': deadLetterEvent,
    };
  }
}

abstract class BaseStreamCase<TEvent, TOutput> {
  BaseStreamCase(this.ctx);

  final StreamContext ctx;

  Future<AppResult<TOutput>> handler(TEvent event);

  dynamic subscribe() => null;

  StreamRecoveryPolicy? recoveryPolicy() => null;

  Future<void> test() async {}

  Future<AppResult<TOutput>> execute(
    TEvent event, {
    Future<TOutput> Function(TEvent event)? service,
    Future<TOutput> Function(TEvent event)? composition,
  }) async {
    try {
      final result = composition != null
          ? await composition(event)
          : service != null
          ? await service(event)
          : throw const AppCaseError(
              'INTERNAL',
              'BaseStreamCase requires a service or composition execution center',
            );

      return AppResult.success(result);
    } on AppCaseError catch (error) {
      return AppResult.failure(error.toAppError());
    } catch (error) {
      ctx.logger.error('Unhandled stream case error', {
        'error': error.toString(),
        'case': runtimeType.toString(),
      });

      return AppResult.failure(
        const AppCaseError(
          'INTERNAL',
          'Internal stream case error.',
        ).toAppError(),
      );
    }
  }
}
