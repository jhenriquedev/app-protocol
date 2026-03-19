package app.protocol.examples.kotlin.core.api

import app.protocol.examples.kotlin.core.Dict
import app.protocol.examples.kotlin.core.shared.AppBaseContext
import app.protocol.examples.kotlin.core.shared.AppCache
import app.protocol.examples.kotlin.core.shared.AppCaseError
import app.protocol.examples.kotlin.core.shared.AppError
import app.protocol.examples.kotlin.core.shared.AppHttpClient
import app.protocol.examples.kotlin.core.shared.AppStorageClient

interface ApiContext : AppBaseContext {
    val httpClient: AppHttpClient?
    val db: Any?
    val auth: Any?
    val storage: AppStorageClient?
    val cache: AppCache?
    val cases: Dict<Any?>?
    val packages: Dict<Any?>?
    val extra: Dict<Any?>?
}

data class ApiResponse<T>(
    val success: Boolean,
    val data: T? = null,
    val error: AppError? = null,
    val statusCode: Int? = null,
)

data class RouteBinding(
    val method: String,
    val path: String,
    val handler: (suspend (RouteRequest) -> Any?)? = null,
)

data class RouteRequest(
    val body: Any? = null,
    val method: String,
    val path: String,
    val params: Map<String, String> = emptyMap(),
    val request: Any? = null,
)

abstract class BaseApiCase<TInput, TOutput>(
    protected val ctx: ApiContext,
) {
    abstract suspend fun handler(input: TInput): ApiResponse<TOutput>

    open fun router(): RouteBinding? = null

    open suspend fun test() {
    }

    protected open suspend fun _validate(input: TInput) {
    }

    protected open suspend fun _authorize(input: TInput) {
    }

    protected open fun _repository(): Any? = null

    protected open val usesService: Boolean = false

    protected open val usesComposition: Boolean = false

    protected open suspend fun _service(input: TInput): TOutput? = null

    protected open suspend fun _composition(input: TInput): TOutput? = null

    protected suspend fun execute(input: TInput): ApiResponse<TOutput> =
        try {
            _validate(input)
            _authorize(input)

            if (!usesService && !usesComposition) {
                throw AppCaseError(
                    code = "INTERNAL",
                    message = "BaseApiCase: at least one of _service or _composition must be implemented",
                )
            }

            val result = when {
                usesComposition -> _composition(input)
                usesService -> _service(input)
                else -> null
            }

            if (result == null) {
                throw AppCaseError(
                    code = "INTERNAL",
                    message = "BaseApiCase: execution center returned null",
                )
            }

            ApiResponse(
                success = true,
                data = result,
            )
        } catch (error: AppCaseError) {
            ApiResponse(
                success = false,
                error = error.toAppError(),
            )
        }
}
