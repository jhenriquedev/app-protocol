package app.protocol.examples.kotlin.apps.agent

import app.protocol.examples.kotlin.core.shared.AppCaseError
import app.protocol.examples.kotlin.core.shared.AppMcpHttpExchange
import app.protocol.examples.kotlin.core.shared.AppMcpHttpResponse
import app.protocol.examples.kotlin.core.shared.AppMcpInitializeParams
import app.protocol.examples.kotlin.core.shared.AppMcpRequestContext
import app.protocol.examples.kotlin.core.shared.AppMcpServer
import app.protocol.examples.kotlin.core.shared.AppMcpServerInfo
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.call
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.request.httpMethod
import io.ktor.server.request.path
import io.ktor.server.request.receiveText
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import kotlinx.serialization.encodeToString
import java.util.UUID

private fun agentServerRequestId(): String = UUID.randomUUID().toString()

private fun mapErrorCodeToStatus(code: String?): HttpStatusCode =
    when (code) {
        "INVALID_REQUEST", "VALIDATION_FAILED" -> HttpStatusCode.BadRequest
        "NOT_FOUND" -> HttpStatusCode.NotFound
        "CONFIRMATION_REQUIRED", "EXECUTION_MODE_RESTRICTED" -> HttpStatusCode.Conflict
        else -> HttpStatusCode.InternalServerError
    }

private suspend fun ApplicationCall.respondJson(
    status: HttpStatusCode,
    payload: Any?,
) {
    respondText(
        text = agentJson.encodeToString(encodeAgentValue(payload)),
        contentType = ContentType.Application.Json,
        status = status,
    )
}

fun Application.agentModule(config: AgentConfig = AgentConfig()) {
    val agentApp = bootstrap(config)
    val mcpServer =
        object : AppMcpServer {
            override fun serverInfo(): AppMcpServerInfo = agentApp.mcpServerInfo()

            override suspend fun initialize(
                params: AppMcpInitializeParams?,
                parent: AppMcpRequestContext?,
            ) = agentApp.initializeMcp(params, parent)

            override suspend fun listTools(parent: AppMcpRequestContext?) = agentApp.listMcpTools(parent)

            override suspend fun listResources(parent: AppMcpRequestContext?) = agentApp.listMcpResources(parent)

            override suspend fun readResource(
                uri: String,
                parent: AppMcpRequestContext?,
            ) = agentApp.readMcpResource(uri, parent)

            override suspend fun callTool(
                name: String,
                args: Any?,
                parent: AppMcpRequestContext?,
            ) = agentApp.callMcpTool(name, args, parent)
        }

    routing {
        get("/health") {
            call.respondJson(
                HttpStatusCode.OK,
                mapOf(
                    "app" to "kotlin-example-agent",
                    "status" to "ready",
                ),
            )
        }

        get("/manifest") {
            call.respondJson(HttpStatusCode.OK, agentApp.manifest())
        }

        get("/catalog") {
            call.respondJson(
                HttpStatusCode.OK,
                mapOf(
                    "success" to true,
                    "data" to agentApp.catalogDocument(),
                ),
            )
        }

        post("/tools/{toolName}/execute") {
            val toolName = call.parameters["toolName"].orEmpty()
            val rawBody = call.receiveText()
            val body = rawBody.takeIf { it.isNotBlank() }?.let { agentJson.parseToJsonElement(it).toPlainValue() }
            val envelope = if (body is Map<*, *>) body else mapOf("input" to body)

            try {
                val data =
                    agentApp.executeTool(
                        toolName,
                        envelope["input"] ?: body,
                        ParentExecutionContext(
                            correlationId = agentServerRequestId(),
                            confirmed = envelope["confirmed"] == true,
                        ),
                    )
                call.respondJson(
                    HttpStatusCode.OK,
                    mapOf(
                        "success" to true,
                        "data" to data,
                    ),
                )
            } catch (error: AppCaseError) {
                call.respondJson(
                    mapErrorCodeToStatus(error.code),
                    mapOf(
                        "success" to false,
                        "error" to mapOf(
                            "code" to error.code,
                            "message" to error.message,
                            "details" to error.details,
                        ),
                    ),
                )
            }
        }

        post("/mcp") {
            val adapter =
                ((agentApp.registry._providers?.get("mcpAdapters") as? Map<String, Any?>)?.get("http") as? StreamableHttpAppMcpAdapter)
                    ?: error("HTTP MCP adapter is not registered")
            val exchange =
                AppMcpHttpExchange(
                    method = call.request.httpMethod.value,
                    path = call.request.path(),
                    headers = call.request.headers.names().associateWith { headerName -> call.request.headers[headerName] },
                    bodyText = call.receiveText(),
                )
            val response = adapter.handle(exchange, mcpServer) ?: AppMcpHttpResponse(statusCode = 404)
            call.respondText(
                text = response.bodyText.orEmpty(),
                contentType = ContentType.parse(response.headers["content-type"] ?: ContentType.Application.Json.toString()),
                status = HttpStatusCode.fromValue(response.statusCode),
            )
        }
    }
}

fun main() {
    val resolvedPort =
        (System.getenv("PORT") ?: System.getenv("AGENT_PORT"))?.toIntOrNull() ?: 3001
    val dataDirectory = System.getenv("APP_KOTLIN_DATA_DIR")
    val config =
        AgentConfig(
            port = resolvedPort,
            dataDirectory = dataDirectory,
        )
    embeddedServer(Netty, port = config.port, module = { agentModule(config) }).start(wait = false)
    Thread.currentThread().join()
}
