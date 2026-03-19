package app.protocol.examples.kotlin.core.shared

import app.protocol.examples.kotlin.core.AppSchema
import app.protocol.examples.kotlin.core.Dict

data class AppMcpClientInfo(
    val name: String,
    val version: String,
)

data class AppMcpServerInfo(
    val name: String,
    val version: String,
    val protocolVersion: String,
    val instructions: String? = null,
)

data class AppMcpInitializeParams(
    val protocolVersion: String,
    val capabilities: Dict<Any?>? = null,
    val clientInfo: AppMcpClientInfo? = null,
)

data class AppMcpInitializeResult(
    val protocolVersion: String,
    val capabilities: Capabilities,
    val serverInfo: ServerInfo,
    val instructions: String? = null,
) {
    data class Capabilities(
        val tools: ToolsCapability? = null,
        val resources: ResourcesCapability? = null,
    ) {
        data class ToolsCapability(
            val listChanged: Boolean? = null,
        )

        data class ResourcesCapability(
            val listChanged: Boolean? = null,
        )
    }

    data class ServerInfo(
        val name: String,
        val version: String,
    )
}

data class AppMcpTextContent(
    val type: String = "text",
    val text: String,
)

data class AppMcpToolDescriptor(
    val name: String,
    val title: String? = null,
    val description: String? = null,
    val inputSchema: AppSchema,
    val outputSchema: AppSchema? = null,
    val annotations: Dict<Any?>? = null,
)

data class AppMcpResourceDescriptor(
    val uri: String,
    val name: String,
    val title: String? = null,
    val description: String? = null,
    val mimeType: String? = null,
    val annotations: Dict<Any?>? = null,
)

data class AppMcpTextResourceContent(
    val uri: String,
    val mimeType: String? = null,
    val text: String,
)

data class AppMcpCallResult(
    val content: List<AppMcpTextContent>,
    val structuredContent: Any? = null,
    val isError: Boolean? = null,
)

data class AppMcpReadResourceResult(
    val contents: List<AppMcpTextResourceContent>,
)

data class AppMcpRequestContext(
    val transport: String,
    val requestId: Any? = null,
    val sessionId: String? = null,
    val correlationId: String? = null,
    val clientInfo: AppMcpClientInfo? = null,
    val protocolVersion: String? = null,
)

interface AppMcpServer {
    fun serverInfo(): AppMcpServerInfo

    suspend fun initialize(
        params: AppMcpInitializeParams? = null,
        parent: AppMcpRequestContext? = null,
    ): AppMcpInitializeResult

    suspend fun listTools(parent: AppMcpRequestContext? = null): List<AppMcpToolDescriptor>

    suspend fun listResources(parent: AppMcpRequestContext? = null): List<AppMcpResourceDescriptor>

    suspend fun readResource(
        uri: String,
        parent: AppMcpRequestContext? = null,
    ): AppMcpReadResourceResult

    suspend fun callTool(
        name: String,
        args: Any?,
        parent: AppMcpRequestContext? = null,
    ): AppMcpCallResult
}

abstract class BaseAppMcpAdapter {
    abstract val transport: String
}

abstract class BaseAppMcpProcessAdapter : BaseAppMcpAdapter() {
    abstract suspend fun serve(server: AppMcpServer)
}

data class AppMcpHttpExchange(
    val method: String,
    val path: String,
    val headers: Map<String, String?>,
    val bodyText: String? = null,
)

data class AppMcpHttpResponse(
    val statusCode: Int,
    val headers: Map<String, String> = emptyMap(),
    val bodyText: String? = null,
)

abstract class BaseAppMcpHttpAdapter : BaseAppMcpAdapter() {
    abstract val endpointPath: String

    abstract suspend fun handle(
        exchange: AppMcpHttpExchange,
        server: AppMcpServer,
    ): AppMcpHttpResponse?
}

class AppMcpProtocolError(
    val code: Int,
    override val message: String,
    val data: Any? = null,
) : Exception(message)
