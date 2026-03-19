package core;

import core.shared.AppBaseContext;
import core.shared.AppInfraContracts.AppCache;
import core.shared.AppInfraContracts.AppEventPublisher;
import core.shared.AppStructuralContracts.AppCaseError;
import core.shared.AppStructuralContracts.StreamFailureEnvelope;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public abstract class BaseStreamCase<TInput, TOutput> {
  public static class StreamContext extends AppBaseContext {
    public AppEventPublisher eventBus;
    public Object queue;
    public Object db;
    public AppCache cache;
    public Map<String, Object> cases = new LinkedHashMap<>();
    public Map<String, Object> packages = new LinkedHashMap<>();
    public Map<String, Object> extra = new LinkedHashMap<>();
  }

  public static class StreamEvent<T> {
    public String type;
    public T payload;
    public String idempotencyKey;
    public Map<String, Object> metadata = new LinkedHashMap<>();
  }

  public static class AppStreamRecoveryPolicy {
    public Retry retry;
    public DeadLetter deadLetter;

    public static class Retry {
      public int maxAttempts;
      public Integer backoffMs;
      public Double multiplier;
      public Integer maxBackoffMs;
      public Boolean jitter;
      public List<String> retryableErrors = List.of();
    }

    public static class DeadLetter {
      public String destination;
      public Boolean includeFailureMetadata;
    }
  }

  public interface AppStreamDeadLetterBinding<TEvent> {
    void publish(StreamFailureEnvelope<StreamEvent<TEvent>> envelope) throws Exception;
  }

  public static class AppStreamRuntimeCapabilities {
    public Integer maxAttemptsLimit;
    public Boolean supportsJitter;
    public Map<String, AppStreamDeadLetterBinding<?>> deadLetters = new LinkedHashMap<>();
  }

  public static void validateStreamRecoveryPolicy(
      String source,
      AppStreamRecoveryPolicy policy
  ) {
    if (policy == null) {
      return;
    }

    String label = source == null || source.isBlank() ? "stream" : source;
    AppStreamRecoveryPolicy.Retry retry = policy.retry;
    AppStreamRecoveryPolicy.DeadLetter deadLetter = policy.deadLetter;

    if (retry != null) {
      if (retry.maxAttempts < 1) {
        throw new IllegalArgumentException(
            label + ": recoveryPolicy.retry.maxAttempts must be >= 1"
        );
      }

      if (retry.backoffMs != null && retry.backoffMs < 0) {
        throw new IllegalArgumentException(
            label + ": recoveryPolicy.retry.backoffMs must be >= 0"
        );
      }

      if (retry.multiplier != null && retry.multiplier < 1) {
        throw new IllegalArgumentException(
            label + ": recoveryPolicy.retry.multiplier must be >= 1"
        );
      }

      if (retry.maxBackoffMs != null && retry.maxBackoffMs < 0) {
        throw new IllegalArgumentException(
            label + ": recoveryPolicy.retry.maxBackoffMs must be >= 0"
        );
      }

      if (retry.backoffMs != null
          && retry.maxBackoffMs != null
          && retry.maxBackoffMs < retry.backoffMs) {
        throw new IllegalArgumentException(
            label + ": recoveryPolicy.retry.maxBackoffMs must be >= backoffMs"
        );
      }
    }

    if (deadLetter != null && (deadLetter.destination == null || deadLetter.destination.isBlank())) {
      throw new IllegalArgumentException(
          label + ": recoveryPolicy.deadLetter.destination must be non-empty"
      );
    }
  }

  public static void validateStreamRuntimeCompatibility(
      String source,
      AppStreamRecoveryPolicy policy,
      AppStreamRuntimeCapabilities runtime
  ) {
    if (policy == null || runtime == null) {
      return;
    }

    String label = source == null || source.isBlank() ? "stream" : source;
    AppStreamRecoveryPolicy.Retry retry = policy.retry;
    AppStreamRecoveryPolicy.DeadLetter deadLetter = policy.deadLetter;

    if (retry != null
        && runtime.maxAttemptsLimit != null
        && retry.maxAttempts > runtime.maxAttemptsLimit) {
      throw new IllegalArgumentException(
          label + ": recoveryPolicy.retry.maxAttempts exceeds host limit"
      );
    }

    if (retry != null
        && Boolean.TRUE.equals(retry.jitter)
        && Boolean.FALSE.equals(runtime.supportsJitter)) {
      throw new IllegalArgumentException(
          label + ": recoveryPolicy.retry.jitter=true but host runtime does not support jitter"
      );
    }

    if (deadLetter != null && !runtime.deadLetters.containsKey(deadLetter.destination)) {
      throw new IllegalArgumentException(
          label + ": dead-letter destination is not bound by the host app"
      );
    }
  }

  public static boolean isStreamErrorRetryable(
      Throwable error,
      List<String> retryableErrors
  ) {
    if (retryableErrors == null || retryableErrors.isEmpty()) {
      return true;
    }

    String code = extractStreamErrorCode(error);
    return code != null && retryableErrors.contains(code);
  }

  public static int computeStreamRetryDelayMs(
      AppStreamRecoveryPolicy.Retry retry,
      int attempt
  ) {
    int base = retry.backoffMs == null ? 0 : retry.backoffMs;
    if (base <= 0) {
      return 0;
    }

    double multiplier = retry.multiplier == null ? 1D : retry.multiplier;
    int exponent = Math.max(0, attempt - 1);
    double delay = base * Math.pow(multiplier, exponent);

    if (retry.maxBackoffMs != null) {
      delay = Math.min(delay, retry.maxBackoffMs);
    }

    if (Boolean.TRUE.equals(retry.jitter) && delay > 0) {
      delay = Math.floor(Math.random() * delay);
    }

    return (int) Math.floor(delay);
  }

  public static <TEvent> StreamFailureEnvelope<StreamEvent<TEvent>> createStreamFailureEnvelope(
      String caseName,
      StreamEvent<TEvent> event,
      Throwable error,
      int attempts,
      String correlationId,
      String firstAttemptAt,
      String lastAttemptAt
  ) {
    String code = extractStreamErrorCode(error);
    String message = error == null ? "Unknown stream failure" : error.getMessage();
    String stack = error == null ? null : stackTrace(error);

    return new StreamFailureEnvelope<>(
        caseName,
        "stream",
        event,
        new StreamFailureEnvelope.FailureError(message, code, stack),
        attempts,
        firstAttemptAt,
        lastAttemptAt,
        correlationId
    );
  }

  private static String extractStreamErrorCode(Throwable error) {
    if (error instanceof AppCaseError appCaseError) {
      return appCaseError.code();
    }

    return null;
  }

  private static String stackTrace(Throwable error) {
    StringBuilder builder = new StringBuilder();
    for (StackTraceElement element : error.getStackTrace()) {
      builder.append(element).append("\n");
    }
    return builder.toString();
  }

  protected final StreamContext ctx;

  protected BaseStreamCase(StreamContext ctx) {
    this.ctx = ctx;
  }

  public abstract void handler(StreamEvent<TInput> event) throws Exception;

  public Object subscribe() {
    return null;
  }

  public AppStreamRecoveryPolicy recoveryPolicy() {
    return null;
  }

  public void test() throws Exception {}

  protected Object _repository() throws Exception {
    return null;
  }

  protected boolean useComposition() {
    return false;
  }

  protected void _composition(StreamEvent<TInput> event) throws Exception {
    throw new AppCaseError(
        "INTERNAL",
        "BaseStreamCase: _composition must be implemented when useComposition() is true"
    );
  }

  protected TInput _consume(StreamEvent<TInput> event) throws Exception {
    return event.payload;
  }

  protected TOutput _service(TInput input) throws Exception {
    @SuppressWarnings("unchecked")
    TOutput passthrough = (TOutput) input;
    return passthrough;
  }

  protected void _publish(TOutput output) throws Exception {}

  protected void pipeline(StreamEvent<TInput> event) throws Exception {
    if (useComposition()) {
      _composition(event);
      return;
    }

    TInput consumed = _consume(event);
    TOutput transformed = _service(consumed);
    _publish(transformed);
  }
}
