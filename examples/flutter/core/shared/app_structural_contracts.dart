import '../domain.case.dart';

class AppErrorData {
  const AppErrorData({required this.code, required this.message, this.details});

  final String code;
  final String message;
  final dynamic details;

  Dict toJson() {
    return {
      'code': code,
      'message': message,
      if (details != null) 'details': details,
    };
  }
}

class AppCaseError implements Exception {
  const AppCaseError(this.code, this.message, [this.details]);

  final String code;
  final String message;
  final dynamic details;

  AppErrorData toAppError() {
    return AppErrorData(code: code, message: message, details: details);
  }

  @override
  String toString() {
    return 'AppCaseError($code): $message';
  }
}

AppCaseError toAppCaseError(
  AppErrorData? error,
  String fallbackMessage, [
  String fallbackCode = 'INTERNAL',
  dynamic fallbackDetails,
]) {
  if (error != null) {
    return AppCaseError(error.code, error.message, error.details);
  }

  return AppCaseError(fallbackCode, fallbackMessage, fallbackDetails);
}

class AppResult<T> {
  const AppResult({required this.success, this.data, this.error});

  const AppResult.success(this.data) : success = true, error = null;

  const AppResult.failure(this.error) : success = false, data = null;

  final bool success;
  final T? data;
  final AppErrorData? error;

  Dict toJson([dynamic Function(T value)? encodeData]) {
    return {
      'success': success,
      if (data != null)
        'data': encodeData != null ? encodeData(data as T) : data,
      if (error != null) 'error': error!.toJson(),
    };
  }
}

class StreamFailureEnvelope<TEvent> {
  const StreamFailureEnvelope({
    required this.caseName,
    required this.originalEvent,
    required this.lastError,
    required this.attempts,
    required this.firstAttemptAt,
    required this.lastAttemptAt,
    required this.correlationId,
  });

  final String caseName;
  final String surface = 'stream';
  final TEvent originalEvent;
  final Dict lastError;
  final int attempts;
  final String firstAttemptAt;
  final String lastAttemptAt;
  final String correlationId;
}

class AppPaginationParams {
  const AppPaginationParams({this.page, this.limit, this.cursor});

  final int? page;
  final int? limit;
  final String? cursor;
}

class AppPaginatedResult<T> {
  const AppPaginatedResult({
    required this.items,
    this.total,
    this.page,
    this.limit,
    this.nextCursor,
  });

  final List<T> items;
  final int? total;
  final int? page;
  final int? limit;
  final String? nextCursor;
}
