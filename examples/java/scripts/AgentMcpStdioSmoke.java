package scripts;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;

public final class AgentMcpStdioSmoke {
  private AgentMcpStdioSmoke() {}

  public static void main(String[] args) throws Exception {
    Path dataDirectory = SmokeSupport.tempDirectory("app-java-agent-mcp-stdio-");
    int backendPort = SmokeSupport.freePort();

    try (SmokeSupport.ManagedProcess backend = SmokeSupport.startJavaProcess(
        "apps.backend.BackendServer",
        Map.of(
            "PORT", String.valueOf(backendPort),
            "APP_JAVA_DATA_DIR", dataDirectory.toString()
        ),
        "mcp-stdio-backend"
    )) {
      SmokeSupport.waitForHttp("http://localhost:" + backendPort + "/health", "mcp stdio backend");

      ProcessBuilder builder = new ProcessBuilder(
          "./mvnw",
          "-q",
          "exec:java",
          "-Dexec.mainClass=apps.agent.AgentMcpServer"
      );
      builder.directory(SmokeSupport.projectRoot().toFile());
      builder.environment().put("APP_JAVA_DATA_DIR", dataDirectory.toString());
      Process process = builder.start();

      Thread stderrThread = new Thread(() -> {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
          while (reader.readLine() != null) {
          }
        } catch (Exception ignored) {
        }
      });
      stderrThread.start();

      try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8));
           BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
        McpStdioClient client = new McpStdioClient(writer, reader);

        Map<String, Object> unsupported = client.request(Map.of(
            "jsonrpc", "2.0",
            "id", 1,
            "method", "initialize",
            "params", Map.of(
                "protocolVersion", "2024-01-01",
                "capabilities", Map.of(),
                "clientInfo", Map.of("name", "agent-mcp-stdio-smoke", "version", "1.0.0")
            )
        ));
        SmokeSupport.assertTrue(unsupported.containsKey("error"), "agent_mcp_smoke: initialize must reject unknown protocol versions explicitly");

        Map<String, Object> initialize = client.request(Map.of(
            "jsonrpc", "2.0",
            "id", 2,
            "method", "initialize",
            "params", Map.of(
                "protocolVersion", "2025-06-18",
                "capabilities", Map.of(),
                "clientInfo", Map.of("name", "agent-mcp-stdio-smoke", "version", "1.0.0")
            )
        ));
        Map<String, Object> initializeResult = SmokeSupport.map(initialize.get("result"), "agent_mcp_smoke: initialize must return result");
        SmokeSupport.assertEquals("2025-11-25", initializeResult.get("protocolVersion"), "agent_mcp_smoke: initialize must negotiate the host-supported MCP protocol version");

        client.notify(Map.of("jsonrpc", "2.0", "method", "notifications/initialized"));

        Map<String, Object> tools = client.request(Map.of("jsonrpc", "2.0", "id", 3, "method", "tools/list"));
        List<Object> toolDescriptors = SmokeSupport.list(
            SmokeSupport.map(tools.get("result"), "agent_mcp_smoke: tools/list must return result").get("tools"),
            "agent_mcp_smoke: tools/list must expose tools"
        );
        SmokeSupport.assertEquals(3, toolDescriptors.size(), "agent_mcp_smoke: tools/list must expose the three task tools");

        Map<String, Object> resources = client.request(Map.of("jsonrpc", "2.0", "id", 4, "method", "resources/list"));
        List<Object> resourceDescriptors = SmokeSupport.list(
            SmokeSupport.map(resources.get("result"), "agent_mcp_smoke: resources/list must return result").get("resources"),
            "agent_mcp_smoke: resources/list must expose resources"
        );
        SmokeSupport.assertEquals(4, resourceDescriptors.size(), "agent_mcp_smoke: resources/list must publish the system prompt plus one semantic resource per tool");

        Map<String, Object> invalidCreate = client.request(Map.of(
            "jsonrpc", "2.0",
            "id", 5,
            "method", "tools/call",
            "params", Map.of(
                "name", "task_create",
                "arguments", Map.of("title", "   ")
            )
        ));
        Map<String, Object> invalidCreateResult = SmokeSupport.map(invalidCreate.get("result"), "agent_mcp_smoke: invalid create must return result");
        SmokeSupport.assertTrue(
            SmokeSupport.bool(invalidCreateResult.get("isError"), "agent_mcp_smoke: invalid create isError must be boolean"),
            "agent_mcp_smoke: invalid task_create must surface an MCP tool error result"
        );

        Map<String, Object> created = client.request(Map.of(
            "jsonrpc", "2.0",
            "id", 6,
            "method", "tools/call",
            "params", Map.of(
                "name", "task_create",
                "arguments", Map.of(
                    "title", "MCP stdio created task",
                    "description", "Created through MCP stdio"
                )
            )
        ));
        Map<String, Object> createdTask = SmokeSupport.map(
            SmokeSupport.map(created.get("result"), "agent_mcp_smoke: create must return result").get("structuredContent"),
            "agent_mcp_smoke: create structuredContent must be object"
        );
        String taskId = SmokeSupport.string(
            SmokeSupport.map(createdTask.get("task"), "agent_mcp_smoke: created task must be object").get("id"),
            "agent_mcp_smoke: created MCP task must include id"
        );

        Map<String, Object> moveWithoutConfirmation = client.request(Map.of(
            "jsonrpc", "2.0",
            "id", 7,
            "method", "tools/call",
            "params", Map.of(
                "name", "task_move",
                "arguments", Map.of("taskId", taskId, "targetStatus", "doing")
            )
        ));
        Map<String, Object> moveWithoutConfirmationResult = SmokeSupport.map(moveWithoutConfirmation.get("result"), "agent_mcp_smoke: move without confirmation must return result");
        SmokeSupport.assertTrue(
            SmokeSupport.bool(moveWithoutConfirmationResult.get("isError"), "agent_mcp_smoke: move without confirmation isError must be boolean"),
            "agent_mcp_smoke: task_move without confirmation must fail through MCP"
        );

        Map<String, Object> moved = client.request(Map.of(
            "jsonrpc", "2.0",
            "id", 8,
            "method", "tools/call",
            "params", Map.of(
                "name", "task_move",
                "arguments", Map.of(
                    "confirmed", true,
                    "input", Map.of("taskId", taskId, "targetStatus", "doing")
                )
            )
        ));
        Map<String, Object> movedTask = SmokeSupport.map(
            SmokeSupport.map(moved.get("result"), "agent_mcp_smoke: moved result must be object").get("structuredContent"),
            "agent_mcp_smoke: moved structuredContent must be object"
        );
        SmokeSupport.assertEquals(
            "doing",
            SmokeSupport.map(movedTask.get("task"), "agent_mcp_smoke: moved task must be object").get("status"),
            "agent_mcp_smoke: confirmed task_move must succeed through MCP"
        );

        SmokeSupport.JsonResponse backendList = SmokeSupport.request("GET", "http://localhost:" + backendPort + "/tasks", null);
        SmokeSupport.assertTrue(
            SmokeSupport.list(
                SmokeSupport.map(backendList.jsonMap("agent_mcp_smoke: backend list must return object").get("data"), "agent_mcp_smoke: backend data must be object").get("tasks"),
                "agent_mcp_smoke: backend tasks must be array"
            ).stream()
                .map(item -> SmokeSupport.map(item, "agent_mcp_smoke: backend task must be object"))
                .anyMatch(task -> taskId.equals(task.get("id")) && "doing".equals(task.get("status"))),
            "agent_mcp_smoke: backend must observe tasks written through the MCP agent host"
        );
      } finally {
        process.destroy();
        process.waitFor(2, java.util.concurrent.TimeUnit.SECONDS);
        if (process.isAlive()) {
          process.destroyForcibly();
        }
      }
    }

    System.out.println("agent_mcp_smoke: ok");
  }

  private static final class McpStdioClient {
    private final BufferedWriter writer;
    private final BufferedReader reader;

    private McpStdioClient(BufferedWriter writer, BufferedReader reader) {
      this.writer = writer;
      this.reader = reader;
    }

    private void notify(Map<String, Object> payload) throws Exception {
      writer.write(SmokeSupport.MAPPER.writeValueAsString(payload));
      writer.write("\n");
      writer.flush();
    }

    private Map<String, Object> request(Map<String, Object> payload) throws Exception {
      Object expectedId = payload.get("id");
      notify(payload);

      long deadline = System.currentTimeMillis() + Duration.ofSeconds(10).toMillis();
      while (System.currentTimeMillis() < deadline) {
        String line = reader.readLine();
        if (line == null) {
          throw new IllegalStateException("agent_mcp_smoke: MCP stdio server closed unexpectedly");
        }
        if (line.isBlank()) {
          continue;
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> message = SmokeSupport.MAPPER.readValue(line, Map.class);
        if (!message.containsKey("id")) {
          continue;
        }
        if (expectedId == null ? message.get("id") == null : expectedId.equals(message.get("id"))) {
          return message;
        }
      }
      throw new IllegalStateException("agent_mcp_smoke: timed out waiting for response");
    }
  }
}
