package app.protocol.examples.kotlin.core.shared

import app.protocol.examples.kotlin.core.Dict
import app.protocol.examples.kotlin.core.agentic.AgenticContext
import app.protocol.examples.kotlin.core.agentic.AgenticDefinition
import app.protocol.examples.kotlin.core.agentic.BaseAgenticCase
import app.protocol.examples.kotlin.core.api.ApiContext
import app.protocol.examples.kotlin.core.stream.StreamContext
import app.protocol.examples.kotlin.core.ui.UiContext

typealias DomainCaseFactory = () -> Any
typealias ApiCaseFactory = (ApiContext) -> Any
typealias UiCaseFactory = (UiContext) -> Any
typealias StreamCaseFactory = (StreamContext) -> Any
typealias AgenticCaseFactory = (AgenticContext) -> Any

data class AppCaseSurfaces(
    val domain: DomainCaseFactory? = null,
    val api: ApiCaseFactory? = null,
    val ui: UiCaseFactory? = null,
    val stream: StreamCaseFactory? = null,
    val agentic: AgenticCaseFactory? = null,
)

interface AppRegistry {
    val _cases: Dict<Dict<AppCaseSurfaces>>
    val _providers: Dict<Any?>?
    val _packages: Dict<Any?>?
}

data class AgenticCaseRef(
    val domain: String,
    val caseName: String,
)

data class AgenticCatalogEntry<TInput, TOutput>(
    val ref: AgenticCaseRef,
    val publishedName: String,
    val definition: AgenticDefinition<TInput, TOutput>,
    val isMcpEnabled: Boolean,
    val requiresConfirmation: Boolean,
    val executionMode: String,
)

interface AgenticRegistry : AppRegistry {
    fun listAgenticCases(): List<AgenticCaseRef>

    fun getAgenticSurface(ref: AgenticCaseRef): AgenticCaseFactory?

    fun instantiateAgentic(ref: AgenticCaseRef, ctx: AgenticContext): BaseAgenticCase<*, *>

    fun buildCatalog(ctx: AgenticContext): List<AgenticCatalogEntry<*, *>>

    fun resolveTool(toolName: String, ctx: AgenticContext): AgenticCatalogEntry<*, *>?

    fun listMcpEnabledTools(ctx: AgenticContext): List<AgenticCatalogEntry<*, *>>
}
