package core;

import core.BaseDomainCase.AppSchema;
import core.BaseDomainCase.DomainExample;
import core.shared.AppBaseContext;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public abstract class BaseAgenticCase<TInput, TOutput> {
  public static class AgenticContext extends AppBaseContext {
    public Map<String, Object> cases = new LinkedHashMap<>();
    public Map<String, Object> packages = new LinkedHashMap<>();
    public Object mcp;
    public Map<String, Object> extra = new LinkedHashMap<>();
  }

  public static class AgenticDiscovery {
    public String name;
    public String description;
    public String category;
    public List<String> tags = List.of();
    public List<String> aliases = List.of();
    public List<String> capabilities = List.of();
    public List<String> intents = List.of();
  }

  public static class AgenticExecutionContext {
    public Boolean requiresAuth;
    public Boolean requiresTenant;
    public List<String> dependencies = List.of();
    public List<String> preconditions = List.of();
    public List<String> constraints = List.of();
    public List<String> notes = List.of();
  }

  public static class AgenticPrompt {
    public String purpose;
    public List<String> whenToUse = List.of();
    public List<String> whenNotToUse = List.of();
    public List<String> constraints = List.of();
    public List<String> reasoningHints = List.of();
    public String expectedOutcome;
  }

  @FunctionalInterface
  public interface AgenticExecutor<TInput, TOutput> {
    TOutput execute(TInput input, AgenticContext ctx) throws Exception;
  }

  public static class AgenticToolContract<TInput, TOutput> {
    public String name;
    public String description;
    public AppSchema inputSchema;
    public AppSchema outputSchema;
    public Boolean isMutating;
    public Boolean requiresConfirmation;
    public AgenticExecutor<TInput, TOutput> executor;

    public TOutput execute(TInput input, AgenticContext ctx) throws Exception {
      return executor.execute(input, ctx);
    }
  }

  public static class AgenticMcpContract {
    public Boolean enabled;
    public String name;
    public String title;
    public String description;
    public Map<String, Object> metadata = Map.of();
  }

  public static class RagResource {
    public String kind;
    public String ref;
    public String description;
  }

  public static class AgenticRagContract {
    public List<String> topics = List.of();
    public List<RagResource> resources = List.of();
    public List<String> hints = List.of();
    public String scope;
    public String mode;
  }

  public static class AgenticPolicy {
    public Boolean requireConfirmation;
    public Boolean requireAuth;
    public Boolean requireTenant;
    public String riskLevel;
    public String executionMode;
    public List<String> limits = List.of();
  }

  public static class AgenticExample<TInput, TOutput> {
    public String name;
    public String description;
    public TInput input;
    public TOutput output;
    public List<String> notes = List.of();
  }

  public static class AgenticDefinition<TInput, TOutput> {
    public AgenticDiscovery discovery;
    public AgenticExecutionContext context;
    public AgenticPrompt prompt;
    public AgenticToolContract<TInput, TOutput> tool;
    public AgenticMcpContract mcp;
    public AgenticRagContract rag;
    public AgenticPolicy policy;
    public List<AgenticExample<TInput, TOutput>> examples = List.of();
  }

  protected final AgenticContext ctx;

  protected BaseAgenticCase(AgenticContext ctx) {
    this.ctx = ctx;
  }

  protected BaseDomainCase<TInput, TOutput> domain() {
    return null;
  }

  public abstract AgenticDiscovery discovery();
  public abstract AgenticExecutionContext context();
  public abstract AgenticPrompt prompt();
  public abstract AgenticToolContract<TInput, TOutput> tool();

  public void test() throws Exception {}

  public AgenticMcpContract mcp() {
    return null;
  }

  public AgenticRagContract rag() {
    return null;
  }

  public AgenticPolicy policy() {
    return null;
  }

  public List<AgenticExample<TInput, TOutput>> examples() {
    List<DomainExample<TInput, TOutput>> domainExamples =
        domain() == null ? List.of() : domain().examples();

    if (domainExamples == null || domainExamples.isEmpty()) {
      return List.of();
    }

    List<AgenticExample<TInput, TOutput>> result = new ArrayList<>();
    for (DomainExample<TInput, TOutput> example : domainExamples) {
      if (example.output == null) {
        continue;
      }

      AgenticExample<TInput, TOutput> converted = new AgenticExample<>();
      converted.name = example.name;
      converted.description = example.description;
      converted.input = example.input;
      converted.output = example.output;
      converted.notes = example.notes;
      result.add(converted);
    }

    return result;
  }

  protected String domainDescription() {
    return domain() == null ? null : domain().description();
  }

  protected String domainCaseName() {
    return domain() == null ? null : domain().caseName();
  }

  protected AppSchema domainInputSchema() {
    return domain() == null ? null : domain().inputSchema();
  }

  protected AppSchema domainOutputSchema() {
    return domain() == null ? null : domain().outputSchema();
  }

  public AgenticDefinition<TInput, TOutput> definition() {
    AgenticDefinition<TInput, TOutput> definition = new AgenticDefinition<>();
    definition.discovery = discovery();
    definition.context = context();
    definition.prompt = prompt();
    definition.tool = tool();
    definition.mcp = mcp();
    definition.rag = rag();
    definition.policy = policy();
    definition.examples = examples();
    return definition;
  }

  public TOutput execute(TInput input) throws Exception {
    return tool().execute(input, ctx);
  }

  public boolean isMcpEnabled() {
    AgenticMcpContract contract = mcp();
    return contract != null && !Boolean.FALSE.equals(contract.enabled);
  }

  public boolean requiresConfirmation() {
    AgenticPolicy localPolicy = policy();
    AgenticToolContract<TInput, TOutput> localTool = tool();
    return Boolean.TRUE.equals(localPolicy == null ? null : localPolicy.requireConfirmation)
        || Boolean.TRUE.equals(localTool.requiresConfirmation);
  }

  public String caseName() {
    String discoveryName = discovery() == null ? null : discovery().name;
    if (discoveryName != null && !discoveryName.isBlank()) {
      return discoveryName;
    }

    String domainName = domainCaseName();
    if (domainName != null && !domainName.isBlank()) {
      return domainName;
    }

    return "unknown_case";
  }

  protected void validateDefinition() {
    AgenticDiscovery discovery = discovery();
    if (discovery == null || discovery.name == null || discovery.name.isBlank()) {
      throw new IllegalStateException("validateDefinition: discovery.name is empty");
    }

    if (discovery.description == null || discovery.description.isBlank()) {
      throw new IllegalStateException("validateDefinition: discovery.description is empty");
    }

    AgenticToolContract<TInput, TOutput> tool = tool();
    if (tool == null || tool.name == null || tool.name.isBlank()) {
      throw new IllegalStateException("validateDefinition: tool.name is empty");
    }

    if (tool.executor == null) {
      throw new IllegalStateException("validateDefinition: tool.execute is missing");
    }

    AgenticPrompt prompt = prompt();
    if (prompt == null || prompt.purpose == null || prompt.purpose.isBlank()) {
      throw new IllegalStateException("validateDefinition: prompt.purpose is empty");
    }

    AgenticMcpContract mcp = mcp();
    if (mcp != null && !Boolean.FALSE.equals(mcp.enabled)
        && (mcp.name == null || mcp.name.isBlank())) {
      throw new IllegalStateException("validateDefinition: mcp.enabled but mcp.name is empty");
    }
  }
}
