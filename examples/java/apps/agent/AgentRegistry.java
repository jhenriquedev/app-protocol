package apps.agent;

import cases.tasks.task_create.TaskCreateAgenticCase;
import cases.tasks.task_create.TaskCreateApiCase;
import cases.tasks.task_list.TaskListAgenticCase;
import cases.tasks.task_list.TaskListApiCase;
import cases.tasks.task_move.TaskMoveAgenticCase;
import cases.tasks.task_move.TaskMoveApiCase;
import com.fasterxml.jackson.core.type.TypeReference;
import core.BaseAgenticCase;
import core.BaseAgenticCase.AgenticContext;
import core.shared.AppHostContracts.AgenticCaseRef;
import core.shared.AppHostContracts.AgenticCatalogEntry;
import core.shared.AppHostContracts.AgenticRegistry;
import core.shared.AppHostContracts.AppCaseSurfaces;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import packages.data.DataPackage;
import packages.data.JsonFileStore;

public final class AgentRegistry implements AgenticRegistry {
  public static final class AgentConfig {
    public int port = 3001;
    public Path dataDirectory = Path.of("packages/data");
  }

  public static final class McpAdapters {
    public final AgentMcpStdioAdapter stdio;
    public final AgentMcpHttpAdapter http;

    private McpAdapters(AgentMcpStdioAdapter stdio, AgentMcpHttpAdapter http) {
      this.stdio = stdio;
      this.http = http;
    }
  }

  private final Map<String, Map<String, AppCaseSurfaces>> cases;
  private final Map<String, Object> providers;
  private final Map<String, Object> packages;

  private AgentRegistry(
      Map<String, Map<String, AppCaseSurfaces>> cases,
      Map<String, Object> providers,
      Map<String, Object> packages
  ) {
    this.cases = cases;
    this.providers = providers;
    this.packages = packages;
  }

  public static AgentRegistry createRegistry(AgentConfig config) {
    DataPackage data = DataPackage.createDataPackage(config.dataDirectory);
    JsonFileStore<List<Map<String, Object>>> store = data.createJsonFileStore(
        data.defaultFiles.tasks,
        new TypeReference<>() {},
        List.of()
    );

    AgentTaskStoreProvider taskStoreProvider = new AgentTaskStoreProvider(store);

    Map<String, Map<String, AppCaseSurfaces>> cases = new LinkedHashMap<>();
    Map<String, AppCaseSurfaces> taskCases = new LinkedHashMap<>();
    taskCases.put("task_create", new AppCaseSurfaces()
        .api(TaskCreateApiCase::new)
        .agentic(TaskCreateAgenticCase::new));
    taskCases.put("task_list", new AppCaseSurfaces()
        .api(TaskListApiCase::new)
        .agentic(TaskListAgenticCase::new));
    taskCases.put("task_move", new AppCaseSurfaces()
        .api(TaskMoveApiCase::new)
        .agentic(TaskMoveAgenticCase::new));
    cases.put("tasks", taskCases);

    Map<String, Object> providers = new LinkedHashMap<>();
    providers.put("port", config.port);
    providers.put("taskStore", taskStoreProvider);
    providers.put("mcpAdapters", new McpAdapters(
        new AgentMcpStdioAdapter(),
        new AgentMcpHttpAdapter()
    ));

    Map<String, Object> packages = new LinkedHashMap<>();
    packages.put("data", data);

    return new AgentRegistry(cases, providers, packages);
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

  @Override
  public List<AgenticCaseRef> listAgenticCases() {
    java.util.ArrayList<AgenticCaseRef> refs = new java.util.ArrayList<>();
    for (Map.Entry<String, Map<String, AppCaseSurfaces>> domainEntry : cases.entrySet()) {
      for (Map.Entry<String, AppCaseSurfaces> caseEntry : domainEntry.getValue().entrySet()) {
        if (caseEntry.getValue().agentic != null) {
          refs.add(new AgenticCaseRef(domainEntry.getKey(), caseEntry.getKey()));
        }
      }
    }
    return refs;
  }

  @Override
  public core.shared.AppHostContracts.AgenticFactory getAgenticSurface(AgenticCaseRef ref) {
    Map<String, AppCaseSurfaces> domainCases = cases.get(ref.domain());
    if (domainCases == null) {
      return null;
    }

    AppCaseSurfaces surfaces = domainCases.get(ref.caseName());
    return surfaces == null ? null : surfaces.agentic;
  }

  @Override
  public BaseAgenticCase<?, ?> instantiateAgentic(AgenticCaseRef ref, AgenticContext ctx) {
    core.shared.AppHostContracts.AgenticFactory surface = getAgenticSurface(ref);
    if (surface == null) {
      throw new IllegalArgumentException(
          "Agentic surface not found for " + ref.domain() + "/" + ref.caseName()
      );
    }

    Object instance = surface.create(ctx);
    if (!(instance instanceof BaseAgenticCase<?, ?> agenticCase)) {
      throw new IllegalStateException(
          "Registered agentic surface is not a BaseAgenticCase for "
              + ref.domain()
              + "/"
              + ref.caseName()
      );
    }

    return agenticCase;
  }

  @Override
  public List<AgenticCatalogEntry> buildCatalog(AgenticContext ctx) {
    java.util.ArrayList<AgenticCatalogEntry> catalog = new java.util.ArrayList<>();
    for (AgenticCaseRef ref : listAgenticCases()) {
      BaseAgenticCase<?, ?> instance = instantiateAgentic(ref, ctx);
      AgenticCatalogEntry entry = new AgenticCatalogEntry();
      entry.ref = ref;
      entry.definition = instance.definition();
      entry.isMcpEnabled = instance.isMcpEnabled();
      entry.requiresConfirmation = instance.requiresConfirmation();
      entry.executionMode = entry.definition.policy != null
          && entry.definition.policy.executionMode != null
          && !entry.definition.policy.executionMode.isBlank()
          ? entry.definition.policy.executionMode
          : entry.requiresConfirmation
          ? "manual-approval"
          : "direct-execution";
      entry.publishedName = toPublishedToolName(entry);
      catalog.add(entry);
    }
    return catalog;
  }

  @Override
  public AgenticCatalogEntry resolveTool(String toolName, AgenticContext ctx) {
    String normalized = toolName == null ? "" : toolName.trim();
    for (AgenticCatalogEntry entry : buildCatalog(ctx)) {
      if (entry.publishedName.equals(normalized)
          || entry.definition.tool.name.equals(normalized)) {
        return entry;
      }
    }
    return null;
  }

  @Override
  public List<AgenticCatalogEntry> listMcpEnabledTools(AgenticContext ctx) {
    java.util.ArrayList<AgenticCatalogEntry> tools = new java.util.ArrayList<>();
    for (AgenticCatalogEntry entry : buildCatalog(ctx)) {
      if (entry.isMcpEnabled) {
        tools.add(entry);
      }
    }
    return tools;
  }

  public McpAdapters mcpAdapters() {
    return (McpAdapters) providers.get("mcpAdapters");
  }

  private static String toPublishedToolName(AgenticCatalogEntry entry) {
    if (entry.isMcpEnabled
        && entry.definition.mcp != null
        && entry.definition.mcp.name != null
        && !entry.definition.mcp.name.isBlank()) {
      return entry.definition.mcp.name;
    }

    return entry.definition.tool.name;
  }

  private static final class AgentTaskStoreProvider
      implements TaskCreateApiCase.TaskStore, TaskListApiCase.TaskStore, TaskMoveApiCase.TaskStore {
    private final JsonFileStore<List<Map<String, Object>>> store;

    private AgentTaskStoreProvider(JsonFileStore<List<Map<String, Object>>> store) {
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
