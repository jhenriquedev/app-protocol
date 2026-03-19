package core;

import core.shared.AppBaseContext;
import core.shared.AppInfraContracts.AppCache;
import core.shared.AppInfraContracts.AppHttpClient;
import core.shared.AppInfraContracts.AppStorageClient;
import core.shared.AppStructuralContracts.AppCaseError;
import core.shared.AppStructuralContracts.AppResult;
import java.util.LinkedHashMap;
import java.util.Map;

public abstract class BaseApiCase<TInput, TOutput> {
  @FunctionalInterface
  public interface RouteHandler {
    Object handle(Map<String, Object> request) throws Exception;
  }

  public static class ApiContext extends AppBaseContext {
    public AppHttpClient httpClient;
    public Object db;
    public Object auth;
    public AppStorageClient storage;
    public AppCache cache;
    public Map<String, Object> cases = new LinkedHashMap<>();
    public Map<String, Object> packages = new LinkedHashMap<>();
    public Map<String, Object> extra = new LinkedHashMap<>();
  }

  public static class ApiResponse<T> extends AppResult<T> {
    public Integer statusCode;

    public static <T> ApiResponse<T> success(T data, Integer statusCode) {
      ApiResponse<T> response = new ApiResponse<>();
      response.success = true;
      response.data = data;
      response.statusCode = statusCode;
      return response;
    }

    public static <T> ApiResponse<T> failure(
        core.shared.AppStructuralContracts.AppError error,
        Integer statusCode
    ) {
      ApiResponse<T> response = new ApiResponse<>();
      response.success = false;
      response.error = error;
      response.statusCode = statusCode;
      return response;
    }
  }

  protected final ApiContext ctx;

  protected BaseApiCase(ApiContext ctx) {
    this.ctx = ctx;
  }

  public abstract ApiResponse<TOutput> handler(TInput input) throws Exception;

  public Object router() {
    return null;
  }

  public void test() throws Exception {}

  protected void _validate(TInput input) throws Exception {}

  protected void _authorize(TInput input) throws Exception {}

  protected Object _repository() throws Exception {
    return null;
  }

  protected boolean useComposition() {
    return false;
  }

  protected TOutput _service(TInput input) throws Exception {
    throw new AppCaseError(
        "INTERNAL",
        "BaseApiCase: _service must be implemented when useComposition() is false"
    );
  }

  protected TOutput _composition(TInput input) throws Exception {
    throw new AppCaseError(
        "INTERNAL",
        "BaseApiCase: _composition must be implemented when useComposition() is true"
    );
  }

  protected ApiResponse<TOutput> execute(TInput input) throws Exception {
    try {
      _validate(input);
      _authorize(input);

      TOutput result = useComposition()
          ? _composition(input)
          : _service(input);

      ApiResponse<TOutput> response = new ApiResponse<>();
      response.success = true;
      response.data = result;
      return response;
    } catch (AppCaseError error) {
      ApiResponse<TOutput> response = new ApiResponse<>();
      response.success = false;
      response.error = error.toAppError();
      return response;
    }
  }
}
