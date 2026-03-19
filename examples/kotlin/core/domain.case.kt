package app.protocol.examples.kotlin.core

import kotlinx.serialization.Serializable

typealias Dict<T> = Map<String, T>

@Serializable
data class AppSchema(
    val type: String,
    val description: String? = null,
    val properties: Map<String, AppSchema>? = null,
    val items: AppSchema? = null,
    val required: List<String>? = null,
    val enum: List<String>? = null,
    val additionalProperties: Boolean? = null,
)

data class DomainExample<TInput, TOutput>(
    val name: String,
    val description: String? = null,
    val input: TInput,
    val output: TOutput? = null,
    val notes: List<String>? = null,
)

data class DomainDefinition<TInput, TOutput>(
    val caseName: String,
    val description: String,
    val inputSchema: AppSchema,
    val outputSchema: AppSchema,
    val invariants: List<String>,
    val valueObjects: Dict<Any>,
    val enums: Dict<Any>,
    val examples: List<DomainExample<TInput, TOutput>>,
)

abstract class ValueObject<TProps>(
    protected val props: TProps,
) {
    open fun toJson(): TProps = props

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ValueObject<*>) return false
        return props == other.props
    }

    override fun hashCode(): Int = props?.hashCode() ?: 0
}

abstract class BaseDomainCase<TInput, TOutput> {
    abstract fun caseName(): String

    abstract fun description(): String

    abstract fun inputSchema(): AppSchema

    abstract fun outputSchema(): AppSchema

    open fun validate(input: TInput) {
    }

    open fun invariants(): List<String> = emptyList()

    open fun valueObjects(): Dict<Any> = emptyMap()

    open fun enums(): Dict<Any> = emptyMap()

    open fun examples(): List<DomainExample<TInput, TOutput>> = emptyList()

    open suspend fun test() {
    }

    fun definition(): DomainDefinition<TInput, TOutput> =
        DomainDefinition(
            caseName = caseName(),
            description = description(),
            inputSchema = inputSchema(),
            outputSchema = outputSchema(),
            invariants = invariants(),
            valueObjects = valueObjects(),
            enums = enums(),
            examples = examples(),
        )
}
