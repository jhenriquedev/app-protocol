package app.protocol.examples.kotlin.apps.agent

import kotlinx.coroutines.runBlocking

fun main() = runBlocking {
    bootstrap(
        AgentConfig(
            dataDirectory = System.getenv("APP_KOTLIN_DATA_DIR"),
        ),
    ).publishMcp()
}
