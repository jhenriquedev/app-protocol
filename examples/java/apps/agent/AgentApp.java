package apps.agent;

import cases.tasks.task_create.TaskCreateDomainCase;
import cases.tasks.task_list.TaskListDomainCase;
import cases.tasks.task_move.TaskMoveDomainCase;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import core.BaseAgenticCase;
import core.BaseAgenticCase.AgenticContext;
import core.BaseApiCase;
import core.BaseApiCase.ApiContext;
import core.shared.AppBaseContext.AppLogger;
import core.shared.AppHostContracts.AgenticCaseRef;
import core.shared.AppHostContracts.AgenticCatalogEntry;
import core.shared.AppHostContracts.AppCaseSurfaces;
import core.shared.AppMcpContracts.AppMcpCallResult;
import core.shared.AppMcpContracts.AppMcpHttpExchange;
import core.shared.AppMcpContracts.AppMcpHttpResponse;
import core.shared.AppMcpContracts.AppMcpInitializeParams;
import core.shared.AppMcpContracts.AppMcpInitializeResult;
import core.shared.AppMcpContracts.AppMcpProtocolError;
import core.shared.AppMcpContracts.AppMcpReadResourceResult;
import core.shared.AppMcpContracts.AppMcpRequestContext;
import core.shared.AppMcpContracts.AppMcpResourceDescriptor;
import core.shared.AppMcpContracts.AppMcpServer;
import core.shared.AppMcpContracts.AppMcpServerInfo;
import core.shared.AppMcpContracts.AppMcpTextContent;
import core.shared.AppMcpContracts.AppMcpTextResourceContent;
import core.shared.AppMcpContracts.AppMcpToolDescriptor;
import core.shared.AppStructuralContracts.AppCaseError;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public final class AgentApp {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String APP_VERSION = "1.1.0";
  private static final String MCP_PROTOCOL_VERSION = "2025-11-25";
  private static final List<String> MCP_SUPPORTED_PROTOCOL_VERSIONS = List.of(
      MCP_PROTOCOL_VERSION,
      "2025-06-18"
  );

  private final AgentRegistry registry;
  private final AppLogger logger;

  private AgentApp(AgentRegistry registry) {
    this.registry = registry;
    this.logger = new AppLogger() {
      @Override
      public void debug(String message, Map<String, Object> meta) {
        System.err.println("[agent] DEBUG " + message + " " + meta);
      }

      @Override
      public void info(String message, Map<String, Object> meta) {
        System.err.println("[agent] INFO " + message + " " + meta);
      }

      @Override
      public void warn(String message, Map<String, Object> meta) {
        System.err.println("[agent] WARN " + message + " " + meta);
      }

      @Override
      public void error(String message, Map<String, Object> meta) {
        System.err.println("[agent] ERROR " + message + " " + meta);
      }
    };
  }

  public static AgentApp bootstrap(AgentRegistry.AgentConfig config) {
    return new AgentApp(AgentRegistry.createRegistry(config));
  }

  public AgentRegistry registry() {
    return registry;
  }

  public ApiContext createApiContext(ParentExecutionContext parent) {
    ApiContext context = new ApiContext();
    context.correlationId = parent != null && parent.correlationId != null
        ? parent.correlationId
        : UUID.randomUUID().toString();
    context.executionId = UUID.randomUUID().toString();
    context.tenantId = parent == null ? null : parent.tenantId;
    context.userId = parent == null ? null : parent.userId;
    if (parent != null && parent.config != null) {
      context.config.putAll(parent.config);
    }
    context.logger = logger;
    context.packages.putAll(registry.packages());
    context.extra.put("providers", registry.providers());
    context.cases.putAll(materializeApiCases(context));
    return context;
  }

  public AgenticContext createAgenticContext(ParentExecutionContext parent) {
    AgenticContext context = new AgenticContext();
    context.correlationId = parent != null && parent.correlationId != null
        ? parent.correlationId
        : UUID.randomUUID().toString();
    context.executionId = UUID.randomUUID().toString();
    context.tenantId = parent == null ? null : parent.tenantId;
    context.userId = parent == null ? null : parent.userId;
    if (parent != null && parent.config != null) {
      context.config.putAll(parent.config);
    }
    context.logger = logger;
    context.packages.putAll(registry.packages());
    context.extra.put("providers", registry.providers());
    context.mcp = buildMcpRuntime(parent);
    context.cases.putAll(materializeAgenticCases(parent));
    return context;
  }

  public List<AgenticCatalogEntry> buildAgentCatalog(ParentExecutionContext parent) {
    return registry.buildCatalog(createAgenticContext(parent));
  }

  public AgenticCatalogEntry resolveTool(String toolName, ParentExecutionContext parent) {
    return registry.resolveTool(toolName, createAgenticContext(parent));
  }

  public Object executeTool(String toolName, Object rawInput, ParentExecutionContext parent) throws Exception {
    AgenticCatalogEntry entry = resolveTool(toolName, parent);
    if (entry == null) {
      throw new AppCaseError("NOT_FOUND", "Tool " + toolName + " is not registered in apps/agent");
    }

    if ("suggest-only".equals(entry.executionMode)) {
      throw new AppCaseError(
          "EXECUTION_MODE_RESTRICTED",
          "Tool " + entry.publishedName + " cannot execute directly in suggest-only mode"
      );
    }

    if (entry.requiresConfirmation && (parent == null || parent.confirmed != Boolean.TRUE)) {
      Map<String, Object> details = new LinkedHashMap<>();
      details.put("toolName", entry.publishedName);
      details.put("executionMode", entry.executionMode);
      throw new AppCaseError(
          "CONFIRMATION_REQUIRED",
          "Tool " + entry.publishedName + " requires explicit confirmation before execution",
          details
      );
    }

    AgenticContext context = createAgenticContext(parent);
    AgenticCatalogEntry runtimeEntry = registry.resolveTool(toolName, context);
    if (runtimeEntry == null) {
      throw new AppCaseError("NOT_FOUND", "Tool " + toolName + " could not be resolved at execution time");
    }

    Object typedInput = coerceToolInput(runtimeEntry, rawInput);
    @SuppressWarnings("unchecked")
    BaseAgenticCase.AgenticToolContract<Object, Object> tool =
        (BaseAgenticCase.AgenticToolContract<Object, Object>) runtimeEntry.definition.tool;
    return tool.execute(typedInput, context);
  }

  public String buildSystemPrompt(ParentExecutionContext parent) {
    List<AgenticCatalogEntry> catalog = new ArrayList<>(buildAgentCatalog(parent));
    catalog.sort((left, right) -> left.publishedName.compareTo(right.publishedName));

    List<String> confirmationTools = new ArrayList<>();
    List<String> suggestOnlyTools = new ArrayList<>();
    for (AgenticCatalogEntry entry : catalog) {
      if (entry.requiresConfirmation) {
        confirmationTools.add(entry.publishedName);
      }
      if ("suggest-only".equals(entry.executionMode)) {
        suggestOnlyTools.add(entry.publishedName);
      }
    }

    List<String> sections = new ArrayList<>();
    sections.add("You are operating java-task-board-agent through the APP agent host.");
    sections.add("Use the registry-derived tool contracts exactly as published. Canonical execution always delegates through ctx.cases and the registered API surfaces.");
    sections.add(confirmationTools.isEmpty()
        ? "No tools currently require confirmation."
        : "Tools requiring confirmation: " + String.join(", ", confirmationTools) + ".");
    if (!suggestOnlyTools.isEmpty()) {
      sections.add("Suggest-only tools: " + String.join(", ", suggestOnlyTools) + ".");
    }
    sections.add("Tool prompt fragments:");
    for (AgenticCatalogEntry entry : catalog) {
      sections.add(buildToolPromptFragment(entry));
    }
    return String.join("\n\n", sections);
  }

  public AppMcpServerInfo mcpServerInfo() {
    AppMcpServerInfo info = new AppMcpServerInfo();
    info.name = "java-task-board-agent";
    info.version = APP_VERSION;
    info.protocolVersion = MCP_PROTOCOL_VERSION;
    info.instructions = buildSystemPrompt(null);
    return info;
  }

  public AppMcpInitializeResult initializeMcp(AppMcpInitializeParams params, AppMcpRequestContext parent) {
    if (params != null
        && params.protocolVersion != null
        && !MCP_SUPPORTED_PROTOCOL_VERSIONS.contains(params.protocolVersion)) {
      throw new AppMcpProtocolError(
          -32602,
          "Unsupported MCP protocol version " + params.protocolVersion + ".",
          Map.of("supported", MCP_SUPPORTED_PROTOCOL_VERSIONS)
      );
    }

    AppMcpServerInfo info = mcpServerInfo();
    AppMcpInitializeResult result = new AppMcpInitializeResult();
    result.protocolVersion = info.protocolVersion;
    result.capabilities = Map.of(
        "tools", Map.of("listChanged", false),
        "resources", Map.of("listChanged", false)
    );
    result.serverInfo = Map.of(
        "name", info.name,
        "version", info.version
    );
    result.instructions = info.instructions;
    return result;
  }

  public List<AppMcpToolDescriptor> listMcpTools(AppMcpRequestContext parent) {
    AgenticContext context = createAgenticContext(ParentExecutionContext.forMcp(parent));
    List<AppMcpToolDescriptor> tools = new ArrayList<>();
    for (AgenticCatalogEntry entry : registry.listMcpEnabledTools(context)) {
      tools.add(toMcpToolDescriptor(entry));
    }
    return tools;
  }

  public List<AppMcpResourceDescriptor> listMcpResources(AppMcpRequestContext parent) {
    AgenticContext context = createAgenticContext(ParentExecutionContext.forMcp(parent));
    List<AppMcpResourceDescriptor> resources = new ArrayList<>();
    resources.add(toMcpSystemPromptDescriptor());
    for (AgenticCatalogEntry entry : registry.listMcpEnabledTools(context)) {
      resources.add(toMcpSemanticResourceDescriptor(entry));
    }
    return resources;
  }

  public AppMcpReadResourceResult readMcpResource(String uri, AppMcpRequestContext parent) throws Exception {
    AppMcpReadResourceResult result = new AppMcpReadResourceResult();
    result.contents = new ArrayList<>();

    if (buildSystemPromptResourceUri().equals(uri)) {
      result.contents.add(toMcpTextResourceContent(
          uri,
          buildSystemPrompt(ParentExecutionContext.forMcp(parent)),
          "text/markdown"
      ));
      return result;
    }

    AgenticContext context = createAgenticContext(ParentExecutionContext.forMcp(parent));
    AgenticCatalogEntry entry = null;
    for (AgenticCatalogEntry candidate : registry.listMcpEnabledTools(context)) {
      if (buildToolSemanticResourceUri(candidate).equals(uri)) {
        entry = candidate;
        break;
      }
    }

    if (entry == null) {
      throw new AppMcpProtocolError(
          -32004,
          "MCP resource " + uri + " is not published by apps/agent."
      );
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("app", "java-example-agent");
    payload.put("ref", Map.of(
        "domain", entry.ref.domain(),
        "caseName", entry.ref.caseName()
    ));
    payload.put("publishedName", entry.publishedName);
    payload.put("isMcpEnabled", entry.isMcpEnabled);
    payload.put("requiresConfirmation", entry.requiresConfirmation);
    payload.put("executionMode", entry.executionMode);
    payload.put("semanticSummary", buildToolSemanticSummary(entry));
    payload.put("promptFragment", buildToolPromptFragment(entry));
    payload.put("definition", stripDefinitionForProjection(entry));

    result.contents.add(toMcpTextResourceContent(
        uri,
        MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(payload),
        "application/json"
    ));
    return result;
  }

  public AppMcpCallResult callMcpTool(String name, Object args, AppMcpRequestContext parent) throws Exception {
    ExecuteEnvelope envelope = toExecutionEnvelope(args);
    try {
      AgenticCatalogEntry resolved = resolveMcpTool(name, ParentExecutionContext.forMcp(parent, envelope.confirmed));
      if (resolved == null) {
        return toMcpErrorResult(new AppCaseError(
            "NOT_FOUND",
            "MCP tool " + name + " is not published by apps/agent"
        ));
      }

      Object data = executeTool(name, envelope.input, ParentExecutionContext.forMcp(parent, envelope.confirmed));
      return toMcpSuccessResult(resolved.publishedName, data);
    } catch (AppCaseError error) {
      return toMcpErrorResult(error);
    }
  }

  public Map<String, Integer> validateAgenticRuntime() throws Exception {
    AgenticContext context = createAgenticContext(new ParentExecutionContext("agent-runtime-validation"));
    List<AgenticCatalogEntry> catalog = registry.buildCatalog(context);
    if (catalog.isEmpty()) {
      throw new IllegalStateException("apps/agent must register at least one agentic tool");
    }

    if (registry.mcpAdapters() == null || registry.mcpAdapters().stdio == null) {
      throw new IllegalStateException(
          "apps/agent must register a concrete stdio MCP adapter in _providers.mcpAdapters"
      );
    }

    if (registry.mcpAdapters().http == null) {
      throw new IllegalStateException(
          "apps/agent must register a concrete remote HTTP MCP adapter in _providers.mcpAdapters"
      );
    }

    Set<String> publishedNames = new java.util.LinkedHashSet<>();
    for (AgenticCatalogEntry entry : catalog) {
      if (!publishedNames.add(entry.publishedName)) {
        throw new IllegalStateException("apps/agent published duplicate tool name " + entry.publishedName);
      }

      AgenticCatalogEntry resolved = registry.resolveTool(entry.publishedName, context);
      if (resolved == null) {
        throw new IllegalStateException("apps/agent failed to resolve published tool " + entry.publishedName);
      }

      AppMcpToolDescriptor descriptor = toMcpToolDescriptor(entry);
      if (descriptor.description == null || descriptor.description.isBlank()) {
        throw new IllegalStateException(
            "apps/agent failed to project semantic summary for " + entry.publishedName
        );
      }

      String promptFragment = buildToolPromptFragment(entry);
      if (!promptFragment.contains(entry.definition.prompt.purpose)) {
        throw new IllegalStateException(
            "apps/agent failed to project prompt fragment for " + entry.publishedName
        );
      }
    }

    for (AgenticCaseRef ref : registry.listAgenticCases()) {
      registry.instantiateAgentic(ref, context).test();
    }

    String globalPrompt = buildSystemPrompt(new ParentExecutionContext("agent-runtime-validation"));
    if (globalPrompt.isBlank()) {
      throw new IllegalStateException("apps/agent must project a non-empty global system prompt");
    }

    List<AppMcpResourceDescriptor> resources = listMcpResources(new AppMcpRequestContext());
    long mcpEnabled = catalog.stream().filter(entry -> entry.isMcpEnabled).count();
    if (resources.size() < mcpEnabled + 1) {
      throw new IllegalStateException(
          "apps/agent must publish a system prompt resource and one semantic resource per MCP-enabled tool"
      );
    }

    Map<String, Integer> summary = new LinkedHashMap<>();
    summary.put("tools", catalog.size());
    summary.put("mcpEnabled", (int) mcpEnabled);
    summary.put("requireConfirmation", (int) catalog.stream().filter(entry -> entry.requiresConfirmation).count());
    return summary;
  }

  public void publishMcp() throws Exception {
    validateAgenticRuntime();
    registry.mcpAdapters().stdio.serve(createMcpServer());
  }

  public HttpServer startAgent() throws Exception {
    Map<String, Integer> summary = validateAgenticRuntime();
    int port = ((Number) registry.providers().get("port")).intValue();
    HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
    server.createContext("/", exchange -> {
      try {
        handle(exchange);
      } catch (Exception error) {
        logger.error("Unhandled agent scaffold error", errorMeta(error));
        sendStructuredError(exchange, 500, "INTERNAL", "Internal agent scaffold error.", null);
      }
    });
    server.start();

    Map<String, Object> meta = new LinkedHashMap<>();
    meta.put("port", port);
    meta.putAll(summary);
    logger.info("Agent scaffold started", meta);
    return server;
  }

  private void handle(HttpExchange exchange) throws Exception {
    String method = exchange.getRequestMethod().toUpperCase();
    String path = exchange.getRequestURI().getPath();
    List<String> pathSegments = pathSegments(path);

    if ("OPTIONS".equals(method)) {
      exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
      exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "content-type");
      exchange.sendResponseHeaders(204, -1);
      return;
    }

    if (handleRemoteMcp(exchange, method, path)) {
      return;
    }

    if ("GET".equals(method) && "/health".equals(path)) {
      sendJson(exchange, 200, Map.of(
          "ok", true,
          "app", "java-example-agent",
          "status", "ready"
      ));
      return;
    }

    if ("GET".equals(method) && "/manifest".equals(path)) {
      List<AgenticCatalogEntry> catalog = buildAgentCatalog(null);
      sendJson(exchange, 200, buildManifestPayload(catalog));
      return;
    }

    if ("GET".equals(method) && "/catalog".equals(path)) {
      List<AgenticCatalogEntry> catalog = buildAgentCatalog(null);
      Map<String, Object> data = new LinkedHashMap<>();
      data.put("systemPrompt", buildSystemPrompt(null));
      data.put("resources", listMcpResources(new AppMcpRequestContext()));

      List<Object> tools = new ArrayList<>();
      for (AgenticCatalogEntry entry : catalog) {
        tools.add(toCatalogDocument(entry));
      }
      data.put("tools", tools);
      sendJson(exchange, 200, Map.of("success", true, "data", data));
      return;
    }

    if ("POST".equals(method)
        && pathSegments.size() == 3
        && "tools".equals(pathSegments.get(0))
        && "execute".equals(pathSegments.get(2))) {
      String toolName = java.net.URLDecoder.decode(pathSegments.get(1), StandardCharsets.UTF_8);
      Object body;
      try {
        body = readJsonBody(exchange);
      } catch (Exception error) {
        sendStructuredError(exchange, 400, "INVALID_REQUEST", error.getMessage(), null);
        return;
      }

      ExecuteEnvelope envelope = toExecutionEnvelope(body);
      try {
        ParentExecutionContext parent = new ParentExecutionContext();
        parent.confirmed = envelope.confirmed;
        AgenticCatalogEntry resolved = resolveTool(toolName, parent);
        if (resolved == null) {
          throw new AppCaseError("NOT_FOUND", "Tool " + toolName + " is not registered in apps/agent");
        }

        Object data = executeTool(toolName, envelope.input, parent);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("toolName", resolved.publishedName);
        meta.put("requiresConfirmation", resolved.requiresConfirmation);
        meta.put("executionMode", resolved.executionMode);
        sendJson(exchange, 200, Map.of(
            "success", true,
            "data", data,
            "meta", meta
        ));
      } catch (AppCaseError error) {
        sendStructuredError(
            exchange,
            mapErrorCodeToStatus(error.code()),
            error.code(),
            error.getMessage(),
            error.details()
        );
      }
      return;
    }

    sendStructuredError(
        exchange,
        404,
        "NOT_FOUND",
        "Route not found in agent scaffold.",
        Map.of("method", method, "path", path)
    );
  }

  private boolean handleRemoteMcp(HttpExchange exchange, String method, String path) throws Exception {
    AgentMcpHttpAdapter adapter = registry.mcpAdapters().http;
    if (adapter == null || !adapter.endpointPath().equals(path)) {
      return false;
    }

    String bodyText = null;
    if ("POST".equals(method)) {
      byte[] bytes = exchange.getRequestBody().readAllBytes();
      bodyText = bytes.length == 0 ? null : new String(bytes, StandardCharsets.UTF_8).trim();
    }

    AppMcpHttpExchange request = new AppMcpHttpExchange();
    request.method = method;
    request.path = path;
    request.headers = normalizeHeaders(exchange);
    request.bodyText = bodyText;

    AppMcpHttpResponse response = adapter.handle(request, createMcpServer());
    sendMcpHttpResponse(exchange, response == null ? notFoundMcpResponse() : response);
    return true;
  }

  private AppMcpServer createMcpServer() {
    return new AppMcpServer() {
      @Override
      public AppMcpServerInfo serverInfo() {
        return mcpServerInfo();
      }

      @Override
      public AppMcpInitializeResult initialize(
          AppMcpInitializeParams params,
          AppMcpRequestContext parent
      ) {
        return initializeMcp(params, parent);
      }

      @Override
      public List<AppMcpToolDescriptor> listTools(AppMcpRequestContext parent) {
        return listMcpTools(parent);
      }

      @Override
      public List<AppMcpResourceDescriptor> listResources(AppMcpRequestContext parent) {
        return listMcpResources(parent);
      }

      @Override
      public AppMcpReadResourceResult readResource(String uri, AppMcpRequestContext parent) throws Exception {
        return readMcpResource(uri, parent);
      }

      @Override
      public AppMcpCallResult callTool(String name, Object args, AppMcpRequestContext parent) throws Exception {
        return callMcpTool(name, args, parent);
      }
    };
  }

  private Map<String, Object> materializeApiCases(ApiContext context) {
    Map<String, Object> result = new LinkedHashMap<>();
    for (Map.Entry<String, Map<String, AppCaseSurfaces>> domainEntry : registry.cases().entrySet()) {
      Map<String, Object> domainCases = new LinkedHashMap<>();
      for (Map.Entry<String, AppCaseSurfaces> caseEntry : domainEntry.getValue().entrySet()) {
        Map<String, Object> surfaces = new LinkedHashMap<>();
        if (caseEntry.getValue().api != null) {
          surfaces.put("api", caseEntry.getValue().api.create(context));
        }
        domainCases.put(caseEntry.getKey(), surfaces);
      }
      result.put(domainEntry.getKey(), domainCases);
    }
    return result;
  }

  private Map<String, Object> materializeAgenticCases(ParentExecutionContext parent) {
    Map<String, Object> result = new LinkedHashMap<>();
    for (Map.Entry<String, Map<String, AppCaseSurfaces>> domainEntry : registry.cases().entrySet()) {
      Map<String, Object> domainCases = new LinkedHashMap<>();
      for (Map.Entry<String, AppCaseSurfaces> caseEntry : domainEntry.getValue().entrySet()) {
        Map<String, Object> surfaces = new LinkedHashMap<>();
        if (caseEntry.getValue().api != null) {
          surfaces.put("api", caseEntry.getValue().api.create(createApiContext(parent)));
        }
        domainCases.put(caseEntry.getKey(), surfaces);
      }
      result.put(domainEntry.getKey(), domainCases);
    }
    return result;
  }

  private Object buildMcpRuntime(ParentExecutionContext parent) {
    Map<String, Object> runtime = new LinkedHashMap<>();
    runtime.put("serverName", "java-task-board-agent");
    runtime.put("version", APP_VERSION);
    runtime.put("protocolVersion", MCP_PROTOCOL_VERSION);
    runtime.put("transport", parent != null && parent.mcp != null && parent.mcp.transport != null
        ? parent.mcp.transport
        : "http");
    if (parent != null && parent.mcp != null) {
      if (parent.mcp.sessionId != null) {
        runtime.put("sessionId", parent.mcp.sessionId);
      }
      if (parent.mcp.clientInfo != null) {
        runtime.put("clientInfo", Map.of(
            "name", parent.mcp.clientInfo.name(),
            "version", parent.mcp.clientInfo.version()
        ));
      }
    }
    return runtime;
  }

  private ExecuteEnvelope toExecutionEnvelope(Object body) {
    ExecuteEnvelope envelope = new ExecuteEnvelope();
    if (!(body instanceof Map<?, ?> map)) {
      envelope.input = body;
      envelope.confirmed = false;
      return envelope;
    }

    if (map.containsKey("confirmed")) {
      envelope.confirmed = Boolean.TRUE.equals(map.get("confirmed"));
      if (map.containsKey("input")) {
        envelope.input = map.get("input");
      } else {
        Map<String, Object> rest = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
          if (!"confirmed".equals(entry.getKey())) {
            rest.put(String.valueOf(entry.getKey()), entry.getValue());
          }
        }
        envelope.input = rest;
      }
      return envelope;
    }

    if (map.containsKey("input")) {
      envelope.input = map.get("input");
      envelope.confirmed = false;
      return envelope;
    }

    envelope.input = body;
    envelope.confirmed = false;
    return envelope;
  }

  private AgenticCatalogEntry resolveMcpTool(String toolName, ParentExecutionContext parent) {
    AgenticCatalogEntry entry = resolveTool(toolName, parent);
    return entry != null && entry.isMcpEnabled ? entry : null;
  }

  private static List<String> normalizeTextItems(List<String> values) {
    if (values == null || values.isEmpty()) {
      return List.of();
    }

    java.util.LinkedHashSet<String> items = new java.util.LinkedHashSet<>();
    for (String value : values) {
      if (value != null && !value.trim().isBlank()) {
        items.add(value.trim());
      }
    }
    return new ArrayList<>(items);
  }

  private static String humanizeIdentifier(String value) {
    String[] parts = value.split("[_-]+");
    List<String> words = new ArrayList<>();
    for (String part : parts) {
      if (part.isBlank()) {
        continue;
      }
      words.add(Character.toUpperCase(part.charAt(0)) + part.substring(1));
    }
    return String.join(" ", words);
  }

  private static String joinSentence(String label, List<String> values) {
    List<String> normalized = normalizeTextItems(values);
    if (normalized.isEmpty()) {
      return null;
    }
    return label + ": " + String.join("; ", normalized) + ".";
  }

  private Map<String, Object> stripDefinitionForProjection(AgenticCatalogEntry entry) {
    Map<String, Object> tool = new LinkedHashMap<>();
    tool.put("name", entry.definition.tool.name);
    tool.put("description", entry.definition.tool.description);
    tool.put("inputSchema", entry.definition.tool.inputSchema);
    tool.put("outputSchema", entry.definition.tool.outputSchema);
    tool.put("isMutating", Boolean.TRUE.equals(entry.definition.tool.isMutating));
    tool.put("requiresConfirmation", Boolean.TRUE.equals(entry.definition.tool.requiresConfirmation));

    Map<String, Object> definition = new LinkedHashMap<>();
    definition.put("discovery", entry.definition.discovery);
    definition.put("context", entry.definition.context);
    definition.put("prompt", entry.definition.prompt);
    definition.put("tool", tool);
    definition.put("mcp", entry.definition.mcp);
    definition.put("rag", entry.definition.rag);
    definition.put("policy", entry.definition.policy);
    definition.put("examples", projectExamples(entry));
    return definition;
  }

  private String buildToolSemanticSummary(AgenticCatalogEntry entry) {
    List<String> parts = new ArrayList<>();
    parts.add(entry.definition.prompt.purpose.trim());
    addIfNotNull(parts, joinSentence("Use when", concat(
        entry.definition.prompt.whenToUse,
        entry.definition.discovery.intents
    )));
    addIfNotNull(parts, joinSentence("Do not use when", entry.definition.prompt.whenNotToUse));
    addIfNotNull(parts, joinSentence("Preconditions", entry.definition.context.preconditions));
    addIfNotNull(parts, joinSentence("Constraints", concat(
        entry.definition.context.constraints,
        entry.definition.prompt.constraints,
        entry.definition.policy == null ? List.of() : entry.definition.policy.limits
    )));
    if (entry.definition.prompt.expectedOutcome != null
        && !entry.definition.prompt.expectedOutcome.isBlank()) {
      parts.add("Expected outcome: " + entry.definition.prompt.expectedOutcome.trim() + ".");
    }
    return String.join(" ", parts);
  }

  private String buildToolPromptFragment(AgenticCatalogEntry entry) {
    List<String> lines = new ArrayList<>();
    lines.add("Tool " + entry.publishedName + ": " + entry.definition.prompt.purpose);
    addIfNotNull(lines, joinSentence("Use when", concat(
        entry.definition.prompt.whenToUse,
        entry.definition.discovery.intents
    )));
    addIfNotNull(lines, joinSentence("Do not use when", entry.definition.prompt.whenNotToUse));
    addIfNotNull(lines, joinSentence("Aliases", entry.definition.discovery.aliases));
    addIfNotNull(lines, joinSentence("Capabilities", entry.definition.discovery.capabilities));
    addIfNotNull(lines, joinSentence("Dependencies", entry.definition.context.dependencies));
    addIfNotNull(lines, joinSentence("Preconditions", entry.definition.context.preconditions));
    addIfNotNull(lines, joinSentence("Constraints", concat(
        entry.definition.context.constraints,
        entry.definition.prompt.constraints,
        entry.definition.policy == null ? List.of() : entry.definition.policy.limits
    )));
    addIfNotNull(lines, joinSentence("Reasoning hints", entry.definition.prompt.reasoningHints));
    if (entry.definition.rag != null) {
      addIfNotNull(lines, joinSentence("RAG topics", entry.definition.rag.topics));
      List<String> ragResources = new ArrayList<>();
      for (BaseAgenticCase.RagResource resource : entry.definition.rag.resources) {
        String value = resource.kind + ":" + resource.ref;
        if (resource.description != null && !resource.description.isBlank()) {
          value += " (" + resource.description + ")";
        }
        ragResources.add(value);
      }
      addIfNotNull(lines, joinSentence("RAG resources", ragResources));
      addIfNotNull(lines, joinSentence("RAG hints", entry.definition.rag.hints));
    }
    lines.add("Execution mode: " + entry.executionMode + ".");
    lines.add("Requires confirmation: " + (entry.requiresConfirmation ? "yes" : "no") + ".");
    if (entry.definition.prompt.expectedOutcome != null
        && !entry.definition.prompt.expectedOutcome.isBlank()) {
      lines.add("Expected outcome: " + entry.definition.prompt.expectedOutcome + ".");
    }
    return String.join("\n", lines);
  }

  private String buildSystemPromptResourceUri() {
    return "app://agent/system/prompt";
  }

  private String buildToolSemanticResourceUri(AgenticCatalogEntry entry) {
    return "app://agent/tools/" + entry.publishedName + "/semantic";
  }

  private Map<String, Object> toCatalogDocument(AgenticCatalogEntry entry) {
    Map<String, Object> resources = new LinkedHashMap<>();
    resources.put("semantic", buildToolSemanticResourceUri(entry));

    Map<String, Object> ref = new LinkedHashMap<>();
    ref.put("domain", entry.ref.domain());
    ref.put("caseName", entry.ref.caseName());

    Map<String, Object> document = new LinkedHashMap<>();
    document.put("ref", ref);
    document.put("publishedName", entry.publishedName);
    document.put("isMcpEnabled", entry.isMcpEnabled);
    document.put("requiresConfirmation", entry.requiresConfirmation);
    document.put("executionMode", entry.executionMode);
    document.put("semanticSummary", buildToolSemanticSummary(entry));
    document.put("promptFragment", buildToolPromptFragment(entry));
    document.put("resources", resources);
    document.put("definition", stripDefinitionForProjection(entry));
    return document;
  }

  private Map<String, Object> toMcpSemanticAnnotations(AgenticCatalogEntry entry) {
    Map<String, Object> appSemantic = new LinkedHashMap<>();
    appSemantic.put("summary", buildToolSemanticSummary(entry));
    appSemantic.put("discovery", entry.definition.discovery);
    appSemantic.put("context", entry.definition.context);
    appSemantic.put("prompt", entry.definition.prompt);
    appSemantic.put("policy", entry.definition.policy);
    appSemantic.put("rag", entry.definition.rag);
    appSemantic.put("exampleNames", entry.definition.examples == null
        ? List.of()
        : entry.definition.examples.stream().map(example -> example.name).toList());
    appSemantic.put("resourceUri", buildToolSemanticResourceUri(entry));

    Map<String, Object> annotations = new LinkedHashMap<>();
    annotations.put("readOnlyHint", !Boolean.TRUE.equals(entry.definition.tool.isMutating));
    annotations.put("destructiveHint", Boolean.TRUE.equals(entry.definition.tool.isMutating));
    annotations.put("requiresConfirmation", entry.requiresConfirmation);
    annotations.put("executionMode", entry.executionMode);
    annotations.put("appSemantic", appSemantic);
    return annotations;
  }

  private AppMcpToolDescriptor toMcpToolDescriptor(AgenticCatalogEntry entry) {
    String summary = buildToolSemanticSummary(entry);
    AppMcpToolDescriptor descriptor = new AppMcpToolDescriptor();
    descriptor.name = entry.publishedName;
    descriptor.title = entry.definition.mcp != null
        && entry.definition.mcp.title != null
        && !entry.definition.mcp.title.isBlank()
        ? entry.definition.mcp.title
        : humanizeIdentifier(entry.publishedName);
    descriptor.description = entry.definition.mcp != null
        && entry.definition.mcp.description != null
        && !entry.definition.mcp.description.isBlank()
        ? entry.definition.mcp.description + " " + summary
        : summary;
    descriptor.inputSchema = entry.definition.tool.inputSchema;
    descriptor.outputSchema = entry.definition.tool.outputSchema;
    descriptor.annotations = toMcpSemanticAnnotations(entry);
    return descriptor;
  }

  private AppMcpResourceDescriptor toMcpSemanticResourceDescriptor(AgenticCatalogEntry entry) {
    AppMcpResourceDescriptor descriptor = new AppMcpResourceDescriptor();
    descriptor.uri = buildToolSemanticResourceUri(entry);
    descriptor.name = entry.publishedName + "_semantic";
    descriptor.title = humanizeIdentifier(entry.publishedName) + " Semantic Contract";
    descriptor.description = "Complete APP agentic definition projected automatically from the registry for "
        + entry.publishedName
        + ".";
    descriptor.mimeType = "application/json";
    descriptor.annotations = Map.of(
        "toolName", entry.publishedName,
        "executionMode", entry.executionMode,
        "requiresConfirmation", entry.requiresConfirmation
    );
    return descriptor;
  }

  private AppMcpResourceDescriptor toMcpSystemPromptDescriptor() {
    AppMcpResourceDescriptor descriptor = new AppMcpResourceDescriptor();
    descriptor.uri = buildSystemPromptResourceUri();
    descriptor.name = "agent_system_prompt";
    descriptor.title = "Agent System Prompt";
    descriptor.description = "Host-level system prompt composed automatically from the registered tool fragments.";
    descriptor.mimeType = "text/markdown";
    descriptor.annotations = Map.of("kind", "system-prompt");
    return descriptor;
  }

  private AppMcpCallResult toMcpSuccessResult(String toolName, Object data) {
    AppMcpCallResult result = new AppMcpCallResult();
    result.content = List.of(toMcpTextContent("Tool " + toolName + " executed successfully."));
    result.structuredContent = data;
    result.isError = false;
    return result;
  }

  private AppMcpCallResult toMcpErrorResult(AppCaseError error) {
    AppMcpCallResult result = new AppMcpCallResult();
    result.content = List.of(toMcpTextContent(error.getMessage()));
    result.structuredContent = Map.of(
        "success", false,
        "error", error.toAppError()
    );
    result.isError = true;
    return result;
  }

  private static AppMcpTextContent toMcpTextContent(String text) {
    AppMcpTextContent content = new AppMcpTextContent();
    content.text = text;
    return content;
  }

  private static AppMcpTextResourceContent toMcpTextResourceContent(String uri, String text, String mimeType) {
    AppMcpTextResourceContent content = new AppMcpTextResourceContent();
    content.uri = uri;
    content.text = text;
    content.mimeType = mimeType;
    return content;
  }

  private static List<String> concat(List<String>... groups) {
    List<String> values = new ArrayList<>();
    for (List<String> group : groups) {
      if (group != null) {
        values.addAll(group);
      }
    }
    return values;
  }

  private List<Map<String, Object>> projectExamples(AgenticCatalogEntry entry) {
    List<Map<String, Object>> examples = new ArrayList<>();
    if (entry.definition.examples == null) {
      return examples;
    }

    for (Object value : entry.definition.examples) {
      if (!(value instanceof BaseAgenticCase.AgenticExample<?, ?> example)) {
        continue;
      }

      Map<String, Object> projected = new LinkedHashMap<>();
      projected.put("name", example.name);
      projected.put("description", example.description);
      projected.put("input", serializeCaseValue(entry.ref.caseName(), example.input, true));
      projected.put("output", serializeCaseValue(entry.ref.caseName(), example.output, false));
      projected.put("notes", example.notes == null ? List.of() : example.notes);
      examples.add(projected);
    }

    return examples;
  }

  private Object serializeCaseValue(String caseName, Object value, boolean input) {
    if (value == null) {
      return null;
    }

    if ("task_create".equals(caseName)) {
      if (input && value instanceof TaskCreateDomainCase.TaskCreateInput typed) {
        Map<String, Object> projected = new LinkedHashMap<>();
        projected.put("title", typed.title());
        if (typed.description() != null && !typed.description().isBlank()) {
          projected.put("description", typed.description());
        }
        return projected;
      }
      if (!input && value instanceof TaskCreateDomainCase.TaskCreateOutput typed) {
        return typed.toMap();
      }
    }

    if ("task_list".equals(caseName)) {
      if (input && value instanceof TaskListDomainCase.TaskListInput) {
        return Map.of();
      }
      if (!input && value instanceof TaskListDomainCase.TaskListOutput typed) {
        return typed.toMap();
      }
    }

    if ("task_move".equals(caseName)) {
      if (input && value instanceof TaskMoveDomainCase.TaskMoveInput typed) {
        return Map.of(
            "taskId", typed.taskId(),
            "targetStatus", typed.targetStatus()
        );
      }
      if (!input && value instanceof TaskMoveDomainCase.TaskMoveOutput typed) {
        return typed.toMap();
      }
    }

    return value;
  }

  private static void addIfNotNull(List<String> target, String value) {
    if (value != null && !value.isBlank()) {
      target.add(value);
    }
  }

  private static Map<String, Object> errorMeta(Throwable error) {
    Map<String, Object> meta = new LinkedHashMap<>();
    meta.put("error", error == null || error.getMessage() == null ? "unknown" : error.getMessage());
    if (error != null) {
      meta.put("type", error.getClass().getName());
    }
    return meta;
  }

  private static List<String> pathSegments(String path) {
    List<String> segments = new ArrayList<>();
    for (String segment : path.split("/")) {
      if (!segment.isBlank()) {
        segments.add(segment);
      }
    }
    return segments;
  }

  private static int mapErrorCodeToStatus(String code) {
    return switch (code) {
      case "INVALID_REQUEST", "VALIDATION_FAILED" -> 400;
      case "NOT_FOUND" -> 404;
      case "CONFIRMATION_REQUIRED", "EXECUTION_MODE_RESTRICTED", "CONFLICT" -> 409;
      default -> 500;
    };
  }

  private static Object readJsonBody(HttpExchange exchange) throws Exception {
    byte[] bytes = exchange.getRequestBody().readAllBytes();
    if (bytes.length == 0) {
      return null;
    }

    String content = new String(bytes, StandardCharsets.UTF_8).trim();
    if (content.isBlank()) {
      return null;
    }

    return MAPPER.readValue(content, Object.class);
  }

  private static Map<String, String> normalizeHeaders(HttpExchange exchange) {
    Map<String, String> headers = new LinkedHashMap<>();
    for (Map.Entry<String, List<String>> header : exchange.getRequestHeaders().entrySet()) {
      headers.put(header.getKey().toLowerCase(), String.join(", ", header.getValue()));
    }
    return headers;
  }

  private static void sendMcpHttpResponse(HttpExchange exchange, AppMcpHttpResponse response) throws IOException {
    if (response.headers != null) {
      for (Map.Entry<String, String> header : response.headers.entrySet()) {
        exchange.getResponseHeaders().set(header.getKey(), header.getValue());
      }
    }

    byte[] body = response.bodyText == null
        ? new byte[0]
        : response.bodyText.getBytes(StandardCharsets.UTF_8);
    exchange.sendResponseHeaders(response.statusCode, response.bodyText == null ? -1 : body.length);
    if (response.bodyText != null) {
      try (OutputStream outputStream = exchange.getResponseBody()) {
        outputStream.write(body);
      }
    }
  }

  private static AppMcpHttpResponse notFoundMcpResponse() {
    AppMcpHttpResponse response = new AppMcpHttpResponse();
    response.statusCode = 404;
    response.headers = Map.of("cache-control", "no-store");
    return response;
  }

  private void sendJson(HttpExchange exchange, int statusCode, Object body) throws IOException {
    byte[] bytes = MAPPER.writerWithDefaultPrettyPrinter()
        .writeValueAsString(body)
        .getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
    exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "content-type");
    exchange.getResponseHeaders().set("Cache-Control", "no-store");
    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
    exchange.sendResponseHeaders(statusCode, bytes.length);
    try (OutputStream outputStream = exchange.getResponseBody()) {
      outputStream.write(bytes);
    }
  }

  private void sendStructuredError(
      HttpExchange exchange,
      int statusCode,
      String code,
      String message,
      Object details
  ) throws IOException {
    Map<String, Object> error = new LinkedHashMap<>();
    error.put("code", code);
    error.put("message", message);
    if (details != null) {
      error.put("details", details);
    }
    sendJson(exchange, statusCode, Map.of("success", false, "error", error));
  }

  private Object coerceToolInput(AgenticCatalogEntry entry, Object rawInput) {
    String caseName = entry.ref.caseName();
    if ("task_create".equals(caseName)) {
      if (rawInput instanceof TaskCreateDomainCase.TaskCreateInput typed) {
        return typed;
      }
      if (rawInput instanceof Map<?, ?> map) {
        @SuppressWarnings("unchecked")
        Map<String, Object> typedMap = (Map<String, Object>) map;
        return TaskCreateDomainCase.TaskCreateInput.fromMap(typedMap);
      }
      throw new AppCaseError("VALIDATION_FAILED", "task_create expects an object input");
    }

    if ("task_list".equals(caseName)) {
      if (rawInput instanceof TaskListDomainCase.TaskListInput typed) {
        return typed;
      }
      if (rawInput == null) {
        return new TaskListDomainCase.TaskListInput();
      }
      if (rawInput instanceof Map<?, ?> map) {
        @SuppressWarnings("unchecked")
        Map<String, Object> typedMap = (Map<String, Object>) map;
        return TaskListDomainCase.TaskListInput.fromMap(typedMap);
      }
      throw new AppCaseError("VALIDATION_FAILED", "task_list expects an object input");
    }

    if ("task_move".equals(caseName)) {
      if (rawInput instanceof TaskMoveDomainCase.TaskMoveInput typed) {
        return typed;
      }
      if (rawInput instanceof Map<?, ?> map) {
        @SuppressWarnings("unchecked")
        Map<String, Object> typedMap = (Map<String, Object>) map;
        return TaskMoveDomainCase.TaskMoveInput.fromMap(typedMap);
      }
      throw new AppCaseError("VALIDATION_FAILED", "task_move expects an object input");
    }

    return rawInput;
  }

  private Map<String, Object> buildManifestPayload(List<AgenticCatalogEntry> catalog) {
    List<String> tools = new ArrayList<>();
    List<String> mcpEnabledTools = new ArrayList<>();
    for (AgenticCatalogEntry entry : catalog) {
      tools.add(entry.publishedName);
      if (entry.isMcpEnabled) {
        mcpEnabledTools.add(entry.publishedName);
      }
    }

    Map<String, Object> mcp = new LinkedHashMap<>();
    mcp.put("stdio", registry.mcpAdapters().stdio.transport());
    mcp.put("remote", registry.mcpAdapters().http.transport());
    mcp.put("remotePath", registry.mcpAdapters().http.endpointPath());

    Map<String, Object> transports = new LinkedHashMap<>();
    transports.put("http", true);
    transports.put("mcp", mcp);

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("app", "java-example-agent");
    payload.put("port", registry.providers().get("port"));
    payload.put("registeredDomains", registry.cases().keySet());
    payload.put("packages", registry.packages().keySet());
    payload.put("tools", tools);
    payload.put("mcpEnabledTools", mcpEnabledTools);
    payload.put("transports", transports);
    payload.put("systemPrompt", buildSystemPrompt(null));
    return payload;
  }

  private static final class ExecuteEnvelope {
    private Object input;
    private boolean confirmed;
  }

  public static final class ParentExecutionContext {
    private String correlationId;
    private String tenantId;
    private String userId;
    private Map<String, Object> config;
    private Boolean confirmed;
    private AppMcpRequestContext mcp;

    private ParentExecutionContext() {}

    private ParentExecutionContext(String correlationId) {
      this.correlationId = correlationId;
    }

    private static ParentExecutionContext forMcp(AppMcpRequestContext parent) {
      return forMcp(parent, false);
    }

    private static ParentExecutionContext forMcp(AppMcpRequestContext parent, boolean confirmed) {
      ParentExecutionContext context = new ParentExecutionContext();
      context.confirmed = confirmed;
      context.mcp = parent;
      if (parent != null) {
        context.correlationId = parent.correlationId;
      }
      return context;
    }
  }
}
