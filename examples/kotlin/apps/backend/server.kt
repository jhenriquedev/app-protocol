package app.protocol.examples.kotlin.apps.backend

fun main() {
    val resolvedPort =
        (System.getenv("PORT") ?: System.getenv("API_PORT"))?.toIntOrNull() ?: 3000
    val dataDirectory = System.getenv("APP_KOTLIN_DATA_DIR")

    val app =
        bootstrap(
        BackendConfig(
            port = resolvedPort,
            dataDirectory = dataDirectory,
        ),
    )
    app.startBackend()
    Thread.currentThread().join()
}
