package core.shared;

import java.util.List;

public final class AppStructuralContracts {
  private AppStructuralContracts() {}

  public record AppError(String code, String message, Object details) {}

  public static class AppCaseError extends RuntimeException {
    private final String code;
    private final Object details;

    public AppCaseError(String code, String message) {
      this(code, message, null);
    }

    public AppCaseError(String code, String message, Object details) {
      super(message);
      this.code = code;
      this.details = details;
    }

    public String code() {
      return code;
    }

    public Object details() {
      return details;
    }

    public AppError toAppError() {
      return new AppError(code, getMessage(), details);
    }
  }

  public static AppCaseError toAppCaseError(
      AppError error,
      String fallbackMessage,
      String fallbackCode,
      Object fallbackDetails
  ) {
    if (error != null) {
      return new AppCaseError(error.code(), error.message(), error.details());
    }

    return new AppCaseError(fallbackCode, fallbackMessage, fallbackDetails);
  }

  public static AppCaseError toAppCaseError(AppError error, String fallbackMessage) {
    return toAppCaseError(error, fallbackMessage, "INTERNAL", null);
  }

  public static class AppResult<T> {
    public boolean success;
    public T data;
    public AppError error;

    public static <T> AppResult<T> success(T data) {
      AppResult<T> result = new AppResult<>();
      result.success = true;
      result.data = data;
      return result;
    }

    public static <T> AppResult<T> failure(AppError error) {
      AppResult<T> result = new AppResult<>();
      result.success = false;
      result.error = error;
      return result;
    }
  }

  public record StreamFailureEnvelope<TEvent>(
      String caseName,
      String surface,
      TEvent originalEvent,
      FailureError lastError,
      int attempts,
      String firstAttemptAt,
      String lastAttemptAt,
      String correlationId
  ) {
    public record FailureError(String message, String code, String stack) {}
  }

  public static class AppPaginationParams {
    public Integer page;
    public Integer limit;
    public String cursor;
  }

  public static class AppPaginatedResult<T> {
    public List<T> items;
    public Integer total;
    public Integer page;
    public Integer limit;
    public String cursor;
    public Boolean hasMore;
  }
}
