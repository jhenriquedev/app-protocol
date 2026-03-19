package app.protocol.examples.kotlin.core.stream

import app.protocol.examples.kotlin.core.Dict
import app.protocol.examples.kotlin.core.shared.AppBaseContext
import app.protocol.examples.kotlin.core.shared.AppCache
import app.protocol.examples.kotlin.core.shared.AppEventPublisher
import app.protocol.examples.kotlin.core.shared.StreamFailureEnvelope
import kotlin.math.floor
import kotlin.math.min
import kotlin.math.pow
import kotlin.random.Random

interface StreamContext : AppBaseContext {
    val eventBus: AppEventPublisher?
    val queue: Any?
    val db: Any?
    val cache: AppCache?
    val cases: Dict<Any?>?
    val packages: Dict<Any?>?
    val extra: Dict<Any?>?
}

data class StreamEvent<T>(
    val type: String,
    val payload: T,
    val idempotencyKey: String? = null,
    val metadata: Map<String, Any?>? = null,
)

data class AppStreamRecoveryPolicy(
    val retry: RetryPolicy? = null,
    val deadLetter: DeadLetterPolicy? = null,
) {
    data class RetryPolicy(
        val maxAttempts: Int,
        val backoffMs: Long? = null,
        val multiplier: Double? = null,
        val maxBackoffMs: Long? = null,
        val jitter: Boolean? = null,
        val retryableErrors: List<String>? = null,
    )

    data class DeadLetterPolicy(
        val destination: String,
        val includeFailureMetadata: Boolean? = null,
    )
}

fun interface AppStreamDeadLetterBinding<TEvent> {
    suspend fun publish(envelope: StreamFailureEnvelope<StreamEvent<TEvent>>)
}

data class AppStreamRuntimeCapabilities(
    val maxAttemptsLimit: Int? = null,
    val supportsJitter: Boolean? = null,
    val deadLetters: Dict<AppStreamDeadLetterBinding<Any?>>? = null,
)

fun validateStreamRecoveryPolicy(
    source: String,
    policy: AppStreamRecoveryPolicy?,
) {
    if (policy == null) return
    val label = source.ifBlank { "stream" }
    val retry = policy.retry
    val deadLetter = policy.deadLetter

    if (retry != null) {
        require(retry.maxAttempts >= 1) {
            "$label: recoveryPolicy.retry.maxAttempts must be an integer >= 1"
        }
        require(retry.backoffMs == null || retry.backoffMs >= 0) {
            "$label: recoveryPolicy.retry.backoffMs must be >= 0"
        }
        require(retry.multiplier == null || retry.multiplier >= 1.0) {
            "$label: recoveryPolicy.retry.multiplier must be >= 1"
        }
        require(retry.maxBackoffMs == null || retry.maxBackoffMs >= 0) {
            "$label: recoveryPolicy.retry.maxBackoffMs must be >= 0"
        }
        require(
            retry.backoffMs == null || retry.maxBackoffMs == null || retry.maxBackoffMs >= retry.backoffMs,
        ) {
            "$label: recoveryPolicy.retry.maxBackoffMs must be >= backoffMs"
        }
        require(retry.retryableErrors?.all { it.isNotBlank() } != false) {
            "$label: recoveryPolicy.retry.retryableErrors must contain stable non-empty codes"
        }
    }

    require(deadLetter == null || deadLetter.destination.isNotBlank()) {
        "$label: recoveryPolicy.deadLetter.destination must be a non-empty logical identifier"
    }
}

fun validateStreamRuntimeCompatibility(
    source: String,
    policy: AppStreamRecoveryPolicy?,
    runtime: AppStreamRuntimeCapabilities,
) {
    if (policy == null) return
    val label = source.ifBlank { "stream" }
    val retry = policy.retry
    val deadLetter = policy.deadLetter

    require(
        retry?.maxAttempts == null ||
            runtime.maxAttemptsLimit == null ||
            retry.maxAttempts <= runtime.maxAttemptsLimit,
    ) {
        "$label: recoveryPolicy.retry.maxAttempts=${retry?.maxAttempts} exceeds host limit ${runtime.maxAttemptsLimit}"
    }

    require(!(retry?.jitter == true && runtime.supportsJitter == false)) {
        "$label: recoveryPolicy.retry.jitter=true but host runtime does not support jitter"
    }

    require(deadLetter == null || runtime.deadLetters?.containsKey(deadLetter.destination) == true) {
        "$label: dead-letter destination \"${deadLetter?.destination}\" is not bound by the host app"
    }
}

fun isStreamErrorRetryable(error: Throwable, retryableErrors: List<String>?): Boolean {
    if (retryableErrors.isNullOrEmpty()) return true
    val code = extractStreamErrorCode(error)
    return code != null && retryableErrors.contains(code)
}

fun computeStreamRetryDelayMs(
    retry: AppStreamRecoveryPolicy.RetryPolicy,
    attempt: Int,
): Long {
    val base = retry.backoffMs ?: 0L
    if (base <= 0L) return 0L

    val multiplier = retry.multiplier ?: 1.0
    val exponent = maxOf(0, attempt - 1)
    var delay = base * multiplier.pow(exponent)

    if (retry.maxBackoffMs != null) {
        delay = min(delay, retry.maxBackoffMs.toDouble())
    }

    if (retry.jitter == true && delay > 0) {
        delay = Random.nextDouble(0.0, delay)
    }

    return floor(delay).toLong()
}

fun <TEvent> createStreamFailureEnvelope(
    caseName: String,
    event: StreamEvent<TEvent>,
    error: Throwable,
    attempts: Int,
    correlationId: String,
    firstAttemptAt: String,
    lastAttemptAt: String,
): StreamFailureEnvelope<StreamEvent<TEvent>> =
    StreamFailureEnvelope(
        caseName = caseName,
        surface = "stream",
        originalEvent = event,
        lastError = StreamFailureEnvelope.LastError(
            message = error.message ?: "Unknown stream failure",
            code = extractStreamErrorCode(error),
            stack = error.stackTraceToString(),
        ),
        attempts = attempts,
        firstAttemptAt = firstAttemptAt,
        lastAttemptAt = lastAttemptAt,
        correlationId = correlationId,
    )

private fun extractStreamErrorCode(error: Throwable): String? =
    when (error) {
        is app.protocol.examples.kotlin.core.shared.AppCaseError -> error.code
        else -> null
    }

private fun Double.pow(exponent: Int): Double = this.pow(exponent.toDouble())

abstract class BaseStreamCase<TInput, TOutput>(
    protected val ctx: StreamContext,
) {
    abstract suspend fun handler(event: StreamEvent<TInput>)

    open fun subscribe(): Any? = null

    open fun recoveryPolicy(): AppStreamRecoveryPolicy? = null

    open suspend fun test() {
    }

    protected open fun _repository(): Any? = null

    protected open val usesComposition: Boolean = false

    protected open suspend fun _composition(event: StreamEvent<TInput>) {
    }

    protected open suspend fun _consume(event: StreamEvent<TInput>): TInput = event.payload

    protected open val usesService: Boolean = false

    protected open suspend fun _service(input: TInput): TOutput? = null

    protected open suspend fun _publish(output: TOutput) {
    }

    protected suspend fun pipeline(event: StreamEvent<TInput>) {
        if (usesComposition) {
            _composition(event)
            return
        }

        val consumed = _consume(event)
        val transformed = if (usesService) {
            _service(consumed) ?: throw IllegalStateException("BaseStreamCase: _service returned null")
        } else {
            consumed as TOutput
        }
        _publish(transformed)
    }
}
