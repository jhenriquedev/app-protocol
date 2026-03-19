package app.protocol.examples.kotlin.apps.agent

import app.protocol.examples.kotlin.core.shared.AppMcpHttpExchange
import app.protocol.examples.kotlin.core.shared.AppMcpHttpResponse
import app.protocol.examples.kotlin.core.shared.AppMcpProtocolError
import app.protocol.examples.kotlin.core.shared.AppMcpRequestContext
import app.protocol.examples.kotlin.core.shared.AppMcpServer
import app.protocol.examples.kotlin.core.shared.BaseAppMcpHttpAdapter
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlin.random.Random

private fun httpSessionId(): String = "mcp_http_${Random.nextLong(0, Long.MAX_VALUE).toString(16)}"

private fun httpJsonRpcFailure(
    id: JsonElement?,
    code: Int,
    message: String,
    data: Any? = null,
): JsonElement =
    encodeAgentValue(
        mapOf(
            "jsonrpc" to "2.0",
            "id" to id,
            "error" to mapOf(
                "code" to code,
                "message" to message,
                "data" to data,
            ),
        ),
    )

private fun isJsonRpcMessage(value: JsonElement): Boolean =
    value is JsonObject &&
        value["jsonrpc"]?.stringValueOrNull() == "2.0" &&
        value["method"]?.stringValueOrNull() != null

private fun toJsonResponse(
    statusCode: Int,
    bodyText: String? = null,
    headers: Map<String, String> = emptyMap(),
): AppMcpHttpResponse =
    AppMcpHttpResponse(
        statusCode = statusCode,
        headers =
            mapOf("cache-control" to "no-store") +
                if (bodyText != null) {
                    mapOf("content-type" to "application/json; charset=utf-8")
                } else {
                    emptyMap()
                } + headers,
        bodyText = bodyText,
    )

class StreamableHttpAppMcpAdapter : BaseAppMcpHttpAdapter() {
    override val transport: String = "streamable-http"
    override val endpointPath: String = "/mcp"

    override suspend fun handle(
        exchange: AppMcpHttpExchange,
        server: AppMcpServer,
    ): AppMcpHttpResponse? {
        if (exchange.path != endpointPath) {
            return null
        }

        val method = exchange.method.uppercase()
        if (method == "GET" || method == "DELETE") {
            return AppMcpHttpResponse(
                statusCode = 405,
                headers = mapOf("allow" to "POST", "cache-control" to "no-store"),
            )
        }

        if (method != "POST") {
            return AppMcpHttpResponse(
                statusCode = 405,
                headers = mapOf("allow" to "GET,POST,DELETE", "cache-control" to "no-store"),
            )
        }

        val bodyText = exchange.bodyText?.trim()
        if (bodyText.isNullOrBlank()) {
            return toJsonResponse(
                400,
                agentJson.encodeToString(JsonElement.serializer(), httpJsonRpcFailure(null, -32600, "Missing JSON-RPC payload.")),
            )
        }

        val parsed =
            try {
                agentJson.parseToJsonElement(bodyText)
            } catch (error: Throwable) {
                return toJsonResponse(
                    400,
                    agentJson.encodeToString(
                        JsonElement.serializer(),
                        httpJsonRpcFailure(null, -32700, "Invalid JSON-RPC payload.", error.message),
                    ),
                )
            }

        if (parsed is JsonArray && parsed.isEmpty()) {
            return toJsonResponse(
                400,
                agentJson.encodeToString(
                    JsonElement.serializer(),
                    httpJsonRpcFailure(null, -32600, "Empty JSON-RPC batch payload is invalid."),
                ),
            )
        }

        val messages = if (parsed is JsonArray) parsed else listOf(parsed)
        val responses = mutableListOf<JsonElement>()

        for (message in messages) {
            if (!isJsonRpcMessage(message)) {
                responses += httpJsonRpcFailure(null, -32600, "Invalid JSON-RPC request shape.")
                continue
            }

            val request = message as JsonObject
            val id = request["id"]
            if (id == null) {
                continue
            }

            try {
                responses += handleRequest(request, server)
            } catch (error: AppMcpProtocolError) {
                responses += httpJsonRpcFailure(id, error.code, error.message, error.data)
            } catch (error: Throwable) {
                responses += httpJsonRpcFailure(
                    id,
                    -32603,
                    "Internal MCP server error.",
                    mapOf("message" to (error.message ?: "Unknown error")),
                )
            }
        }

        if (responses.isEmpty()) {
            return AppMcpHttpResponse(
                statusCode = 202,
                headers = mapOf("cache-control" to "no-store"),
            )
        }

        val payload = if (responses.size == 1) responses.first() else JsonArray(responses)
        return toJsonResponse(
            200,
            agentJson.encodeToString(JsonElement.serializer(), payload),
        )
    }

    private suspend fun handleRequest(
        request: JsonObject,
        server: AppMcpServer,
    ): JsonElement {
        val id = request["id"]
        val method = request["method"]?.stringValueOrNull().orEmpty()
        val params = request["params"]
        val context =
            AppMcpRequestContext(
                transport = transport,
                requestId = id?.stringValueOrNull() ?: id?.longValueOrNull(),
                sessionId = httpSessionId(),
            )

        val result: Any =
            when (method) {
                "initialize" -> {
                    val typedParams = parseInitializeParams(params as? JsonObject)
                    server.initialize(typedParams, context)
                }
                "ping" -> emptyMap<String, String>()
                "tools/list" -> mapOf("tools" to server.listTools(context))
                "resources/list" -> mapOf("resources" to server.listResources(context))
                "resources/read" -> {
                    val uri = (params as? JsonObject)?.get("uri")?.stringValueOrNull()
                        ?: throw AppMcpProtocolError(-32602, "MCP resources/read requires a string resource uri.")
                    server.readResource(uri, context)
                }
                "tools/call" -> {
                    val name = (params as? JsonObject)?.get("name")?.stringValueOrNull()
                        ?: throw AppMcpProtocolError(-32602, "MCP tools/call requires a string tool name.")
                    val arguments = (params as? JsonObject)?.get("arguments")?.toPlainValue()
                    server.callTool(name, arguments, context)
                }
                else -> throw AppMcpProtocolError(-32601, "MCP method $method is not implemented by this server.")
            }

        return encodeAgentValue(
            mapOf(
                "jsonrpc" to "2.0",
                "id" to id,
                "result" to result,
            ),
        )
    }
}
