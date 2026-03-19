package app.protocol.examples.kotlin.packages.data

import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.nio.file.StandardOpenOption
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json

interface JsonFileStore<T> {
    val filePath: String

    suspend fun read(): T

    suspend fun write(value: T)

    suspend fun reset()

    suspend fun update(updater: suspend (current: T) -> T): T
}

data class JsonFileStoreOptions<T>(
    val filePath: String,
    val fallbackData: T,
    val serializer: KSerializer<T>,
)

private val json =
    Json {
        prettyPrint = true
        encodeDefaults = true
        ignoreUnknownKeys = false
    }

fun <T> createJsonFileStore(
    options: JsonFileStoreOptions<T>,
): JsonFileStore<T> {
    val mutex = Mutex()
    val path = Paths.get(options.filePath)
    val lockPath = Paths.get("${options.filePath}.lock")

    suspend fun ensureFileExists() {
        withContext(Dispatchers.IO) {
            Files.createDirectories(path.parent)
            if (!Files.exists(path)) {
                writeJsonAtomically(path, options.fallbackData, options.serializer)
            }
        }
    }

    suspend fun <TResult> withFileLock(block: suspend () -> TResult): TResult =
        withContext(Dispatchers.IO) {
            Files.createDirectories(lockPath.parent)
            FileChannel.open(
                lockPath,
                StandardOpenOption.CREATE,
                StandardOpenOption.WRITE,
            ).use { channel ->
                channel.lock().use {
                    block()
                }
            }
        }

    suspend fun readJsonFile(): T =
        withContext(Dispatchers.IO) {
            val content = Files.readString(path)
            json.decodeFromString(options.serializer, content)
        }

    return object : JsonFileStore<T> {
        override val filePath: String = options.filePath

        override suspend fun read(): T =
            mutex.withLock {
                withFileLock {
                    ensureFileExists()
                    readJsonFile()
                }
            }

        override suspend fun write(value: T) {
            mutex.withLock {
                withFileLock {
                    ensureFileExists()
                    writeJsonAtomically(path, value, options.serializer)
                }
            }
        }

        override suspend fun reset() {
            mutex.withLock {
                withFileLock {
                    ensureFileExists()
                    writeJsonAtomically(path, options.fallbackData, options.serializer)
                }
            }
        }

        override suspend fun update(updater: suspend (current: T) -> T): T =
            mutex.withLock {
                withFileLock {
                    ensureFileExists()
                    val current = readJsonFile()
                    val next = updater(current)
                    if (next != current) {
                        writeJsonAtomically(path, next, options.serializer)
                    }
                    next
                }
            }
    }
}

private suspend fun <T> writeJsonAtomically(
    path: Path,
    value: T,
    serializer: KSerializer<T>,
) {
    withContext(Dispatchers.IO) {
        Files.createDirectories(path.parent)
        val tempFile = Files.createTempFile(path.parent, path.fileName.toString(), ".tmp")
        try {
            val content = "${json.encodeToString(serializer, value)}\n"
            Files.writeString(tempFile, content, StandardCharsets.UTF_8)
            Files.move(
                tempFile,
                path,
                java.nio.file.StandardCopyOption.ATOMIC_MOVE,
                java.nio.file.StandardCopyOption.REPLACE_EXISTING,
            )
        } finally {
            Files.deleteIfExists(tempFile)
        }
    }
}
