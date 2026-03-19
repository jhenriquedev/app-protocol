package apps.backend;

import cases.tasks.task_create.TaskCreateApiCase;
import cases.tasks.task_list.TaskListApiCase;
import cases.tasks.task_move.TaskMoveApiCase;
import com.fasterxml.jackson.core.type.TypeReference;
import core.shared.AppHostContracts.AppCaseSurfaces;
import core.shared.AppHostContracts.AppRegistry;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import packages.data.DataPackage;
import packages.data.JsonFileStore;

public final class BackendRegistry implements AppRegistry {
  public static final class BackendConfig {
    public int port = 3000;
    public Path dataDirectory = Path.of("packages/data");
  }

  private final Map<String, Map<String, AppCaseSurfaces>> cases;
  private final Map<String, Object> providers;
  private final Map<String, Object> packages;

  private BackendRegistry(
      Map<String, Map<String, AppCaseSurfaces>> cases,
      Map<String, Object> providers,
      Map<String, Object> packages
  ) {
    this.cases = cases;
    this.providers = providers;
    this.packages = packages;
  }

  public static BackendRegistry createRegistry(BackendConfig config) {
    DataPackage data = DataPackage.createDataPackage(config.dataDirectory);
    JsonFileStore<List<Map<String, Object>>> store = data.createJsonFileStore(
        data.defaultFiles.tasks,
        new TypeReference<>() {},
        List.of()
    );

    BackendTaskStoreProvider taskStoreProvider = new BackendTaskStoreProvider(store);

    Map<String, Map<String, AppCaseSurfaces>> cases = new LinkedHashMap<>();
    Map<String, AppCaseSurfaces> taskCases = new LinkedHashMap<>();
    taskCases.put("task_create", new AppCaseSurfaces().api(TaskCreateApiCase::new));
    taskCases.put("task_list", new AppCaseSurfaces().api(TaskListApiCase::new));
    taskCases.put("task_move", new AppCaseSurfaces().api(TaskMoveApiCase::new));
    cases.put("tasks", taskCases);

    Map<String, Object> providers = new LinkedHashMap<>();
    providers.put("port", config.port);
    providers.put("taskStore", taskStoreProvider);

    Map<String, Object> packages = new LinkedHashMap<>();
    packages.put("data", data);

    return new BackendRegistry(cases, providers, packages);
  }

  @Override
  public Map<String, Map<String, AppCaseSurfaces>> cases() {
    return cases;
  }

  @Override
  public Map<String, Object> providers() {
    return providers;
  }

  @Override
  public Map<String, Object> packages() {
    return packages;
  }

  private static final class BackendTaskStoreProvider
      implements TaskCreateApiCase.TaskStore, TaskListApiCase.TaskStore, TaskMoveApiCase.TaskStore {
    private final JsonFileStore<List<Map<String, Object>>> store;

    private BackendTaskStoreProvider(JsonFileStore<List<Map<String, Object>>> store) {
      this.store = store;
    }

    @Override
    public List<Map<String, Object>> read() throws Exception {
      return store.read();
    }

    @Override
    public void write(List<Map<String, Object>> value) throws Exception {
      store.write(value);
    }

    @Override
    public void reset() throws Exception {
      store.reset();
    }

    @Override
    public List<Map<String, Object>> update(TaskCreateApiCase.TaskUpdater updater) throws Exception {
      return store.update(updater::apply);
    }

    @Override
    public List<Map<String, Object>> update(TaskMoveApiCase.TaskUpdater updater) throws Exception {
      return store.update(updater::apply);
    }
  }
}
