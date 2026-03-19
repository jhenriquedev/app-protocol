package apps.portal;

public final class PortalServer {
  private PortalServer() {}

  public static void main(String[] args) throws Exception {
    PortalRegistry.PortalConfig config = new PortalRegistry.PortalConfig();
    config.port = resolvePort();

    String apiBaseUrl = System.getenv("APP_JAVA_API_BASE_URL");
    if (apiBaseUrl != null && !apiBaseUrl.isBlank()) {
      config.apiBaseUrl = apiBaseUrl;
    }

    PortalApp.bootstrap(config).startPortal();
  }

  private static int resolvePort() {
    String value = System.getenv("PORT");
    if (value == null || value.isBlank()) {
      value = System.getenv("PORTAL_PORT");
    }

    try {
      return value == null || value.isBlank() ? 5173 : Integer.parseInt(value);
    } catch (NumberFormatException ignored) {
      return 5173;
    }
  }
}
