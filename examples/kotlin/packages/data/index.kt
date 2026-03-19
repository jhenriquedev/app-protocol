package app.protocol.examples.kotlin.packages.data

import java.nio.file.Path
import java.nio.file.Paths
import kotlinx.serialization.KSerializer

data class DataPackage(
    val defaultFiles: DefaultFiles,
) {
    data class DefaultFiles(
        val tasks: String,
    )

    fun <T> createJsonFileStore(
        options: JsonFileStoreOptions<T>,
    ): JsonFileStore<T> = createJsonFileStore(options)
}

fun createDataPackage(baseDirectory: String? = null): DataPackage {
    val resolvedBaseDirectory =
        if (baseDirectory != null) {
            Paths.get(baseDirectory)
        } else {
            Paths.get("packages", "data").toAbsolutePath().normalize()
        }

    return DataPackage(
        defaultFiles = DataPackage.DefaultFiles(
            tasks = resolvedBaseDirectory.resolve("tasks.json").toString(),
        ),
    )
}

fun <T> createJsonFileStore(
    filePath: String,
    fallbackData: T,
    serializer: KSerializer<T>,
): JsonFileStore<T> =
    createJsonFileStore(
        JsonFileStoreOptions(
            filePath = filePath,
            fallbackData = fallbackData,
            serializer = serializer,
        ),
    )
