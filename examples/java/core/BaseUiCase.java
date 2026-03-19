package core;

import core.shared.AppBaseContext;
import core.shared.AppInfraContracts.AppHttpClient;
import java.util.LinkedHashMap;
import java.util.Map;

public abstract class BaseUiCase<TState> {
  public static class UiContext extends AppBaseContext {
    public Object renderer;
    public Object router;
    public Object store;
    public AppHttpClient api;
    public Map<String, Object> packages = new LinkedHashMap<>();
    public Map<String, Object> extra = new LinkedHashMap<>();
  }

  protected final UiContext ctx;
  protected TState state;

  protected BaseUiCase(UiContext ctx, TState initialState) {
    this.ctx = ctx;
    this.state = initialState;
  }

  public abstract String view() throws Exception;

  public void test() throws Exception {}

  protected Object _viewmodel(Object... args) throws Exception {
    return null;
  }

  protected Object _service(Object... args) throws Exception {
    return null;
  }

  protected Object _repository(Object... args) throws Exception {
    return null;
  }

  protected void setState(TState nextState) {
    this.state = nextState;
  }
}
