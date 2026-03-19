package apps.backend;

import java.nio.file.Path;

public final class BackendServer {
  private BackendServer() {}

  public static void main(String[] args) throws Exception {
    BackendRegistry.BackendConfig config = new BackendRegistry.BackendConfig();
    config.port = resolvePort();

    String dataDirectory = System.getenv("APP_JAVA_DATA_DIR");
    if (dataDirectory != null && !dataDirectory.isBlank()) {
      config.dataDirectory = Path.of(dataDirectory);
    } else {
      config.dataDirectory = Path.of("packages/data");
    }

    BackendApp.bootstrap(config).startBackend();
  }

  private static int resolvePort() {
    String value = System.getenv("PORT");
    if (value == null || value.isBlank()) {
      value = System.getenv("API_PORT");
    }

    try {
      return value == null || value.isBlank() ? 3000 : Integer.parseInt(value);
    } catch (NumberFormatException ignored) {
      return 3000;
    }
  }
}
