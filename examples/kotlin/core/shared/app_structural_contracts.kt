package app.protocol.examples.kotlin.core.shared

import app.protocol.examples.kotlin.core.Dict

data class AppError(
    val code: String,
    val message: String,
    val details: Any? = null,
)

open class AppCaseError(
    val code: String,
    override val message: String,
    val details: Any? = null,
) : Exception(message) {
    fun toAppError(): AppError =
        AppError(
            code = code,
            message = message,
            details = details,
        )
}

fun toAppCaseError(
    error: AppError?,
    fallbackMessage: String,
    fallbackCode: String = "INTERNAL",
    fallbackDetails: Any? = null,
): AppCaseError =
    if (error != null) {
        AppCaseError(
            code = error.code,
            message = error.message,
            details = error.details,
        )
    } else {
        AppCaseError(
            code = fallbackCode,
            message = fallbackMessage,
            details = fallbackDetails,
        )
    }

data class AppResult<T>(
    val success: Boolean,
    val data: T? = null,
    val error: AppError? = null,
)

data class StreamFailureEnvelope<TEvent>(
    val caseName: String,
    val surface: String,
    val originalEvent: TEvent,
    val lastError: LastError,
    val attempts: Int,
    val firstAttemptAt: String,
    val lastAttemptAt: String,
    val correlationId: String,
) {
    data class LastError(
        val message: String,
        val code: String? = null,
        val stack: String? = null,
    )
}

data class AppPaginationParams(
    val page: Int? = null,
    val limit: Int? = null,
    val cursor: String? = null,
)

data class AppPaginatedResult<T>(
    val items: List<T>,
    val total: Int? = null,
    val page: Int? = null,
    val limit: Int? = null,
    val cursor: String? = null,
    val hasMore: Boolean? = null,
)
