package core.shared;

public final class AppInfraContracts {
  private AppInfraContracts() {}

  public interface AppHttpClient {
    Object request(Object config) throws Exception;
  }

  public interface AppStorageClient {
    Object get(String key) throws Exception;
    void set(String key, Object value) throws Exception;
  }

  public interface AppCache {
    Object get(String key) throws Exception;
    void set(String key, Object value, Integer ttlSeconds) throws Exception;
  }

  public interface AppEventPublisher {
    void publish(String event, Object payload) throws Exception;
  }
}
