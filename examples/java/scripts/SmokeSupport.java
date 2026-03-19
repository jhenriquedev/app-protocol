package scripts;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.ServerSocket;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public final class SmokeSupport {
  public static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP = HttpClient.newBuilder()
      .followRedirects(HttpClient.Redirect.NEVER)
      .connectTimeout(Duration.ofSeconds(5))
      .build();

  private SmokeSupport() {}

  public static Path projectRoot() {
    return Path.of("").toAbsolutePath();
  }

  public static Path tempDirectory(String prefix) throws IOException {
    return Files.createTempDirectory(prefix);
  }

  public static int freePort() throws IOException {
    try (ServerSocket socket = new ServerSocket(0)) {
      socket.setReuseAddress(true);
      return socket.getLocalPort();
    }
  }

  public static ManagedProcess startJavaProcess(
      String mainClass,
      Map<String, String> environment,
      String label
  ) throws IOException {
    ProcessBuilder builder = new ProcessBuilder(
        "./mvnw",
        "-q",
        "exec:java",
        "-Dexec.mainClass=" + mainClass
    );
    builder.directory(projectRoot().toFile());
    builder.environment().putAll(environment);
    Process process = builder.start();
    return new ManagedProcess(process, label);
  }

  public static JsonResponse request(String method, String url, Object body) throws Exception {
    HttpRequest.Builder builder = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .timeout(Duration.ofSeconds(10));

    if (body instanceof String rawBody) {
      builder.header("content-type", "application/json");
      builder.method(method.toUpperCase(), HttpRequest.BodyPublishers.ofString(rawBody));
    } else if (body != null) {
      builder.header("content-type", "application/json");
      builder.method(
          method.toUpperCase(),
          HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(body))
      );
    } else if ("GET".equalsIgnoreCase(method)) {
      builder.GET();
    } else {
      builder.method(method.toUpperCase(), HttpRequest.BodyPublishers.noBody());
    }

    HttpResponse<String> response = HTTP.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    return JsonResponse.from(response.statusCode(), response.headers().map(), response.body());
  }

  public static JsonResponse requestForm(String method, String url, Map<String, String> form) throws Exception {
    StringBuilder encoded = new StringBuilder();
    boolean first = true;
    for (Map.Entry<String, String> entry : form.entrySet()) {
      if (!first) {
        encoded.append("&");
      }
      first = false;
      encoded.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8));
      encoded.append("=");
      encoded.append(URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
    }

    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .timeout(Duration.ofSeconds(10))
        .header("content-type", "application/x-www-form-urlencoded")
        .method(method.toUpperCase(), HttpRequest.BodyPublishers.ofString(encoded.toString()))
        .build();

    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    return JsonResponse.from(response.statusCode(), response.headers().map(), response.body());
  }

  public static void waitForHttp(String url, String label) throws Exception {
    long deadline = System.currentTimeMillis() + 20_000L;
    Exception last = null;
    while (System.currentTimeMillis() < deadline) {
      try {
        JsonResponse response = request("GET", url, null);
        if (response.statusCode >= 200 && response.statusCode < 500) {
          return;
        }
      } catch (Exception error) {
        last = error;
      }
      Thread.sleep(150L);
    }
    throw new IllegalStateException("waitForHttp: " + label + " did not become ready", last);
  }

  public static void assertTrue(boolean condition, String message) {
    if (!condition) {
      throw new IllegalStateException(message);
    }
  }

  public static void assertEquals(Object expected, Object actual, String message) {
    if (expected == null ? actual != null : !expected.equals(actual)) {
      throw new IllegalStateException(message + " expected=" + expected + " actual=" + actual);
    }
  }

  public static Map<String, Object> map(Object value, String message) {
    if (!(value instanceof Map<?, ?> raw)) {
      throw new IllegalStateException(message);
    }

    Map<String, Object> result = new LinkedHashMap<>();
    for (Map.Entry<?, ?> entry : raw.entrySet()) {
      result.put(String.valueOf(entry.getKey()), entry.getValue());
    }
    return result;
  }

  public static List<Object> list(Object value, String message) {
    if (!(value instanceof List<?> raw)) {
      throw new IllegalStateException(message);
    }
    return new ArrayList<>(raw);
  }

  public static String string(Object value, String message) {
    if (!(value instanceof String text)) {
      throw new IllegalStateException(message);
    }
    return text;
  }

  public static boolean bool(Object value, String message) {
    if (!(value instanceof Boolean flag)) {
      throw new IllegalStateException(message);
    }
    return flag;
  }

  public static final class JsonResponse {
    public final int statusCode;
    public final Map<String, List<String>> headers;
    public final String bodyText;
    public final Object json;

    private JsonResponse(int statusCode, Map<String, List<String>> headers, String bodyText, Object json) {
      this.statusCode = statusCode;
      this.headers = headers;
      this.bodyText = bodyText == null ? "" : bodyText;
      this.json = json;
    }

    private static JsonResponse from(int statusCode, Map<String, List<String>> headers, String bodyText)
        throws Exception {
      Object json = null;
      if (bodyText != null && !bodyText.isBlank()) {
        String contentType = headers.getOrDefault("content-type", headers.getOrDefault("Content-Type", List.of()))
            .stream()
            .findFirst()
            .orElse("");
        if (contentType.contains("application/json")
            || bodyText.trim().startsWith("{")
            || bodyText.trim().startsWith("[")) {
          json = MAPPER.readValue(bodyText, Object.class);
        }
      }
      return new JsonResponse(statusCode, headers, bodyText, json);
    }

    public Map<String, Object> jsonMap(String message) {
      return map(json, message);
    }

    public List<Object> jsonList(String message) {
      return list(json, message);
    }

    public String header(String name) {
      List<String> values = headers.get(name);
      if (values == null) {
        values = headers.get(name.toLowerCase());
      }
      return values == null || values.isEmpty() ? null : values.get(0);
    }
  }

  public static final class ManagedProcess implements AutoCloseable {
    private final Process process;
    private final String label;
    private final StringBuilder stdout = new StringBuilder();
    private final StringBuilder stderr = new StringBuilder();
    private final Thread stdoutThread;
    private final Thread stderrThread;

    private ManagedProcess(Process process, String label) {
      this.process = process;
      this.label = label;
      this.stdoutThread = capture(process.getInputStream(), stdout);
      this.stderrThread = capture(process.getErrorStream(), stderr);
      this.stdoutThread.start();
      this.stderrThread.start();
    }

    public boolean isAlive() {
      return process.isAlive();
    }

    public String stdout() {
      return stdout.toString();
    }

    public String stderr() {
      return stderr.toString();
    }

    public Process raw() {
      return process;
    }

    @Override
    public void close() {
      process.destroy();
      try {
        if (!process.waitFor(2, TimeUnit.SECONDS)) {
          process.destroyForcibly();
          process.waitFor(2, TimeUnit.SECONDS);
        }
      } catch (InterruptedException ignored) {
        Thread.currentThread().interrupt();
        process.destroyForcibly();
      }
    }

    public void requireRunning() {
      if (!isAlive()) {
        throw new IllegalStateException(
            label + " is not running.\nstdout:\n" + stdout + "\nstderr:\n" + stderr
        );
      }
    }
  }

  private static Thread capture(InputStream stream, StringBuilder sink) {
    return new Thread(() -> {
      try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
        String line;
        while ((line = reader.readLine()) != null) {
          synchronized (sink) {
            sink.append(line).append("\n");
          }
        }
      } catch (IOException ignored) {
      }
    });
  }
}
