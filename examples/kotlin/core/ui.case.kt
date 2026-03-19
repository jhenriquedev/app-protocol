package app.protocol.examples.kotlin.core.ui

import app.protocol.examples.kotlin.core.Dict
import app.protocol.examples.kotlin.core.shared.AppBaseContext
import app.protocol.examples.kotlin.core.shared.AppHttpClient

interface UiContext : AppBaseContext {
    val renderer: Any?
    val router: Any?
    val store: Any?
    val api: AppHttpClient?
    val packages: Dict<Any?>?
    val extra: Dict<Any?>?
}

typealias UIState = MutableMap<String, Any?>

abstract class BaseUiCase<TState : Any>(
    protected val ctx: UiContext,
    initialState: TState,
) {
    protected var currentState: TState = initialState
        private set

    protected val state: TState
        get() = currentState

    abstract fun view(): Any

    open suspend fun test() {
    }

    protected open fun _viewmodel(vararg args: Any?): Any? = null

    protected open suspend fun _service(vararg args: Any?): Any? = null

    protected open suspend fun _repository(vararg args: Any?): Any? = null

    protected fun setState(nextState: TState) {
        currentState = nextState
    }
}
