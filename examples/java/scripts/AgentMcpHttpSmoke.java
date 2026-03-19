package scripts;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

public final class AgentMcpHttpSmoke {
  private AgentMcpHttpSmoke() {}

  public static void main(String[] args) throws Exception {
    Path dataDirectory = SmokeSupport.tempDirectory("app-java-agent-mcp-http-");
    int backendPort = SmokeSupport.freePort();
    int agentPort = SmokeSupport.freePort();

    try (SmokeSupport.ManagedProcess backend = SmokeSupport.startJavaProcess(
        "apps.backend.BackendServer",
        Map.of(
            "PORT", String.valueOf(backendPort),
            "APP_JAVA_DATA_DIR", dataDirectory.toString()
        ),
        "mcp-http-backend"
    );
         SmokeSupport.ManagedProcess agent = SmokeSupport.startJavaProcess(
             "apps.agent.AgentServer",
             Map.of(
                 "PORT", String.valueOf(agentPort),
                 "APP_JAVA_DATA_DIR", dataDirectory.toString()
             ),
             "mcp-http-agent"
         )) {
      SmokeSupport.waitForHttp("http://localhost:" + agentPort + "/health", "mcp http agent");

      SmokeSupport.JsonResponse unsupported = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/mcp",
          Map.of(
              "jsonrpc", "2.0",
              "id", 1,
              "method", "initialize",
              "params", Map.of(
                  "protocolVersion", "2024-01-01",
                  "capabilities", Map.of(),
                  "clientInfo", Map.of("name", "agent-mcp-http-smoke", "version", "1.0.0")
              )
          )
      );
      SmokeSupport.assertEquals(200, unsupported.statusCode, "agent_mcp_http_smoke: initialize returns JSON-RPC payload");
      SmokeSupport.assertEquals(
          -32602,
          SmokeSupport.map(unsupported.jsonMap("agent_mcp_http_smoke: unsupported initialize must return object").get("error"), "agent_mcp_http_smoke: unsupported initialize error must be object").get("code"),
          "agent_mcp_http_smoke: initialize must reject unknown protocol versions"
      );

      SmokeSupport.JsonResponse initialize = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/mcp",
          Map.of(
              "jsonrpc", "2.0",
              "id", 2,
              "method", "initialize",
              "params", Map.of(
                  "protocolVersion", "2025-06-18",
                  "capabilities", Map.of(),
                  "clientInfo", Map.of("name", "agent-mcp-http-smoke", "version", "1.0.0")
              )
          )
      );
      Map<String, Object> initializeResult = SmokeSupport.map(
          initialize.jsonMap("agent_mcp_http_smoke: initialize must return object").get("result"),
          "agent_mcp_http_smoke: initialize.result must be object"
      );
      SmokeSupport.assertEquals("2025-11-25", initializeResult.get("protocolVersion"), "agent_mcp_http_smoke: initialize must negotiate latest supported protocol");

      SmokeSupport.JsonResponse tools = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/mcp",
          Map.of("jsonrpc", "2.0", "id", 3, "method", "tools/list")
      );
      List<Object> toolDescriptors = SmokeSupport.list(
          SmokeSupport.map(tools.jsonMap("agent_mcp_http_smoke: tools/list must return object").get("result"), "agent_mcp_http_smoke: tools/list result must be object").get("tools"),
          "agent_mcp_http_smoke: tools/list must return tools"
      );
      SmokeSupport.assertEquals(3, toolDescriptors.size(), "agent_mcp_http_smoke: tools/list must expose the three task tools");

      SmokeSupport.JsonResponse resources = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/mcp",
          Map.of("jsonrpc", "2.0", "id", 4, "method", "resources/list")
      );
      List<Object> resourceDescriptors = SmokeSupport.list(
          SmokeSupport.map(resources.jsonMap("agent_mcp_http_smoke: resources/list must return object").get("result"), "agent_mcp_http_smoke: resources/list result must be object").get("resources"),
          "agent_mcp_http_smoke: resources/list must return resources"
      );
      SmokeSupport.assertEquals(4, resourceDescriptors.size(), "agent_mcp_http_smoke: resources/list must publish the system prompt plus one semantic resource per tool");

      SmokeSupport.JsonResponse moveSemantic = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/mcp",
          Map.of(
              "jsonrpc", "2.0",
              "id", 5,
              "method", "resources/read",
              "params", Map.of("uri", "app://agent/tools/task_move/semantic")
          )
      );
      Map<String, Object> moveSemanticResult = SmokeSupport.map(
          moveSemantic.jsonMap("agent_mcp_http_smoke: resources/read must return object").get("result"),
          "agent_mcp_http_smoke: resources/read result must be object"
      );
      String moveSemanticText = SmokeSupport.string(
          SmokeSupport.map(
              SmokeSupport.list(moveSemanticResult.get("contents"), "agent_mcp_http_smoke: contents must be array").get(0),
              "agent_mcp_http_smoke: first content must be object"
          ).get("text"),
          "agent_mcp_http_smoke: semantic content text must be string"
      );
      SmokeSupport.assertTrue(moveSemanticText.contains("Requires confirmation: yes."), "agent_mcp_http_smoke: resources/read must expose the tool prompt fragment");
      SmokeSupport.assertTrue(moveSemanticText.contains("\"rag\""), "agent_mcp_http_smoke: resources/read must preserve RAG resources");

      SmokeSupport.JsonResponse invalidCreate = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/mcp",
          Map.of(
              "jsonrpc", "2.0",
              "id", 6,
              "method", "tools/call",
              "params", Map.of(
                  "name", "task_create",
                  "arguments", Map.of("title", "   ")
              )
          )
      );
      Map<String, Object> invalidCreateResult = SmokeSupport.map(
          invalidCreate.jsonMap("agent_mcp_http_smoke: invalid create must return object").get("result"),
          "agent_mcp_http_smoke: invalid create result must be object"
      );
      SmokeSupport.assertTrue(
          SmokeSupport.bool(invalidCreateResult.get("isError"), "agent_mcp_http_smoke: invalid create isError must be boolean"),
          "agent_mcp_http_smoke: invalid task_create must surface an MCP tool error result"
      );

      SmokeSupport.JsonResponse created = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/mcp",
          Map.of(
              "jsonrpc", "2.0",
              "id", 7,
              "method", "tools/call",
              "params", Map.of(
                  "name", "task_create",
                  "arguments", Map.of(
                      "title", "MCP HTTP created task",
                      "description", "Created through MCP HTTP"
                  )
              )
          )
      );
      Map<String, Object> createdResult = SmokeSupport.map(
          created.jsonMap("agent_mcp_http_smoke: create must return object").get("result"),
          "agent_mcp_http_smoke: create result must be object"
      );
      Map<String, Object> createdTask = SmokeSupport.map(createdResult.get("structuredContent"), "agent_mcp_http_smoke: structured content must be object");
      String taskId = SmokeSupport.string(
          SmokeSupport.map(createdTask.get("task"), "agent_mcp_http_smoke: structured task must be object").get("id"),
          "agent_mcp_http_smoke: created MCP task must include id"
      );

      SmokeSupport.JsonResponse moveWithoutConfirmation = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/mcp",
          Map.of(
              "jsonrpc", "2.0",
              "id", 8,
              "method", "tools/call",
              "params", Map.of(
                  "name", "task_move",
                  "arguments", Map.of("taskId", taskId, "targetStatus", "doing")
              )
          )
      );
      Map<String, Object> moveWithoutConfirmationResult = SmokeSupport.map(
          moveWithoutConfirmation.jsonMap("agent_mcp_http_smoke: move without confirmation must return object").get("result"),
          "agent_mcp_http_smoke: move without confirmation result must be object"
      );
      SmokeSupport.assertTrue(
          SmokeSupport.bool(moveWithoutConfirmationResult.get("isError"), "agent_mcp_http_smoke: move without confirmation isError must be boolean"),
          "agent_mcp_http_smoke: task_move without confirmation must fail through MCP"
      );

      SmokeSupport.JsonResponse moved = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/mcp",
          Map.of(
              "jsonrpc", "2.0",
              "id", 9,
              "method", "tools/call",
              "params", Map.of(
                  "name", "task_move",
                  "arguments", Map.of(
                      "confirmed", true,
                      "input", Map.of("taskId", taskId, "targetStatus", "doing")
                  )
              )
          )
      );
      Map<String, Object> movedResult = SmokeSupport.map(
          SmokeSupport.map(moved.jsonMap("agent_mcp_http_smoke: confirmed move must return object").get("result"), "agent_mcp_http_smoke: confirmed move result must be object").get("structuredContent"),
          "agent_mcp_http_smoke: confirmed move structuredContent must be object"
      );
      SmokeSupport.assertEquals(
          "doing",
          SmokeSupport.map(movedResult.get("task"), "agent_mcp_http_smoke: moved task must be object").get("status"),
          "agent_mcp_http_smoke: confirmed task_move must succeed through MCP HTTP"
      );

      SmokeSupport.JsonResponse backendList = SmokeSupport.request("GET", "http://localhost:" + backendPort + "/tasks", null);
      SmokeSupport.assertTrue(
          SmokeSupport.list(
              SmokeSupport.map(backendList.jsonMap("agent_mcp_http_smoke: backend list must return object").get("data"), "agent_mcp_http_smoke: backend data must be object").get("tasks"),
              "agent_mcp_http_smoke: backend tasks must be array"
          ).stream()
              .map(item -> SmokeSupport.map(item, "agent_mcp_http_smoke: backend task must be object"))
              .anyMatch(task -> taskId.equals(task.get("id")) && "doing".equals(task.get("status"))),
          "agent_mcp_http_smoke: backend must observe tasks written through the MCP HTTP host"
      );
    }

    System.out.println("agent_mcp_http_smoke: ok");
  }
}
