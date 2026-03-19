package app.protocol.examples.kotlin.apps.agent

import app.protocol.examples.kotlin.cases.tasks.task_create.TaskCreateAgentic
import app.protocol.examples.kotlin.cases.tasks.task_create.TaskCreateApi
import app.protocol.examples.kotlin.cases.tasks.task_list.TaskListAgentic
import app.protocol.examples.kotlin.cases.tasks.task_list.TaskListApi
import app.protocol.examples.kotlin.cases.tasks.task_move.TaskMoveAgentic
import app.protocol.examples.kotlin.cases.tasks.task_move.TaskMoveApi
import app.protocol.examples.kotlin.core.agentic.AgenticContext
import app.protocol.examples.kotlin.core.shared.AgenticCatalogEntry
import app.protocol.examples.kotlin.core.shared.AgenticCaseRef
import app.protocol.examples.kotlin.core.shared.AgenticRegistry
import app.protocol.examples.kotlin.core.shared.AppCaseSurfaces
import app.protocol.examples.kotlin.packages.data.JsonFileStore
import app.protocol.examples.kotlin.packages.data.createDataPackage
import app.protocol.examples.kotlin.packages.data.createJsonFileStore
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject

data class AgentConfig(
    val port: Int = 3001,
    val dataDirectory: String? = null,
)

data class AgentRegistry(
    override val _cases: Map<String, Map<String, AppCaseSurfaces>>,
    override val _providers: Map<String, Any?>?,
    override val _packages: Map<String, Any?>?,
) : AgenticRegistry {
    override fun listAgenticCases(): List<AgenticCaseRef> =
        _cases.flatMap { (domain, domainCases) ->
            domainCases
                .filterValues { surfaces -> surfaces.agentic != null }
                .keys
                .map { caseName -> AgenticCaseRef(domain = domain, caseName = caseName) }
        }

    override fun getAgenticSurface(ref: AgenticCaseRef) = _cases[ref.domain]?.get(ref.caseName)?.agentic

    override fun instantiateAgentic(
        ref: AgenticCaseRef,
        ctx: AgenticContext,
    ) = (getAgenticSurface(ref) ?: error("Agentic surface not found for ${ref.domain}/${ref.caseName}"))(ctx)
        as app.protocol.examples.kotlin.core.agentic.BaseAgenticCase<*, *>

    override fun buildCatalog(ctx: AgenticContext): List<AgenticCatalogEntry<*, *>> =
        listAgenticCases().map { ref ->
            val instance = instantiateAgentic(ref, ctx)
            val definition = instance.definition()
            val requiresConfirmation = instance.requiresConfirmation()
            val isMcpEnabled = instance.isMcpEnabled()
            val entry =
                AgenticCatalogEntry(
                    ref = ref,
                    publishedName = "",
                    definition = definition,
                    isMcpEnabled = isMcpEnabled,
                    requiresConfirmation = requiresConfirmation,
                    executionMode = definition.policy?.executionMode
                        ?: if (requiresConfirmation) "manual-approval" else "direct-execution",
                )
            entry.copy(
                publishedName = definition.mcp?.name?.takeIf { isMcpEnabled && it.isNotBlank() } ?: definition.tool.name,
            )
        }

    override fun resolveTool(toolName: String, ctx: AgenticContext): AgenticCatalogEntry<*, *>? {
        val normalized = toolName.trim()
        return buildCatalog(ctx).firstOrNull { entry ->
            entry.publishedName == normalized || entry.definition.tool.name == normalized
        }
    }

    override fun listMcpEnabledTools(ctx: AgenticContext): List<AgenticCatalogEntry<*, *>> =
        buildCatalog(ctx).filter { it.isMcpEnabled }
}

private fun createTaskStoreProvider(
    taskStore: JsonFileStore<List<JsonObject>>,
): Map<String, Any?> {
    val read: suspend () -> List<JsonObject> = { taskStore.read() }
    val write: suspend (List<JsonObject>) -> Unit = { value -> taskStore.write(value) }
    val reset: suspend () -> Unit = { taskStore.reset() }
    val update: suspend (suspend (List<JsonObject>) -> List<JsonObject>) -> List<JsonObject> =
        { updater -> taskStore.update(updater) }

    return mapOf(
        "read" to read,
        "write" to write,
        "reset" to reset,
        "update" to update,
    )
}

fun createRegistry(config: AgentConfig = AgentConfig()): AgentRegistry {
    val data = createDataPackage(config.dataDirectory)
    val taskStore =
        createJsonFileStore(
            filePath = data.defaultFiles.tasks,
            fallbackData = emptyList<JsonObject>(),
            serializer = ListSerializer(JsonObject.serializer()),
        )

    return AgentRegistry(
        _cases = mapOf(
            "tasks" to mapOf(
                "task_create" to AppCaseSurfaces(
                    api = { ctx -> TaskCreateApi(ctx) },
                    agentic = { ctx -> TaskCreateAgentic(ctx) },
                ),
                "task_list" to AppCaseSurfaces(
                    api = { ctx -> TaskListApi(ctx) },
                    agentic = { ctx -> TaskListAgentic(ctx) },
                ),
                "task_move" to AppCaseSurfaces(
                    api = { ctx -> TaskMoveApi(ctx) },
                    agentic = { ctx -> TaskMoveAgentic(ctx) },
                ),
            ),
        ),
        _providers = mapOf(
            "port" to config.port,
            "taskStore" to createTaskStoreProvider(taskStore),
            "mcpAdapters" to mapOf(
                "stdio" to StdioAppMcpAdapter(),
                "http" to StreamableHttpAppMcpAdapter(),
            ),
        ),
        _packages = mapOf(
            "data" to data,
        ),
    )
}
