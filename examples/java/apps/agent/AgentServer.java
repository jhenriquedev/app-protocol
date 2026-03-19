package apps.agent;

import java.nio.file.Path;

public final class AgentServer {
  private AgentServer() {}

  public static void main(String[] args) throws Exception {
    AgentRegistry.AgentConfig config = new AgentRegistry.AgentConfig();
    config.port = resolvePort();

    String dataDirectory = System.getenv("APP_JAVA_DATA_DIR");
    if (dataDirectory != null && !dataDirectory.isBlank()) {
      config.dataDirectory = Path.of(dataDirectory);
    } else {
      config.dataDirectory = Path.of("packages/data");
    }

    AgentApp.bootstrap(config).startAgent();
  }

  private static int resolvePort() {
    String value = System.getenv("PORT");
    if (value == null || value.isBlank()) {
      value = System.getenv("AGENT_PORT");
    }

    try {
      return value == null || value.isBlank() ? 3001 : Integer.parseInt(value);
    } catch (NumberFormatException ignored) {
      return 3001;
    }
  }
}
