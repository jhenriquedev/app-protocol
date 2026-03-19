package app.protocol.examples.kotlin.apps.agent

import app.protocol.examples.kotlin.cases.tasks.task_create.Task as TaskCreateTask
import app.protocol.examples.kotlin.cases.tasks.task_create.TaskCreateInput
import app.protocol.examples.kotlin.cases.tasks.task_create.TaskCreateOutput
import app.protocol.examples.kotlin.cases.tasks.task_list.Task as TaskListTask
import app.protocol.examples.kotlin.cases.tasks.task_list.TaskListInput
import app.protocol.examples.kotlin.cases.tasks.task_list.TaskListOutput
import app.protocol.examples.kotlin.cases.tasks.task_move.Task as TaskMoveTask
import app.protocol.examples.kotlin.cases.tasks.task_move.TaskMoveInput
import app.protocol.examples.kotlin.cases.tasks.task_move.TaskMoveOutput
import app.protocol.examples.kotlin.core.AppSchema
import app.protocol.examples.kotlin.core.shared.AppMcpClientInfo
import app.protocol.examples.kotlin.core.shared.AppMcpCallResult
import app.protocol.examples.kotlin.core.shared.AppMcpInitializeParams
import app.protocol.examples.kotlin.core.shared.AppMcpInitializeResult
import app.protocol.examples.kotlin.core.shared.AppMcpReadResourceResult
import app.protocol.examples.kotlin.core.shared.AppMcpResourceDescriptor
import app.protocol.examples.kotlin.core.shared.AppMcpServerInfo
import app.protocol.examples.kotlin.core.shared.AppMcpTextContent
import app.protocol.examples.kotlin.core.shared.AppMcpTextResourceContent
import app.protocol.examples.kotlin.core.shared.AppMcpToolDescriptor
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

internal val agentJson =
    Json {
        prettyPrint = true
        encodeDefaults = true
        ignoreUnknownKeys = false
    }

internal fun encodeAgentValue(value: Any?): JsonElement =
    when (value) {
        null -> JsonNull
        is JsonElement -> value
        is String -> JsonPrimitive(value)
        is Number -> JsonPrimitive(value)
        is Boolean -> JsonPrimitive(value)
        is AgentManifest ->
            encodeAgentValue(
                mapOf(
                    "app" to value.app,
                    "port" to value.port,
                    "registeredDomains" to value.registeredDomains,
                    "packages" to value.packages,
                    "tools" to value.tools,
                    "mcpEnabledTools" to value.mcpEnabledTools,
                    "transports" to value.transports,
                    "systemPrompt" to value.systemPrompt,
                ),
            )
        is AgentCatalogDocument ->
            encodeAgentValue(
                mapOf(
                    "systemPrompt" to value.systemPrompt,
                    "tools" to value.tools,
                    "resources" to value.resources,
                ),
            )
        is Map<*, *> ->
            JsonObject(
                value.entries.associate { (key, item) ->
                    key.toString() to encodeAgentValue(item)
                },
            )
        is Iterable<*> -> JsonArray(value.map(::encodeAgentValue))
        is Array<*> -> JsonArray(value.map(::encodeAgentValue))
        is AppSchema -> agentJson.encodeToJsonElement(AppSchema.serializer(), value)
        is TaskCreateTask -> agentJson.encodeToJsonElement(TaskCreateTask.serializer(), value)
        is TaskCreateInput -> agentJson.encodeToJsonElement(TaskCreateInput.serializer(), value)
        is TaskCreateOutput -> agentJson.encodeToJsonElement(TaskCreateOutput.serializer(), value)
        is TaskListTask -> agentJson.encodeToJsonElement(TaskListTask.serializer(), value)
        is TaskListInput -> agentJson.encodeToJsonElement(TaskListInput.serializer(), value)
        is TaskListOutput -> agentJson.encodeToJsonElement(TaskListOutput.serializer(), value)
        is TaskMoveTask -> agentJson.encodeToJsonElement(TaskMoveTask.serializer(), value)
        is TaskMoveInput -> agentJson.encodeToJsonElement(TaskMoveInput.serializer(), value)
        is TaskMoveOutput -> agentJson.encodeToJsonElement(TaskMoveOutput.serializer(), value)
        is AppMcpServerInfo ->
            encodeAgentValue(
                mapOf(
                    "name" to value.name,
                    "version" to value.version,
                    "protocolVersion" to value.protocolVersion,
                    "instructions" to value.instructions,
                ),
            )
        is AppMcpInitializeResult ->
            encodeAgentValue(
                mapOf(
                    "protocolVersion" to value.protocolVersion,
                    "capabilities" to mapOf(
                        "tools" to value.capabilities.tools?.let { mapOf("listChanged" to it.listChanged) },
                        "resources" to value.capabilities.resources?.let { mapOf("listChanged" to it.listChanged) },
                    ),
                    "serverInfo" to mapOf(
                        "name" to value.serverInfo.name,
                        "version" to value.serverInfo.version,
                    ),
                    "instructions" to value.instructions,
                ),
            )
        is AppMcpToolDescriptor ->
            encodeAgentValue(
                mapOf(
                    "name" to value.name,
                    "title" to value.title,
                    "description" to value.description,
                    "inputSchema" to value.inputSchema,
                    "outputSchema" to value.outputSchema,
                    "annotations" to value.annotations,
                ),
            )
        is AppMcpResourceDescriptor ->
            encodeAgentValue(
                mapOf(
                    "uri" to value.uri,
                    "name" to value.name,
                    "title" to value.title,
                    "description" to value.description,
                    "mimeType" to value.mimeType,
                    "annotations" to value.annotations,
                ),
            )
        is AppMcpTextContent ->
            encodeAgentValue(
                mapOf(
                    "type" to value.type,
                    "text" to value.text,
                ),
            )
        is AppMcpTextResourceContent ->
            encodeAgentValue(
                mapOf(
                    "uri" to value.uri,
                    "mimeType" to value.mimeType,
                    "text" to value.text,
                ),
            )
        is AppMcpCallResult ->
            encodeAgentValue(
                mapOf(
                    "content" to value.content,
                    "structuredContent" to value.structuredContent,
                    "isError" to value.isError,
                ),
            )
        is AppMcpReadResourceResult ->
            encodeAgentValue(
                mapOf(
                    "contents" to value.contents,
                ),
            )
        else -> JsonPrimitive(value.toString())
    }

internal fun JsonElement.toPlainValue(): Any? =
    when (this) {
        is JsonObject -> entries.associate { (key, item) -> key to item.toPlainValue() }
        is JsonArray -> map { it.toPlainValue() }
        is JsonNull -> null
        is JsonPrimitive ->
            when {
                content == "true" || content == "false" -> content.toBoolean()
                content.toLongOrNull() != null -> content.toLong()
                content.toDoubleOrNull() != null -> content.toDouble()
                else -> content
            }
    }

internal fun JsonElement.stringValueOrNull(): String? = (this as? JsonPrimitive)?.content

internal fun JsonElement.longValueOrNull(): Long? = (this as? JsonPrimitive)?.content?.toLongOrNull()

internal fun parseInitializeParams(value: JsonObject?): AppMcpInitializeParams? {
    if (value == null) {
        return null
    }

    val protocolVersion = value["protocolVersion"]?.stringValueOrNull() ?: return null
    val clientInfoObject = value["clientInfo"] as? JsonObject
    val clientInfo =
        clientInfoObject?.let { info ->
            val name = info["name"]?.stringValueOrNull()
            val version = info["version"]?.stringValueOrNull()
            if (name != null && version != null) {
                AppMcpClientInfo(name = name, version = version)
            } else {
                null
            }
        }

    return AppMcpInitializeParams(
        protocolVersion = protocolVersion,
        capabilities = (value["capabilities"] as? JsonObject)?.toPlainValue() as? Map<String, Any?>,
        clientInfo = clientInfo,
    )
}
