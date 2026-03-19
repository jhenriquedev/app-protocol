package core.shared;

import core.BaseAgenticCase;
import core.BaseAgenticCase.AgenticContext;
import core.BaseAgenticCase.AgenticDefinition;
import core.BaseApiCase.ApiContext;
import core.BaseStreamCase.StreamContext;
import core.BaseUiCase.UiContext;
import java.util.List;
import java.util.Map;

public final class AppHostContracts {
  private AppHostContracts() {}

  @FunctionalInterface
  public interface DomainFactory {
    Object create();
  }

  @FunctionalInterface
  public interface ApiFactory {
    Object create(ApiContext context);
  }

  @FunctionalInterface
  public interface UiFactory {
    Object create(UiContext context);
  }

  @FunctionalInterface
  public interface StreamFactory {
    Object create(StreamContext context);
  }

  @FunctionalInterface
  public interface AgenticFactory {
    Object create(AgenticContext context);
  }

  public static class AppCaseSurfaces {
    public DomainFactory domain;
    public ApiFactory api;
    public UiFactory ui;
    public StreamFactory stream;
    public AgenticFactory agentic;

    public AppCaseSurfaces domain(DomainFactory value) {
      this.domain = value;
      return this;
    }

    public AppCaseSurfaces api(ApiFactory value) {
      this.api = value;
      return this;
    }

    public AppCaseSurfaces ui(UiFactory value) {
      this.ui = value;
      return this;
    }

    public AppCaseSurfaces stream(StreamFactory value) {
      this.stream = value;
      return this;
    }

    public AppCaseSurfaces agentic(AgenticFactory value) {
      this.agentic = value;
      return this;
    }
  }

  public interface AppRegistry {
    Map<String, Map<String, AppCaseSurfaces>> cases();
    Map<String, Object> providers();
    Map<String, Object> packages();
  }

  public record AgenticCaseRef(String domain, String caseName) {}

  public static class AgenticCatalogEntry {
    public AgenticCaseRef ref;
    public String publishedName;
    public AgenticDefinition<?, ?> definition;
    public boolean isMcpEnabled;
    public boolean requiresConfirmation;
    public String executionMode;
  }

  public interface AgenticRegistry extends AppRegistry {
    List<AgenticCaseRef> listAgenticCases();
    AgenticFactory getAgenticSurface(AgenticCaseRef ref);
    BaseAgenticCase<?, ?> instantiateAgentic(AgenticCaseRef ref, AgenticContext ctx);
    List<AgenticCatalogEntry> buildCatalog(AgenticContext ctx);
    AgenticCatalogEntry resolveTool(String toolName, AgenticContext ctx);
    List<AgenticCatalogEntry> listMcpEnabledTools(AgenticContext ctx);
  }
}
