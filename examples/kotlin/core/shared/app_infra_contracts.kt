package app.protocol.examples.kotlin.core.shared

interface AppHttpClient {
    suspend fun request(config: Any?): Any?
}

interface AppStorageClient {
    suspend fun get(key: String): Any?

    suspend fun set(key: String, value: Any?): Unit
}

interface AppCache {
    suspend fun get(key: String): Any?

    suspend fun set(key: String, value: Any?, ttl: Int? = null): Unit
}

interface AppEventPublisher {
    suspend fun publish(event: String, payload: Any?): Unit
}
