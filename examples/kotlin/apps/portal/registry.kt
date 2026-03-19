@file:Suppress("UnsafeCastFromDynamic")

package app.protocol.examples.kotlin.apps.portal

import app.protocol.examples.kotlin.cases.tasks.task_create.TaskCreateUi
import app.protocol.examples.kotlin.cases.tasks.task_list.TaskListUi
import app.protocol.examples.kotlin.cases.tasks.task_move.TaskMoveUi
import app.protocol.examples.kotlin.core.api.ApiResponse
import app.protocol.examples.kotlin.core.shared.AppHttpClient
import app.protocol.examples.kotlin.core.shared.AppRegistry
import app.protocol.examples.kotlin.core.shared.AppCaseSurfaces
import app.protocol.examples.kotlin.packages.design_system.DesignSystem
import kotlinx.browser.window
import kotlinx.coroutines.await
import kotlin.js.JSON

data class PortalConfig(
    val apiBaseURL: String = "http://localhost:3000",
)

class FetchHttpAdapter(
    private val baseURL: String,
) : AppHttpClient {
    override suspend fun request(config: Any?): Any? {
        val payload = config as? Map<String, Any?> ?: error("portal http config must be a map")
        val method = payload["method"] as? String ?: "GET"
        val url = payload["url"] as? String ?: "/"
        val body = payload["body"]

        val init = js("({})")
        init.method = method
        init.headers = js("({ 'content-type': 'application/json' })")
        if (body != null) {
            init.body = JSON.stringify(body)
        }

        val resolvedUrl =
            if (url.startsWith("http://") || url.startsWith("https://")) {
                url
            } else {
                "${baseURL.trimEnd('/')}${if (url.startsWith("/")) url else "/$url"}"
            }

        val response = window.fetch(resolvedUrl, init).await()
        val responseText = response.text().await()

        if (!response.ok) {
            val parsed = runCatching { JSON.parse<dynamic>(responseText) }.getOrNull()
            val message =
                parsed?.error?.message as? String
                    ?: parsed?.message as? String
                    ?: "HTTP ${response.status} while requesting $url"
            error(message)
        }

        return responseText
    }
}

data class PortalRegistry(
    override val _cases: Map<String, Map<String, AppCaseSurfaces>>,
    override val _providers: Map<String, Any?>?,
    override val _packages: Map<String, Any?>?,
) : AppRegistry

fun createRegistry(config: PortalConfig): PortalRegistry =
    PortalRegistry(
        _cases = mapOf(
            "tasks" to mapOf(
                "task_create" to AppCaseSurfaces(ui = { ctx -> TaskCreateUi(ctx) }),
                "task_list" to AppCaseSurfaces(ui = { ctx -> TaskListUi(ctx) }),
                "task_move" to AppCaseSurfaces(ui = { ctx -> TaskMoveUi(ctx) }),
            ),
        ),
        _providers = mapOf(
            "httpClient" to FetchHttpAdapter(config.apiBaseURL),
        ),
        _packages = mapOf(
            "designSystem" to DesignSystem,
        ),
    )
