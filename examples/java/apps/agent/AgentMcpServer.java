package apps.agent;

import java.nio.file.Path;

public final class AgentMcpServer {
  private AgentMcpServer() {}

  public static void main(String[] args) throws Exception {
    AgentRegistry.AgentConfig config = new AgentRegistry.AgentConfig();

    String dataDirectory = System.getenv("APP_JAVA_DATA_DIR");
    if (dataDirectory != null && !dataDirectory.isBlank()) {
      config.dataDirectory = Path.of(dataDirectory);
    } else {
      config.dataDirectory = Path.of("packages/data");
    }

    AgentApp.bootstrap(config).publishMcp();
  }
}
