@file:Suppress("UNCHECKED_CAST")

package app.protocol.examples.kotlin.apps.agent

import app.protocol.examples.kotlin.cases.tasks.task_create.TaskCreateInput
import app.protocol.examples.kotlin.cases.tasks.task_list.TaskListInput
import app.protocol.examples.kotlin.cases.tasks.task_move.TaskMoveInput
import app.protocol.examples.kotlin.core.agentic.AgenticContext
import app.protocol.examples.kotlin.core.api.ApiContext
import app.protocol.examples.kotlin.core.api.ApiResponse
import app.protocol.examples.kotlin.core.api.BaseApiCase
import app.protocol.examples.kotlin.core.shared.AgenticCatalogEntry
import app.protocol.examples.kotlin.core.shared.AppCaseError
import app.protocol.examples.kotlin.core.shared.AppLogger
import app.protocol.examples.kotlin.core.shared.AppMcpCallResult
import app.protocol.examples.kotlin.core.shared.AppMcpClientInfo
import app.protocol.examples.kotlin.core.shared.AppMcpInitializeParams
import app.protocol.examples.kotlin.core.shared.AppMcpInitializeResult
import app.protocol.examples.kotlin.core.shared.AppMcpProtocolError
import app.protocol.examples.kotlin.core.shared.AppMcpReadResourceResult
import app.protocol.examples.kotlin.core.shared.AppMcpRequestContext
import app.protocol.examples.kotlin.core.shared.AppMcpResourceDescriptor
import app.protocol.examples.kotlin.core.shared.AppMcpServer
import app.protocol.examples.kotlin.core.shared.AppMcpServerInfo
import app.protocol.examples.kotlin.core.shared.AppMcpTextContent
import app.protocol.examples.kotlin.core.shared.AppMcpTextResourceContent
import app.protocol.examples.kotlin.core.shared.AppMcpToolDescriptor
import kotlinx.serialization.json.JsonElement
import java.util.UUID

private const val APP_VERSION = "1.1.0"
private const val MCP_PROTOCOL_VERSION = "2025-11-25"
private val MCP_SUPPORTED_PROTOCOL_VERSIONS = setOf(MCP_PROTOCOL_VERSION, "2025-06-18")

private val logger =
    object : AppLogger {
        override fun debug(message: String, meta: Map<String, Any?>?) {
            System.err.println("[agent] DEBUG $message $meta")
        }

        override fun info(message: String, meta: Map<String, Any?>?) {
            System.err.println("[agent] $message $meta")
        }

        override fun warn(message: String, meta: Map<String, Any?>?) {
            System.err.println("[agent] WARN $message $meta")
        }

        override fun error(message: String, meta: Map<String, Any?>?) {
            System.err.println("[agent] ERROR $message $meta")
        }
    }

data class ParentExecutionContext(
    val correlationId: String? = null,
    val tenantId: String? = null,
    val userId: String? = null,
    val config: Map<String, Any?>? = null,
    val confirmed: Boolean? = null,
    val mcp: AppMcpRequestContext? = null,
)

data class ExecuteEnvelope(
    val input: Any? = null,
    val confirmed: Boolean = false,
)

data class AgentManifest(
    val app: String,
    val port: Any?,
    val registeredDomains: List<String>,
    val packages: List<String>,
    val tools: List<String>,
    val mcpEnabledTools: List<String>,
    val transports: Map<String, Any?>,
    val systemPrompt: String,
)

data class AgentCatalogDocument(
    val systemPrompt: String,
    val tools: List<Map<String, Any?>>,
    val resources: List<AppMcpResourceDescriptor>,
)

data class AgentRuntimeValidation(
    val tools: Int,
    val mcpEnabled: Int,
    val requireConfirmation: Int,
)

data class AgentApp(
    val config: AgentConfig,
    val registry: AgentRegistry,
    val createAgenticContext: (ParentExecutionContext?) -> AgenticContext,
    val buildAgentCatalog: (ParentExecutionContext?) -> List<AgenticCatalogEntry<*, *>>,
    val buildSystemPrompt: (ParentExecutionContext?) -> String,
    val resolveTool: (String, ParentExecutionContext?) -> AgenticCatalogEntry<*, *>?,
    val executeTool: suspend (String, Any?, ParentExecutionContext?) -> Any,
    val initializeMcp: suspend (AppMcpInitializeParams?, AppMcpRequestContext?) -> AppMcpInitializeResult,
    val listMcpTools: suspend (AppMcpRequestContext?) -> List<AppMcpToolDescriptor>,
    val listMcpResources: suspend (AppMcpRequestContext?) -> List<AppMcpResourceDescriptor>,
    val readMcpResource: suspend (String, AppMcpRequestContext?) -> AppMcpReadResourceResult,
    val callMcpTool: suspend (String, Any?, AppMcpRequestContext?) -> AppMcpCallResult,
    val publishMcp: suspend () -> Unit,
    val validateAgenticRuntime: suspend () -> AgentRuntimeValidation,
    val mcpServerInfo: () -> AppMcpServerInfo,
    val manifest: () -> AgentManifest,
    val catalogDocument: () -> AgentCatalogDocument,
)

private fun generateId(): String = UUID.randomUUID().toString()

private fun humanizeIdentifier(value: String): String =
    value.split('_', '-')
        .filter { it.isNotBlank() }
        .joinToString(" ") { part ->
            part.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
        }

private fun normalizeTextItems(values: List<String>?): List<String> =
    values.orEmpty().map { it.trim() }.filter { it.isNotBlank() }.distinct()

private fun joinSentence(label: String, values: List<String>?): String? {
    val normalized = normalizeTextItems(values)
    return if (normalized.isEmpty()) null else "$label: ${normalized.joinToString("; ")}."
}

private fun buildSystemPromptResourceUri(): String = "app://agent/system/prompt"

private fun buildToolSemanticResourceUri(entry: AgenticCatalogEntry<*, *>): String =
    "app://agent/tools/${entry.publishedName}/semantic"

private fun mapErrorCodeToStatus(code: String?): Int =
    when (code) {
        "INVALID_REQUEST", "VALIDATION_FAILED" -> 400
        "NOT_FOUND" -> 404
        "CONFIRMATION_REQUIRED", "EXECUTION_MODE_RESTRICTED" -> 409
        else -> 500
    }

private fun toMcpTextContent(text: String): AppMcpTextContent =
    AppMcpTextContent(text = text)

private fun toMcpTextResourceContent(
    uri: String,
    text: String,
    mimeType: String? = null,
): AppMcpTextResourceContent =
    AppMcpTextResourceContent(
        uri = uri,
        text = text,
        mimeType = mimeType,
    )

private fun toExecutionEnvelope(body: Any?): ExecuteEnvelope {
    val record = body as? Map<*, *> ?: return ExecuteEnvelope(input = body, confirmed = false)
    return when {
        record.containsKey("confirmed") -> ExecuteEnvelope(
            input = if (record.containsKey("input")) record["input"] else record.filterKeys { it != "confirmed" },
            confirmed = record["confirmed"] == true,
        )
        record.containsKey("input") -> ExecuteEnvelope(
            input = record["input"],
            confirmed = false,
        )
        else -> ExecuteEnvelope(input = body, confirmed = false)
    }
}

private fun stripDefinitionForProjection(entry: AgenticCatalogEntry<*, *>): Map<String, Any?> =
    mapOf(
        "discovery" to entry.definition.discovery,
        "context" to entry.definition.context,
        "prompt" to entry.definition.prompt,
        "mcp" to entry.definition.mcp,
        "rag" to entry.definition.rag,
        "policy" to entry.definition.policy,
        "examples" to entry.definition.examples?.map { example ->
            mapOf(
                "name" to example.name,
                "description" to example.description,
                "input" to example.input,
                "output" to example.output,
                "notes" to example.notes,
            )
        },
        "tool" to mapOf(
            "name" to entry.definition.tool.name,
            "description" to entry.definition.tool.description,
            "inputSchema" to entry.definition.tool.inputSchema,
            "outputSchema" to entry.definition.tool.outputSchema,
            "isMutating" to (entry.definition.tool.isMutating ?: false),
            "requiresConfirmation" to (entry.definition.tool.requiresConfirmation ?: false),
        ),
    )

private fun buildToolSemanticSummary(entry: AgenticCatalogEntry<*, *>): String {
    val discovery = entry.definition.discovery
    val context = entry.definition.context
    val prompt = entry.definition.prompt
    val policy = entry.definition.policy
    return listOfNotNull(
        prompt.purpose.trim(),
        joinSentence("Use when", (prompt.whenToUse ?: emptyList()) + (discovery.intents ?: emptyList())),
        joinSentence("Do not use when", prompt.whenNotToUse),
        joinSentence("Preconditions", context.preconditions),
        joinSentence("Constraints", (context.constraints ?: emptyList()) + (prompt.constraints ?: emptyList()) + (policy?.limits ?: emptyList())),
        prompt.expectedOutcome?.let { "Expected outcome: ${it.trim()}." },
    ).joinToString(" ")
}

private fun buildToolPromptFragment(entry: AgenticCatalogEntry<*, *>): String {
    val discovery = entry.definition.discovery
    val context = entry.definition.context
    val prompt = entry.definition.prompt
    val rag = entry.definition.rag
    val policy = entry.definition.policy
    return listOfNotNull(
        "Tool ${entry.publishedName}: ${prompt.purpose}",
        joinSentence("Use when", (prompt.whenToUse ?: emptyList()) + (discovery.intents ?: emptyList())),
        joinSentence("Do not use when", prompt.whenNotToUse),
        joinSentence("Aliases", discovery.aliases),
        joinSentence("Capabilities", discovery.capabilities),
        joinSentence("Dependencies", context.dependencies),
        joinSentence("Preconditions", context.preconditions),
        joinSentence("Constraints", (context.constraints ?: emptyList()) + (prompt.constraints ?: emptyList()) + (policy?.limits ?: emptyList())),
        joinSentence("Reasoning hints", prompt.reasoningHints),
        joinSentence("RAG topics", rag?.topics),
        joinSentence("RAG resources", rag?.resources?.map { resource ->
            if (resource.description != null) "${resource.kind}:${resource.ref} (${resource.description})" else "${resource.kind}:${resource.ref}"
        }),
        joinSentence("RAG hints", rag?.hints),
        "Execution mode: ${entry.executionMode}.",
        "Requires confirmation: ${if (entry.requiresConfirmation) "yes" else "no"}.",
        prompt.expectedOutcome?.let { "Expected outcome: $it." },
    ).joinToString("\n")
}

private fun toCatalogDocument(entry: AgenticCatalogEntry<*, *>): Map<String, Any?> =
    mapOf(
        "ref" to mapOf(
            "domain" to entry.ref.domain,
            "caseName" to entry.ref.caseName,
        ),
        "publishedName" to entry.publishedName,
        "isMcpEnabled" to entry.isMcpEnabled,
        "requiresConfirmation" to entry.requiresConfirmation,
        "executionMode" to entry.executionMode,
        "semanticSummary" to buildToolSemanticSummary(entry),
        "promptFragment" to buildToolPromptFragment(entry),
        "resources" to mapOf("semantic" to buildToolSemanticResourceUri(entry)),
        "definition" to stripDefinitionForProjection(entry),
    )

private fun toMcpSemanticAnnotations(entry: AgenticCatalogEntry<*, *>): Map<String, Any?> =
    mapOf(
        "readOnlyHint" to !(entry.definition.tool.isMutating ?: false),
        "destructiveHint" to (entry.definition.tool.isMutating ?: false),
        "requiresConfirmation" to entry.requiresConfirmation,
        "executionMode" to entry.executionMode,
        "appSemantic" to mapOf(
            "summary" to buildToolSemanticSummary(entry),
            "discovery" to entry.definition.discovery,
            "context" to entry.definition.context,
            "prompt" to entry.definition.prompt,
            "policy" to entry.definition.policy,
            "rag" to entry.definition.rag,
            "exampleNames" to entry.definition.examples?.map { it.name }.orEmpty(),
            "resourceUri" to buildToolSemanticResourceUri(entry),
        ),
    )

private fun toMcpToolDescriptor(entry: AgenticCatalogEntry<*, *>): AppMcpToolDescriptor {
    val summary = buildToolSemanticSummary(entry)
    return AppMcpToolDescriptor(
        name = entry.publishedName,
        title = entry.definition.mcp?.title ?: humanizeIdentifier(entry.publishedName),
        description = entry.definition.mcp?.description?.let { "$it $summary" } ?: summary,
        inputSchema = entry.definition.tool.inputSchema,
        outputSchema = entry.definition.tool.outputSchema,
        annotations = toMcpSemanticAnnotations(entry),
    )
}

private fun toMcpSemanticResourceDescriptor(entry: AgenticCatalogEntry<*, *>): AppMcpResourceDescriptor =
    AppMcpResourceDescriptor(
        uri = buildToolSemanticResourceUri(entry),
        name = "${entry.publishedName}_semantic",
        title = "${humanizeIdentifier(entry.publishedName)} Semantic Contract",
        description = "Complete APP agentic definition projected automatically from the registry for ${entry.publishedName}.",
        mimeType = "application/json",
        annotations = mapOf(
            "toolName" to entry.publishedName,
            "executionMode" to entry.executionMode,
            "requiresConfirmation" to entry.requiresConfirmation,
        ),
    )

private fun toMcpSystemPromptDescriptor(): AppMcpResourceDescriptor =
    AppMcpResourceDescriptor(
        uri = buildSystemPromptResourceUri(),
        name = "agent_system_prompt",
        title = "Agent System Prompt",
        description = "Host-level system prompt composed automatically from the registered tool fragments.",
        mimeType = "text/markdown",
        annotations = mapOf("kind" to "system-prompt"),
    )

private fun toMcpSuccessResult(toolName: String, data: Any?): AppMcpCallResult =
    AppMcpCallResult(
        content = listOf(toMcpTextContent("Tool $toolName executed successfully.")),
        structuredContent = data,
        isError = false,
    )

private fun toMcpErrorResult(error: AppCaseError): AppMcpCallResult =
    AppMcpCallResult(
        content = listOf(toMcpTextContent("${error.code}: ${error.message}")),
        structuredContent = mapOf(
            "code" to error.code,
            "message" to error.message,
            "details" to error.details,
        ),
        isError = true,
    )

private fun coerceToolInput(toolName: String, input: Any?): Any =
    when (toolName) {
        "task_create" -> {
            val payload = input as? Map<*, *> ?: emptyMap<Any?, Any?>()
            TaskCreateInput(
                title = payload["title"] as? String ?: "",
                description = payload["description"] as? String,
            )
        }
        "task_list" -> TaskListInput
        "task_move" -> {
            val payload = input as? Map<*, *> ?: emptyMap<Any?, Any?>()
            TaskMoveInput(
                taskId = payload["taskId"] as? String ?: "",
                targetStatus = payload["targetStatus"] as? String ?: "",
            )
        }
        else -> input ?: emptyMap<String, Any?>()
    }

fun bootstrap(config: AgentConfig = AgentConfig()): AgentApp {
    val registry = createRegistry(config)

    fun createApiContext(parent: ParentExecutionContext? = null): ApiContext {
        val context =
            object : ApiContext {
                override val correlationId: String = parent?.correlationId ?: generateId()
                override val executionId: String = generateId()
                override val tenantId: String? = parent?.tenantId
                override val userId: String? = parent?.userId
                override val logger: AppLogger = app.protocol.examples.kotlin.apps.agent.logger
                override val config: Map<String, Any?>? = parent?.config
                override val httpClient = null
                override val db: Any? = null
                override val auth: Any? = null
                override val storage = null
                override val cache = null
                override val packages: Map<String, Any?>? = registry._packages
                override val extra: Map<String, Any?>? =
                    mapOf("providers" to (registry._providers ?: emptyMap()))
                override val cases: Map<String, Any?>?
                    get() = emptyMap()
            }
        return context
    }

    fun createCasesMap(parent: ParentExecutionContext? = null): Map<String, Map<String, Map<String, Any?>>> =
        registry._cases.mapValues { (_, domainCases) ->
            domainCases.mapValues { (_, surfaces) ->
                buildMap {
                    surfaces.api?.let { factory ->
                        val apiContext = createApiContext(parent)
                        val apiInstance = factory(apiContext) as BaseApiCase<Any?, Any?>
                        val handler: suspend (Any?) -> ApiResponse<Any?> = { input -> apiInstance.handler(input) }
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

    fun createAgenticContext(parent: ParentExecutionContext? = null): AgenticContext {
        var contextCases: Map<String, Map<String, Map<String, Any?>>> = emptyMap()
        val context =
            object : AgenticContext {
                override val correlationId: String = parent?.correlationId ?: generateId()
                override val executionId: String = generateId()
                override val tenantId: String? = parent?.tenantId
                override val userId: String? = parent?.userId
                override val logger: AppLogger = app.protocol.examples.kotlin.apps.agent.logger
                override val config: Map<String, Any?>? = parent?.config
                override val packages: Map<String, Any?>? = registry._packages
                override val mcp: Any? =
                    mapOf(
                        "serverName" to "kotlin-task-board-agent",
                        "version" to APP_VERSION,
                        "protocolVersion" to MCP_PROTOCOL_VERSION,
                        "transport" to (parent?.mcp?.transport ?: "http"),
                        "sessionId" to parent?.mcp?.sessionId,
                        "clientInfo" to parent?.mcp?.clientInfo,
                    )
                override val extra: Map<String, Any?>? =
                    mapOf("providers" to (registry._providers ?: emptyMap()))
                override val cases: Map<String, Any?>?
                    get() = contextCases
            }
        contextCases = createCasesMap(parent)
        return context
    }

    fun buildAgentCatalog(parent: ParentExecutionContext? = null): List<AgenticCatalogEntry<*, *>> =
        registry.buildCatalog(createAgenticContext(parent))

    fun resolveTool(toolName: String, parent: ParentExecutionContext? = null): AgenticCatalogEntry<*, *>? =
        registry.resolveTool(toolName, createAgenticContext(parent))

    suspend fun executeTool(
        toolName: String,
        input: Any?,
        parent: ParentExecutionContext? = null,
    ): Any {
        val entry =
            resolveTool(toolName, parent) ?: throw AppCaseError(
                code = "NOT_FOUND",
                message = "Tool $toolName is not registered in apps/agent",
            )

        if (entry.executionMode == "suggest-only") {
            throw AppCaseError(
                code = "EXECUTION_MODE_RESTRICTED",
                message = "Tool ${entry.publishedName} cannot execute directly in suggest-only mode",
            )
        }

        if (entry.requiresConfirmation && parent?.confirmed != true) {
            throw AppCaseError(
                code = "CONFIRMATION_REQUIRED",
                message = "Tool ${entry.publishedName} requires explicit confirmation before execution",
                details = mapOf(
                    "toolName" to entry.publishedName,
                    "executionMode" to entry.executionMode,
                ),
            )
        }

        val ctx = createAgenticContext(parent)
        val runtimeEntry =
            registry.resolveTool(toolName, ctx) ?: throw AppCaseError(
                code = "NOT_FOUND",
                message = "Tool $toolName could not be resolved at execution time",
            )

        val normalizedInput = coerceToolInput(runtimeEntry.publishedName, input)
        return (runtimeEntry.definition.tool.execute as suspend (Any?, AgenticContext) -> Any).invoke(normalizedInput, ctx)
    }

    fun resolveMcpTool(toolName: String, parent: ParentExecutionContext? = null): AgenticCatalogEntry<*, *>? {
        val ctx = createAgenticContext(parent)
        val entry = registry.resolveTool(toolName, ctx)
        return if (entry?.isMcpEnabled == true) entry else null
    }

    fun buildSystemPrompt(parent: ParentExecutionContext? = null): String {
        val catalog = buildAgentCatalog(parent).sortedBy { it.publishedName }
        val confirmationTools = catalog.filter { it.requiresConfirmation }.map { it.publishedName }
        val suggestOnlyTools = catalog.filter { it.executionMode == "suggest-only" }.map { it.publishedName }
        return listOfNotNull(
            "You are operating kotlin-task-board-agent through the APP agent host.",
            "Use the registry-derived tool contracts exactly as published. Canonical execution always delegates through ctx.cases and the registered API surfaces.",
            if (confirmationTools.isNotEmpty()) "Tools requiring confirmation: ${confirmationTools.joinToString(", ")}." else "No tools currently require confirmation.",
            if (suggestOnlyTools.isNotEmpty()) "Suggest-only tools: ${suggestOnlyTools.joinToString(", ")}." else null,
            "Tool prompt fragments:",
            catalog.joinToString("\n\n") { entry -> buildToolPromptFragment(entry) },
        ).joinToString("\n\n")
    }

    fun mcpServerInfo(): AppMcpServerInfo =
        AppMcpServerInfo(
            name = "kotlin-task-board-agent",
            version = APP_VERSION,
            protocolVersion = MCP_PROTOCOL_VERSION,
            instructions = buildSystemPrompt(),
        )

    suspend fun initializeMcp(
        params: AppMcpInitializeParams? = null,
        parent: AppMcpRequestContext? = null,
    ): AppMcpInitializeResult {
        if (params?.protocolVersion != null && params.protocolVersion !in MCP_SUPPORTED_PROTOCOL_VERSIONS) {
            throw AppMcpProtocolError(
                -32602,
                "Unsupported MCP protocol version ${params.protocolVersion}.",
                mapOf("supported" to MCP_SUPPORTED_PROTOCOL_VERSIONS.toList()),
            )
        }

        val info = mcpServerInfo()
        return AppMcpInitializeResult(
            protocolVersion = info.protocolVersion,
            capabilities =
                AppMcpInitializeResult.Capabilities(
                    tools = AppMcpInitializeResult.Capabilities.ToolsCapability(listChanged = false),
                    resources = AppMcpInitializeResult.Capabilities.ResourcesCapability(listChanged = false),
                ),
            serverInfo =
                AppMcpInitializeResult.ServerInfo(
                    name = info.name,
                    version = info.version,
                ),
            instructions = info.instructions,
        )
    }

    suspend fun listMcpTools(parent: AppMcpRequestContext? = null): List<AppMcpToolDescriptor> =
        registry.listMcpEnabledTools(createAgenticContext(ParentExecutionContext(mcp = parent))).map(::toMcpToolDescriptor)

    suspend fun listMcpResources(parent: AppMcpRequestContext? = null): List<AppMcpResourceDescriptor> =
        listOf(toMcpSystemPromptDescriptor()) +
            registry.listMcpEnabledTools(createAgenticContext(ParentExecutionContext(mcp = parent))).map(::toMcpSemanticResourceDescriptor)

    suspend fun readMcpResource(
        uri: String,
        parent: AppMcpRequestContext? = null,
    ): AppMcpReadResourceResult {
        if (uri == buildSystemPromptResourceUri()) {
            return AppMcpReadResourceResult(
                contents =
                    listOf(
                        toMcpTextResourceContent(
                            uri = uri,
                            text = buildSystemPrompt(ParentExecutionContext(mcp = parent)),
                            mimeType = "text/markdown",
                        ),
                    ),
            )
        }

        val ctx = createAgenticContext(ParentExecutionContext(mcp = parent))
        val entry =
            registry.listMcpEnabledTools(ctx).firstOrNull { candidate ->
                buildToolSemanticResourceUri(candidate) == uri
            } ?: throw AppMcpProtocolError(-32004, "MCP resource $uri is not published by apps/agent.")

        val payload =
            mapOf(
                "app" to "kotlin-example-agent",
                "ref" to entry.ref,
                "publishedName" to entry.publishedName,
                "isMcpEnabled" to entry.isMcpEnabled,
                "requiresConfirmation" to entry.requiresConfirmation,
                "executionMode" to entry.executionMode,
                "semanticSummary" to buildToolSemanticSummary(entry),
                "promptFragment" to buildToolPromptFragment(entry),
                "definition" to stripDefinitionForProjection(entry),
            )

        return AppMcpReadResourceResult(
            contents =
                listOf(
                    toMcpTextResourceContent(
                        uri = uri,
                        text = agentJson.encodeToString(JsonElement.serializer(), encodeAgentValue(payload)),
                        mimeType = "application/json",
                    ),
                ),
        )
    }

    suspend fun callMcpTool(
        name: String,
        args: Any?,
        parent: AppMcpRequestContext? = null,
    ): AppMcpCallResult {
        val envelope = toExecutionEnvelope(args)
        return try {
            val resolved = resolveMcpTool(name, ParentExecutionContext(confirmed = envelope.confirmed, mcp = parent))
                ?: return toMcpErrorResult(
                    AppCaseError(
                        code = "NOT_FOUND",
                        message = "MCP tool $name is not published by apps/agent",
                    ),
                )
            val data =
                executeTool(
                    name,
                    envelope.input,
                    ParentExecutionContext(
                        confirmed = envelope.confirmed,
                        mcp = parent,
                    ),
                )
            toMcpSuccessResult(resolved.publishedName, data)
        } catch (error: AppCaseError) {
            toMcpErrorResult(error)
        }
    }

    suspend fun validateAgenticRuntime(): AgentRuntimeValidation {
        val ctx = createAgenticContext(ParentExecutionContext(correlationId = "agent-runtime-validation"))
        val catalog = registry.buildCatalog(ctx)

        if (catalog.isEmpty()) {
            throw IllegalStateException("apps/agent must register at least one agentic tool")
        }

        val mcpAdapters = registry._providers?.get("mcpAdapters") as? Map<String, Any?>
            ?: throw IllegalStateException("apps/agent must register mcpAdapters in _providers")
        if (mcpAdapters["stdio"] !is StdioAppMcpAdapter) {
            throw IllegalStateException("apps/agent must register a concrete stdio MCP adapter in _providers.mcpAdapters")
        }
        if (mcpAdapters["http"] !is StreamableHttpAppMcpAdapter) {
            throw IllegalStateException("apps/agent must register a concrete remote HTTP MCP adapter in _providers.mcpAdapters")
        }

        val publishedNames = mutableSetOf<String>()
        for (entry in catalog) {
            check(publishedNames.add(entry.publishedName)) {
                "apps/agent published duplicate tool name ${entry.publishedName}"
            }
            check(registry.resolveTool(entry.publishedName, ctx) != null) {
                "apps/agent failed to resolve published tool ${entry.publishedName}"
            }
            check(toMcpToolDescriptor(entry).description?.isNotBlank() == true) {
                "apps/agent failed to project semantic summary for ${entry.publishedName}"
            }
            check(buildToolPromptFragment(entry).contains(entry.definition.prompt.purpose)) {
                "apps/agent failed to project prompt fragment for ${entry.publishedName}"
            }
        }

        for (ref in registry.listAgenticCases()) {
            registry.instantiateAgentic(ref, ctx).test()
        }

        check(buildSystemPrompt(ParentExecutionContext(correlationId = "agent-runtime-validation")).isNotBlank()) {
            "apps/agent must project a non-empty global system prompt"
        }

        val resources = listMcpResources(AppMcpRequestContext(transport = "validation"))
        check(resources.size >= catalog.count { it.isMcpEnabled } + 1) {
            "apps/agent must publish a system prompt resource and one semantic resource per MCP-enabled tool"
        }

        return AgentRuntimeValidation(
            tools = catalog.size,
            mcpEnabled = catalog.count { it.isMcpEnabled },
            requireConfirmation = catalog.count { it.requiresConfirmation },
        )
    }

    suspend fun publishMcp() {
        validateAgenticRuntime()
        val adapter =
            ((registry._providers?.get("mcpAdapters") as? Map<String, Any?>)?.get("stdio") as? StdioAppMcpAdapter)
                ?: throw IllegalStateException("apps/agent stdio MCP adapter is missing")
        val server =
            object : AppMcpServer {
                override fun serverInfo(): AppMcpServerInfo = mcpServerInfo()

                override suspend fun initialize(
                    params: AppMcpInitializeParams?,
                    parent: AppMcpRequestContext?,
                ) = initializeMcp(params, parent)

                override suspend fun listTools(parent: AppMcpRequestContext?) = listMcpTools(parent)

                override suspend fun listResources(parent: AppMcpRequestContext?) = listMcpResources(parent)

                override suspend fun readResource(
                    uri: String,
                    parent: AppMcpRequestContext?,
                ) = readMcpResource(uri, parent)

                override suspend fun callTool(
                    name: String,
                    args: Any?,
                    parent: AppMcpRequestContext?,
                ) = callMcpTool(name, args, parent)
            }
        adapter.serve(server)
    }

    fun manifest(): AgentManifest {
        val catalog = buildAgentCatalog()
        val mcpAdapters = registry._providers?.get("mcpAdapters") as? Map<String, Any?>
        return AgentManifest(
            app = "kotlin-example-agent",
            port = registry._providers?.get("port"),
            registeredDomains = registry._cases.keys.toList(),
            packages = registry._packages?.keys?.toList().orEmpty(),
            tools = catalog.map { it.publishedName },
            mcpEnabledTools = catalog.filter { it.isMcpEnabled }.map { it.publishedName },
            transports = mapOf(
                "http" to true,
                "mcp" to mapOf(
                    "stdio" to (mcpAdapters?.get("stdio") as? StdioAppMcpAdapter)?.transport,
                    "remote" to (mcpAdapters?.get("http") as? StreamableHttpAppMcpAdapter)?.transport,
                    "remotePath" to (mcpAdapters?.get("http") as? StreamableHttpAppMcpAdapter)?.endpointPath,
                ),
            ),
            systemPrompt = buildSystemPrompt(),
        )
    }

    fun catalogDocument(): AgentCatalogDocument =
        AgentCatalogDocument(
            systemPrompt = buildSystemPrompt(),
            tools = buildAgentCatalog().map(::toCatalogDocument),
            resources = listOf(toMcpSystemPromptDescriptor()) + buildAgentCatalog().filter { it.isMcpEnabled }.map(::toMcpSemanticResourceDescriptor),
        )

    return AgentApp(
        config = config,
        registry = registry,
        createAgenticContext = ::createAgenticContext,
        buildAgentCatalog = ::buildAgentCatalog,
        buildSystemPrompt = ::buildSystemPrompt,
        resolveTool = ::resolveTool,
        executeTool = ::executeTool,
        initializeMcp = ::initializeMcp,
        listMcpTools = ::listMcpTools,
        listMcpResources = ::listMcpResources,
        readMcpResource = ::readMcpResource,
        callMcpTool = ::callMcpTool,
        publishMcp = ::publishMcp,
        validateAgenticRuntime = ::validateAgenticRuntime,
        mcpServerInfo = ::mcpServerInfo,
        manifest = ::manifest,
        catalogDocument = ::catalogDocument,
    )
}
