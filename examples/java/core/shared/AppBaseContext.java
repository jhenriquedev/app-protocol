package core.shared;

import java.util.LinkedHashMap;
import java.util.Map;

public class AppBaseContext {
  public interface AppLogger {
    void debug(String message, Map<String, Object> meta);
    void info(String message, Map<String, Object> meta);
    void warn(String message, Map<String, Object> meta);
    void error(String message, Map<String, Object> meta);
  }

  public String correlationId;
  public String executionId;
  public String tenantId;
  public String userId;
  public AppLogger logger;
  public Map<String, Object> config = new LinkedHashMap<>();
}
