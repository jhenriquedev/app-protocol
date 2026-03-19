package app.protocol.examples.kotlin.core.shared

import app.protocol.examples.kotlin.core.Dict

interface AppLogger {
    fun debug(message: String, meta: Dict<Any?>? = null)

    fun info(message: String, meta: Dict<Any?>? = null)

    fun warn(message: String, meta: Dict<Any?>? = null)

    fun error(message: String, meta: Dict<Any?>? = null)
}

interface AppBaseContext {
    val correlationId: String
    val executionId: String?
    val tenantId: String?
    val userId: String?
    val logger: AppLogger
    val config: Dict<Any?>?
}
