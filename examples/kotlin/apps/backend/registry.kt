package app.protocol.examples.kotlin.apps.backend

import app.protocol.examples.kotlin.cases.tasks.task_create.TaskCreateApi
import app.protocol.examples.kotlin.cases.tasks.task_list.TaskListApi
import app.protocol.examples.kotlin.cases.tasks.task_move.TaskMoveApi
import app.protocol.examples.kotlin.core.shared.AppCaseSurfaces
import app.protocol.examples.kotlin.core.shared.AppRegistry
import app.protocol.examples.kotlin.packages.data.JsonFileStore
import app.protocol.examples.kotlin.packages.data.createDataPackage
import app.protocol.examples.kotlin.packages.data.createJsonFileStore
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject

data class BackendConfig(
    val port: Int = 3000,
    val dataDirectory: String? = null,
)

data class BackendRegistry(
    override val _cases: Map<String, Map<String, AppCaseSurfaces>>,
    override val _providers: Map<String, Any?>?,
    override val _packages: Map<String, Any?>?,
) : AppRegistry

private fun createTaskStoreProvider(
    taskStore: JsonFileStore<List<JsonObject>>,
): Map<String, Any?> {
    val read: suspend () -> List<JsonObject> = { taskStore.read() }
    val write: suspend (List<JsonObject>) -> Unit = { value -> taskStore.write(value) }
    val reset: suspend () -> Unit = { taskStore.reset() }
    val update: suspend (suspend (List<JsonObject>) -> List<JsonObject>) -> List<JsonObject> =
        { updater -> taskStore.update(updater) }

    return mapOf(
        "read" to read,
        "write" to write,
        "reset" to reset,
        "update" to update,
    )
}

fun createRegistry(config: BackendConfig = BackendConfig()): BackendRegistry {
    val data = createDataPackage(config.dataDirectory)
    val taskStore =
        createJsonFileStore(
            filePath = data.defaultFiles.tasks,
            fallbackData = emptyList<JsonObject>(),
            serializer = ListSerializer(JsonObject.serializer()),
        )

    return BackendRegistry(
        _cases = mapOf(
            "tasks" to mapOf(
                "task_create" to AppCaseSurfaces(api = { ctx -> TaskCreateApi(ctx) }),
                "task_list" to AppCaseSurfaces(api = { ctx -> TaskListApi(ctx) }),
                "task_move" to AppCaseSurfaces(api = { ctx -> TaskMoveApi(ctx) }),
            ),
        ),
        _providers = mapOf(
            "port" to config.port,
            "taskStore" to createTaskStoreProvider(taskStore),
        ),
        _packages = mapOf(
            "data" to data,
        ),
    )
}
