package app.protocol.examples.kotlin.apps.portal

import app.protocol.examples.kotlin.core.shared.AppLogger
import app.protocol.examples.kotlin.core.ui.UiContext
import org.w3c.dom.HTMLElement
import kotlin.js.Date
import kotlin.random.Random

private val logger =
    object : AppLogger {
        override fun debug(message: String, meta: Map<String, Any?>?) {
            console.log("[portal]", message, meta)
        }

        override fun info(message: String, meta: Map<String, Any?>?) {
            console.info("[portal]", message, meta)
        }

        override fun warn(message: String, meta: Map<String, Any?>?) {
            console.warn("[portal]", message, meta)
        }

        override fun error(message: String, meta: Map<String, Any?>?) {
            console.error("[portal]", message, meta)
        }
    }

private fun generateId(): String =
    "portal_${Date.now().toLong()}_${Random.nextLong(0, Long.MAX_VALUE).toString(16)}"

fun bootstrap(config: PortalConfig = PortalConfig()): PortalApp {
    val registry = createRegistry(config)

    fun createUiContext(extra: Map<String, Any?> = emptyMap()): UiContext =
        object : UiContext {
            override val correlationId: String = generateId()
            override val executionId: String = generateId()
            override val tenantId: String? = null
            override val userId: String? = null
            override val logger: AppLogger = app.protocol.examples.kotlin.apps.portal.logger
            override val config: Map<String, Any?>? = null
            override val renderer: Any? = mapOf("runtime" to "kotlin-js")
            override val router: Any? = null
            override val store: Any? = null
            override val api = registry._providers?.get("httpClient") as? app.protocol.examples.kotlin.core.shared.AppHttpClient
            override val packages = registry._packages
            override val extra = extra
        }

    fun mountRoot(rootElement: HTMLElement) {
        PortalRoot.render(
            registry = registry,
            createUiContext = ::createUiContext,
            rootElement = rootElement,
        )
    }

    return PortalApp(
        registry = registry,
        createUiContext = ::createUiContext,
        mountRoot = ::mountRoot,
    )
}

data class PortalApp(
    val registry: PortalRegistry,
    val createUiContext: (Map<String, Any?>) -> UiContext,
    val mountRoot: (HTMLElement) -> Unit,
)
