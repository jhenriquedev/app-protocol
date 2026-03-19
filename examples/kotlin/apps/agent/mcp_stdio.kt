package app.protocol.examples.kotlin.apps.agent

import app.protocol.examples.kotlin.core.shared.AppMcpClientInfo
import app.protocol.examples.kotlin.core.shared.AppMcpProtocolError
import app.protocol.examples.kotlin.core.shared.AppMcpRequestContext
import app.protocol.examples.kotlin.core.shared.AppMcpServer
import app.protocol.examples.kotlin.core.shared.BaseAppMcpProcessAdapter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlin.random.Random

private enum class StdioSessionPhase {
    AWAITING_INITIALIZE,
    AWAITING_INITIALIZED_NOTIFICATION,
    READY,
}

private fun stdioSessionId(): String = "mcp_stdio_${Random.nextLong(0, Long.MAX_VALUE).toString(16)}"

private val stdioJson =
    Json {
        prettyPrint = false
        encodeDefaults = true
        ignoreUnknownKeys = false
    }

private fun stdioJsonRpcFailure(
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

class StdioAppMcpAdapter : BaseAppMcpProcessAdapter() {
    override val transport: String = "stdio"

    override suspend fun serve(server: AppMcpServer) {
        var phase = StdioSessionPhase.AWAITING_INITIALIZE
        var protocolVersion: String? = null
        var clientInfo = AppMcpClientInfo(name = "unknown-client", version = "0.0.0")
        val sessionId = stdioSessionId()

        while (true) {
            val line =
                withContext(Dispatchers.IO) {
                    readlnOrNull()
                } ?: break

            val trimmed = line.trim()
            if (trimmed.isBlank()) {
                continue
            }

            val message =
                try {
                    agentJson.parseToJsonElement(trimmed)
                } catch (error: Throwable) {
                    writeMessage(stdioJsonRpcFailure(null, -32700, "Invalid JSON-RPC payload.", error.message))
                    continue
                }

            if (message !is JsonObject || message["jsonrpc"]?.stringValueOrNull() != "2.0") {
                writeMessage(stdioJsonRpcFailure(null, -32600, "Invalid JSON-RPC request shape."))
                continue
            }

            val method = message["method"]?.stringValueOrNull() ?: run {
                writeMessage(stdioJsonRpcFailure(message["id"], -32600, "Missing JSON-RPC method."))
                continue
            }
            val id = message["id"]
            val params = message["params"]
            val context =
                AppMcpRequestContext(
                    transport = transport,
                    requestId = id?.stringValueOrNull() ?: id?.longValueOrNull(),
                    sessionId = sessionId,
                    clientInfo = clientInfo,
                    protocolVersion = protocolVersion,
                )

            if (id == null) {
                if (method == "notifications/initialized" && phase == StdioSessionPhase.AWAITING_INITIALIZED_NOTIFICATION) {
                    phase = StdioSessionPhase.READY
                }
                continue
            }

            try {
                val result: Any =
                    when (method) {
                        "initialize" -> {
                            if (phase != StdioSessionPhase.AWAITING_INITIALIZE) {
                                throw AppMcpProtocolError(-32600, "MCP initialize may only run once per stdio session.")
                            }
                            val typedParams = parseInitializeParams(params as? JsonObject)
                            val initializeResult = server.initialize(typedParams, context)
                            protocolVersion = initializeResult.protocolVersion
                            clientInfo = typedParams?.clientInfo ?: clientInfo
                            phase = StdioSessionPhase.AWAITING_INITIALIZED_NOTIFICATION
                            initializeResult
                        }
                        "ping" -> {
                            ensureReady(phase)
                            emptyMap<String, String>()
                        }
                        "tools/list" -> {
                            ensureReady(phase)
                            mapOf("tools" to server.listTools(context))
                        }
                        "resources/list" -> {
                            ensureReady(phase)
                            mapOf("resources" to server.listResources(context))
                        }
                        "resources/read" -> {
                            ensureReady(phase)
                            val uri = (params as? JsonObject)?.get("uri")?.stringValueOrNull()
                                ?: throw AppMcpProtocolError(-32602, "MCP resources/read requires a string resource uri.")
                            server.readResource(uri, context)
                        }
                        "tools/call" -> {
                            ensureReady(phase)
                            val name = (params as? JsonObject)?.get("name")?.stringValueOrNull()
                                ?: throw AppMcpProtocolError(-32602, "MCP tools/call requires a string tool name.")
                            val arguments = (params as? JsonObject)?.get("arguments")?.toPlainValue()
                            server.callTool(name, arguments, context)
                        }
                        else -> throw AppMcpProtocolError(-32601, "MCP method $method is not implemented by this server.")
                    }

                writeMessage(
                    buildJsonObject {
                        put("jsonrpc", JsonPrimitive("2.0"))
                        put("id", id)
                        put("result", encodeAgentValue(result))
                    },
                )
            } catch (error: AppMcpProtocolError) {
                writeMessage(stdioJsonRpcFailure(id, error.code, error.message, error.data))
            } catch (error: Throwable) {
                writeMessage(
                    stdioJsonRpcFailure(
                        id,
                        -32603,
                        "Internal MCP server error.",
                        mapOf("message" to (error.message ?: "Unknown error")),
                    ),
                )
            }
        }
    }

    private fun ensureReady(phase: StdioSessionPhase) {
        if (phase != StdioSessionPhase.READY) {
            throw AppMcpProtocolError(-32002, "MCP session is not ready; complete initialization first.")
        }
    }

    private suspend fun writeMessage(message: JsonElement) {
        withContext(Dispatchers.IO) {
            println(stdioJson.encodeToString(JsonElement.serializer(), message))
        }
    }
}
