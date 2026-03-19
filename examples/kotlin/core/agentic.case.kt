package app.protocol.examples.kotlin.core.agentic

import app.protocol.examples.kotlin.core.AppSchema
import app.protocol.examples.kotlin.core.BaseDomainCase
import app.protocol.examples.kotlin.core.Dict
import app.protocol.examples.kotlin.core.DomainExample
import app.protocol.examples.kotlin.core.shared.AppBaseContext

interface AgenticContext : AppBaseContext {
    val cases: Dict<Any?>?
    val packages: Dict<Any?>?
    val mcp: Any?
    val extra: Dict<Any?>?
}

data class AgenticDiscovery(
    val name: String,
    val description: String,
    val category: String? = null,
    val tags: List<String>? = null,
    val aliases: List<String>? = null,
    val capabilities: List<String>? = null,
    val intents: List<String>? = null,
)

data class AgenticExecutionContext(
    val requiresAuth: Boolean? = null,
    val requiresTenant: Boolean? = null,
    val dependencies: List<String>? = null,
    val preconditions: List<String>? = null,
    val constraints: List<String>? = null,
    val notes: List<String>? = null,
)

data class AgenticPrompt(
    val purpose: String,
    val whenToUse: List<String>? = null,
    val whenNotToUse: List<String>? = null,
    val constraints: List<String>? = null,
    val reasoningHints: List<String>? = null,
    val expectedOutcome: String? = null,
)

data class AgenticToolContract<TInput, TOutput>(
    val name: String,
    val description: String,
    val inputSchema: AppSchema,
    val outputSchema: AppSchema,
    val isMutating: Boolean? = null,
    val requiresConfirmation: Boolean? = null,
    val execute: suspend (TInput, AgenticContext) -> TOutput,
)

data class AgenticMcpContract(
    val enabled: Boolean? = null,
    val name: String? = null,
    val title: String? = null,
    val description: String? = null,
    val metadata: Dict<Any?>? = null,
)

typealias RagResourceKind = String

data class RagResource(
    val kind: RagResourceKind,
    val ref: String,
    val description: String? = null,
)

data class AgenticRagContract(
    val topics: List<String>? = null,
    val resources: List<RagResource>? = null,
    val hints: List<String>? = null,
    val scope: String? = null,
    val mode: String? = null,
)

data class AgenticPolicy(
    val requireConfirmation: Boolean? = null,
    val requireAuth: Boolean? = null,
    val requireTenant: Boolean? = null,
    val riskLevel: String? = null,
    val executionMode: String? = null,
    val limits: List<String>? = null,
)

data class AgenticExample<TInput, TOutput>(
    val name: String,
    val description: String? = null,
    val input: TInput,
    val output: TOutput,
    val notes: List<String>? = null,
)

data class AgenticDefinition<TInput, TOutput>(
    val discovery: AgenticDiscovery,
    val context: AgenticExecutionContext,
    val prompt: AgenticPrompt,
    val tool: AgenticToolContract<TInput, TOutput>,
    val mcp: AgenticMcpContract? = null,
    val rag: AgenticRagContract? = null,
    val policy: AgenticPolicy? = null,
    val examples: List<AgenticExample<TInput, TOutput>>? = null,
)

abstract class BaseAgenticCase<TInput, TOutput>(
    protected val ctx: AgenticContext,
) {
    protected open fun domain(): BaseDomainCase<TInput, TOutput>? = null

    abstract fun discovery(): AgenticDiscovery

    abstract fun context(): AgenticExecutionContext

    abstract fun prompt(): AgenticPrompt

    abstract fun tool(): AgenticToolContract<TInput, TOutput>

    open suspend fun test() {
    }

    open fun mcp(): AgenticMcpContract? = null

    open fun rag(): AgenticRagContract? = null

    open fun policy(): AgenticPolicy? = null

    open fun examples(): List<AgenticExample<TInput, TOutput>> =
        domainExamples() ?: emptyList()

    protected fun domainDescription(): String? = domain()?.description()

    protected fun domainCaseName(): String? = domain()?.caseName()

    protected fun domainInputSchema(): AppSchema? = domain()?.inputSchema()

    protected fun domainOutputSchema(): AppSchema? = domain()?.outputSchema()

    protected fun domainExamples(): List<AgenticExample<TInput, TOutput>>? =
        domain()?.examples()
            ?.filter { it.output != null }
            ?.map { example ->
                AgenticExample(
                    name = example.name,
                    description = example.description,
                    input = example.input,
                    output = example.output as TOutput,
                    notes = example.notes,
                )
            }
            ?.takeIf { it.isNotEmpty() }

    fun definition(): AgenticDefinition<TInput, TOutput> =
        AgenticDefinition(
            discovery = discovery(),
            context = context(),
            prompt = prompt(),
            tool = tool(),
            mcp = mcp(),
            rag = rag(),
            policy = policy(),
            examples = examples(),
        )

    suspend fun execute(input: TInput): TOutput = tool().execute(input, ctx)

    fun isMcpEnabled(): Boolean = mcp()?.enabled != false && mcp() != null

    fun requiresConfirmation(): Boolean =
        (policy()?.requireConfirmation == true) || (tool().requiresConfirmation == true)

    fun caseName(): String = discovery().name.ifBlank { domainCaseName() ?: "unknown_case" }

    protected fun validateDefinition() {
        val discovery = discovery()
        if (discovery.name.isBlank()) {
            throw IllegalStateException("validateDefinition: discovery.name is empty")
        }
        if (discovery.description.isBlank()) {
            throw IllegalStateException("validateDefinition: discovery.description is empty")
        }

        val tool = tool()
        if (tool.name.isBlank()) {
            throw IllegalStateException("validateDefinition: tool.name is empty")
        }

        val prompt = prompt()
        if (prompt.purpose.isBlank()) {
            throw IllegalStateException("validateDefinition: prompt.purpose is empty")
        }

        val mcp = mcp()
        if (mcp?.enabled == true && mcp.name.isNullOrBlank()) {
            throw IllegalStateException("validateDefinition: mcp.enabled but mcp.name is empty")
        }
    }
}
