@file:Suppress("UNCHECKED_CAST")

package app.protocol.examples.kotlin.apps.backend

import app.protocol.examples.kotlin.cases.tasks.task_create.TaskCreateOutput
import app.protocol.examples.kotlin.cases.tasks.task_list.TaskListOutput
import app.protocol.examples.kotlin.cases.tasks.task_move.TaskMoveOutput
import app.protocol.examples.kotlin.core.api.ApiContext
import app.protocol.examples.kotlin.core.api.ApiResponse
import app.protocol.examples.kotlin.core.api.BaseApiCase
import app.protocol.examples.kotlin.core.api.RouteBinding
import app.protocol.examples.kotlin.core.api.RouteRequest
import app.protocol.examples.kotlin.core.shared.AppCaseError
import app.protocol.examples.kotlin.core.shared.AppError
import app.protocol.examples.kotlin.core.shared.AppLogger
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.engine.EmbeddedServer
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.netty.NettyApplicationEngine
import io.ktor.server.request.httpMethod
import io.ktor.server.request.path
import io.ktor.server.request.receiveText
import io.ktor.server.response.respondText
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import java.util.UUID
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

private val json =
    Json {
        prettyPrint = true
        encodeDefaults = true
        ignoreUnknownKeys = false
    }

private val logger =
    object : AppLogger {
        override fun debug(message: String, meta: Map<String, Any?>?) {
            println("[backend] DEBUG $message $meta")
        }

        override fun info(message: String, meta: Map<String, Any?>?) {
            println("[backend] $message $meta")
        }

        override fun warn(message: String, meta: Map<String, Any?>?) {
            println("[backend] WARN $message $meta")
        }

        override fun error(message: String, meta: Map<String, Any?>?) {
            System.err.println("[backend] ERROR $message $meta")
        }
    }

data class ParentApiContext(
    val correlationId: String? = null,
    val tenantId: String? = null,
    val userId: String? = null,
    val config: Map<String, Any?>? = null,
    val extra: Map<String, Any?>? = null,
)

private data class MountedRoute(
    val method: String,
    val path: String,
    val factory: (ApiContext) -> Any,
)

private fun generateId(): String = UUID.randomUUID().toString()

private fun mapErrorCodeToStatus(code: String?): HttpStatusCode =
    when (code) {
        "INVALID_REQUEST", "VALIDATION_FAILED" -> HttpStatusCode.BadRequest
        "UNAUTHORIZED" -> HttpStatusCode.Unauthorized
        "FORBIDDEN" -> HttpStatusCode.Forbidden
        "NOT_FOUND" -> HttpStatusCode.NotFound
        "CONFLICT" -> HttpStatusCode.Conflict
        else -> HttpStatusCode.InternalServerError
    }

private fun ktorPath(path: String): String =
    path.split("/")
        .filter { it.isNotBlank() }
        .joinToString(prefix = "/", separator = "/") { segment ->
            if (segment.startsWith(":")) {
                "{${segment.removePrefix(":")}}"
            } else {
                segment
            }
        }

private fun encodeValue(value: Any?): JsonElement =
    when (value) {
        null -> JsonNull
        is JsonElement -> value
        is String -> JsonPrimitive(value)
        is Number -> JsonPrimitive(value)
        is Boolean -> JsonPrimitive(value)
        is Map<*, *> ->
            JsonObject(
                value.entries.associate { (key, item) ->
                    key.toString() to encodeValue(item)
                },
            )

        is Iterable<*> -> JsonArray(value.map(::encodeValue))
        is TaskCreateOutput -> json.encodeToJsonElement(TaskCreateOutput.serializer(), value)
        is TaskListOutput -> json.encodeToJsonElement(TaskListOutput.serializer(), value)
        is TaskMoveOutput -> json.encodeToJsonElement(TaskMoveOutput.serializer(), value)
        is AppError -> encodeError(value)
        else -> JsonPrimitive(value.toString())
    }

private fun encodeError(error: AppError): JsonElement =
    buildJsonObject {
        put("code", JsonPrimitive(error.code))
        put("message", JsonPrimitive(error.message))
        if (error.details != null) {
            put("details", encodeValue(error.details))
        }
    }

private fun encodeApiResponse(response: ApiResponse<*>): JsonElement =
    buildJsonObject {
        put("success", JsonPrimitive(response.success))
        if (response.data != null) {
            put("data", encodeValue(response.data))
        }
        if (response.error != null) {
            put("error", encodeError(response.error))
        }
    }

private suspend fun ApplicationCall.respondJson(status: HttpStatusCode, payload: JsonElement) {
    respondText(
        text = json.encodeToString(JsonElement.serializer(), payload),
        contentType = ContentType.Application.Json,
        status = status,
    )
}

private fun JsonElement.toPlainValue(): Any? =
    when (this) {
        is JsonObject -> entries.associate { (key, value) -> key to value.toPlainValue() }
        is JsonArray -> map { it.toPlainValue() }
        is JsonNull -> null
        is JsonPrimitive ->
            when {
                isString -> content
                content == "true" || content == "false" -> content.toBoolean()
                content.toLongOrNull() != null -> content.toLong()
                content.toDoubleOrNull() != null -> content.toDouble()
                else -> content
            }
    }

fun bootstrap(config: BackendConfig = BackendConfig()): BackendApp {
    val registry = createRegistry(config)

    fun materializeCases(context: ApiContext): Map<String, Map<String, Map<String, Any?>>> =
        registry._cases.mapValues { (_, domainCases) ->
            domainCases.mapValues { (_, surfaces) ->
                buildMap {
                    surfaces.api?.let { factory ->
                        val instance = factory(context) as BaseApiCase<Any?, Any?>
                        val handler: suspend (Any?) -> ApiResponse<Any?> = { input -> instance.handler(input) }
                        put(
                            "api",
                            mapOf(
                                "handler" to handler,
                            ),
                        )
                    }
                }
            }
        }

    fun createApiContext(parent: ParentApiContext? = null): ApiContext {
        var contextCases: Map<String, Map<String, Map<String, Any?>>> = emptyMap()
        val context =
            object : ApiContext {
                override val correlationId: String = parent?.correlationId ?: generateId()
                override val executionId: String = generateId()
                override val tenantId: String? = parent?.tenantId
                override val userId: String? = parent?.userId
                override val logger: AppLogger = app.protocol.examples.kotlin.apps.backend.logger
                override val config: Map<String, Any?>? = parent?.config
                override val httpClient = null
                override val db: Any? = null
                override val auth: Any? = null
                override val storage = null
                override val cache = null
                override val packages: Map<String, Any?>? = registry._packages
                override val extra: Map<String, Any?>? =
                    mapOf(
                        "providers" to (registry._providers ?: emptyMap()),
                    ) + (parent?.extra ?: emptyMap())
                override val cases: Map<String, Any?>?
                    get() = contextCases
            }

        contextCases = materializeCases(context)
        return context
    }

    val mountedRoutes =
        registry._cases.values.flatMap { domainCases ->
            domainCases.values.mapNotNull { surfaces ->
                val factory = surfaces.api ?: return@mapNotNull null
                val bootInstance = factory(createApiContext(ParentApiContext(correlationId = "boot"))) as BaseApiCase<Any?, Any?>
                val route = bootInstance.router() ?: return@mapNotNull null
                MountedRoute(
                    method = route.method.uppercase(),
                    path = route.path,
                    factory = factory,
                )
            }
        }

    suspend fun readRequestBody(call: ApplicationCall): Any? {
        val content = call.receiveText()
        if (content.isBlank()) {
            return null
        }
        return json.parseToJsonElement(content).toPlainValue()
    }

    suspend fun handleMountedRoute(call: ApplicationCall, mountedRoute: MountedRoute) {
        val method = call.request.httpMethod.value.uppercase()
        val path = call.request.path()
        val body =
            try {
                readRequestBody(call)
            } catch (error: Throwable) {
                call.respondJson(
                    HttpStatusCode.BadRequest,
                    buildJsonObject {
                        put("success", JsonPrimitive(false))
                        put(
                            "error",
                            buildJsonObject {
                                put("code", JsonPrimitive("INVALID_REQUEST"))
                                put("message", JsonPrimitive(error.message ?: "Invalid request payload"))
                            },
                        )
                    },
                )
                return
            }

        try {
            val runtimeInstance = mountedRoute.factory(createApiContext()) as BaseApiCase<Any?, Any?>
            val route = runtimeInstance.router()
            val response =
                if (route?.handler != null) {
                    route.handler.invoke(
                        RouteRequest(
                            body = body,
                            method = method,
                            path = path,
                            params = call.parameters.entries().associate { it.key to it.value.first() },
                            request = call,
                        ),
                    )
                } else {
                    runtimeInstance.handler(body)
                }

            when (response) {
                is ApiResponse<*> -> {
                    val status =
                        response.statusCode?.let(HttpStatusCode::fromValue)
                            ?: if (response.success) HttpStatusCode.OK else mapErrorCodeToStatus(response.error?.code)
                    call.respondJson(status, encodeApiResponse(response))
                }

                else -> call.respondJson(HttpStatusCode.OK, encodeValue(response))
            }
        } catch (error: AppCaseError) {
            call.respondJson(
                mapErrorCodeToStatus(error.code),
                buildJsonObject {
                    put("success", JsonPrimitive(false))
                    put("error", encodeError(error.toAppError()))
                },
            )
        } catch (error: Throwable) {
            logger.error(
                "Unhandled backend route error",
                mapOf(
                    "error" to (error.message ?: "unknown"),
                    "method" to method,
                    "path" to path,
                ),
            )
            call.respondJson(
                HttpStatusCode.InternalServerError,
                buildJsonObject {
                    put("success", JsonPrimitive(false))
                    put(
                        "error",
                        buildJsonObject {
                            put("code", JsonPrimitive("INTERNAL"))
                            put("message", JsonPrimitive("Internal backend scaffold error."))
                        },
                    )
                },
            )
        }
    }

    fun Application.backendModule() {
        routing {
            get("/health") {
                call.respondJson(
                    HttpStatusCode.OK,
                    buildJsonObject {
                        put("ok", JsonPrimitive(true))
                        put("app", JsonPrimitive("kotlin-example-backend"))
                        put("status", JsonPrimitive("ready"))
                    },
                )
            }

            get("/manifest") {
                call.respondJson(
                    HttpStatusCode.OK,
                    buildJsonObject {
                        put("app", JsonPrimitive("kotlin-example-backend"))
                        put("port", JsonPrimitive((registry._providers?.get("port") as? Int) ?: config.port))
                        put(
                            "registeredDomains",
                            JsonArray(registry._cases.keys.map(::JsonPrimitive)),
                        )
                        put(
                            "packages",
                            JsonArray((registry._packages?.keys ?: emptySet()).map(::JsonPrimitive)),
                        )
                        put(
                            "routes",
                            JsonArray(mountedRoutes.map { JsonPrimitive("${it.method} ${it.path}") }),
                        )
                    },
                )
            }

            mountedRoutes.forEach { mountedRoute ->
                when (mountedRoute.method) {
                    "GET" -> get(ktorPath(mountedRoute.path)) { handleMountedRoute(call, mountedRoute) }
                    "POST" -> post(ktorPath(mountedRoute.path)) { handleMountedRoute(call, mountedRoute) }
                    "PATCH" -> patch(ktorPath(mountedRoute.path)) { handleMountedRoute(call, mountedRoute) }
                    "DELETE" -> delete(ktorPath(mountedRoute.path)) { handleMountedRoute(call, mountedRoute) }
                }
            }

            suspend fun respondNotFound(call: ApplicationCall) {
                call.respondJson(
                    HttpStatusCode.NotFound,
                    buildJsonObject {
                        put("success", JsonPrimitive(false))
                        put(
                            "error",
                            buildJsonObject {
                                put("code", JsonPrimitive("NOT_FOUND"))
                                put("message", JsonPrimitive("Route ${call.request.path()} was not found"))
                            },
                        )
                    },
                )
            }

            get("{...}") { respondNotFound(call) }
            post("{...}") { respondNotFound(call) }
            patch("{...}") { respondNotFound(call) }
            delete("{...}") { respondNotFound(call) }
        }
    }

    fun startBackend(): EmbeddedServer<NettyApplicationEngine, NettyApplicationEngine.Configuration> {
        val engine =
            embeddedServer(
                factory = Netty,
                port = (registry._providers?.get("port") as? Int) ?: config.port,
                host = "127.0.0.1",
                module = Application::backendModule,
            )
        engine.start(wait = false)
        logger.info(
                "Backend scaffold started",
                mapOf(
                    "port" to ((registry._providers?.get("port") as? Int) ?: config.port),
                    "packages" to registry._packages?.keys?.toList(),
                ),
            )
        return engine
    }

    return BackendApp(
        registry = registry,
        createApiContext = ::createApiContext,
        startBackend = ::startBackend,
    )
}

data class BackendApp(
    val registry: BackendRegistry,
    val createApiContext: (ParentApiContext?) -> ApiContext,
    val startBackend: () -> EmbeddedServer<NettyApplicationEngine, NettyApplicationEngine.Configuration>,
)
