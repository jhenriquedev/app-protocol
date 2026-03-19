import '../domain.case.dart';

abstract interface class AppLogger {
  void debug(String message, [Dict? meta]);

  void info(String message, [Dict? meta]);

  void warn(String message, [Dict? meta]);

  void error(String message, [Dict? meta]);
}

class AppBaseContext {
  const AppBaseContext({
    required this.correlationId,
    required this.logger,
    this.executionId,
    this.tenantId,
    this.userId,
    this.config,
  });

  final String correlationId;
  final String? executionId;
  final String? tenantId;
  final String? userId;
  final AppLogger logger;
  final Dict? config;
}
