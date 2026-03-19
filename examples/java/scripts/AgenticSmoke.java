package scripts;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public final class AgenticSmoke {
  private AgenticSmoke() {}

  public static void main(String[] args) throws Exception {
    Path dataDirectory = SmokeSupport.tempDirectory("app-java-agentic-smoke-");
    int backendPort = SmokeSupport.freePort();
    int agentPort = SmokeSupport.freePort();

    try (SmokeSupport.ManagedProcess backend = SmokeSupport.startJavaProcess(
        "apps.backend.BackendServer",
        Map.of(
            "PORT", String.valueOf(backendPort),
            "APP_JAVA_DATA_DIR", dataDirectory.toString()
        ),
        "agentic-backend"
    );
         SmokeSupport.ManagedProcess agent = SmokeSupport.startJavaProcess(
             "apps.agent.AgentServer",
             Map.of(
                 "PORT", String.valueOf(agentPort),
                 "APP_JAVA_DATA_DIR", dataDirectory.toString()
             ),
             "agentic-agent"
         )) {
      SmokeSupport.waitForHttp("http://localhost:" + backendPort + "/health", "agentic backend");
      SmokeSupport.waitForHttp("http://localhost:" + agentPort + "/health", "agent");

      SmokeSupport.JsonResponse catalog = SmokeSupport.request("GET", "http://localhost:" + agentPort + "/catalog", null);
      Map<String, Object> catalogData = SmokeSupport.map(
          catalog.jsonMap("agentic_smoke: catalog must return object").get("data"),
          "agentic_smoke: catalog.data must be object"
      );
      List<Object> tools = SmokeSupport.list(catalogData.get("tools"), "agentic_smoke: catalog tools must be array");
      SmokeSupport.assertEquals(3, tools.size(), "agentic_smoke: catalog must publish three tools");
      SmokeSupport.assertTrue(
          SmokeSupport.string(catalogData.get("systemPrompt"), "agentic_smoke: systemPrompt must be string").contains("Tool task_create"),
          "agentic_smoke: /catalog must expose the host global prompt"
      );

      SmokeSupport.JsonResponse invalidCreate = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/tools/task_create/execute",
          Map.of("input", Map.of("title", "   "))
      );
      SmokeSupport.assertEquals(400, invalidCreate.statusCode, "agentic_smoke: invalid task_create must return 400");
      SmokeSupport.assertEquals(
          "VALIDATION_FAILED",
          SmokeSupport.map(
              invalidCreate.jsonMap("agentic_smoke: invalid create must return object").get("error"),
              "agentic_smoke: invalid create error must be object"
          ).get("code"),
          "agentic_smoke: invalid task_create must preserve validation errors"
      );

      SmokeSupport.JsonResponse created = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/tools/task_create/execute",
          Map.of("input", Map.of(
              "title", "Agentic smoke task",
              "description", "Created through the HTTP agent host"
          ))
      );
      Map<String, Object> createdTask = SmokeSupport.map(
          SmokeSupport.map(created.jsonMap("agentic_smoke: create must return object").get("data"), "agentic_smoke: create.data must be object").get("task"),
          "agentic_smoke: create.data.task must be object"
      );
      String taskId = SmokeSupport.string(createdTask.get("id"), "agentic_smoke: created task must include id");

      SmokeSupport.JsonResponse listed = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/tools/task_list/execute",
          Map.of("input", Map.of())
      );
      List<Object> listedTasks = SmokeSupport.list(
          SmokeSupport.map(listed.jsonMap("agentic_smoke: list must return object").get("data"), "agentic_smoke: list.data must be object").get("tasks"),
          "agentic_smoke: list.data.tasks must be array"
      );
      SmokeSupport.assertTrue(
          listedTasks.stream()
              .map(item -> SmokeSupport.map(item, "agentic_smoke: listed task must be object"))
              .anyMatch(task -> taskId.equals(task.get("id"))),
          "agentic_smoke: task_list must see tasks created by apps/agent"
      );

      SmokeSupport.JsonResponse moveWithoutConfirmation = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/tools/task_move/execute",
          Map.of("input", Map.of("taskId", taskId, "targetStatus", "doing"))
      );
      SmokeSupport.assertEquals(409, moveWithoutConfirmation.statusCode, "agentic_smoke: task_move must require confirmation");

      SmokeSupport.JsonResponse moved = SmokeSupport.request(
          "POST",
          "http://localhost:" + agentPort + "/tools/task_move/execute",
          Map.of(
              "confirmed", true,
              "input", Map.of("taskId", taskId, "targetStatus", "doing")
          )
      );
      Map<String, Object> movedTask = SmokeSupport.map(
          SmokeSupport.map(moved.jsonMap("agentic_smoke: confirmed move must return object").get("data"), "agentic_smoke: confirmed move data must be object").get("task"),
          "agentic_smoke: confirmed move task must be object"
      );
      SmokeSupport.assertEquals("doing", movedTask.get("status"), "agentic_smoke: confirmed task_move must mutate the task");

      SmokeSupport.JsonResponse backendList = SmokeSupport.request("GET", "http://localhost:" + backendPort + "/tasks", null);
      SmokeSupport.assertTrue(
          SmokeSupport.list(
              SmokeSupport.map(backendList.jsonMap("agentic_smoke: backend list must return object").get("data"), "agentic_smoke: backend list data must be object").get("tasks"),
              "agentic_smoke: backend tasks must be array"
          ).stream()
              .map(item -> SmokeSupport.map(item, "agentic_smoke: backend task must be object"))
              .anyMatch(task -> taskId.equals(task.get("id")) && "doing".equals(task.get("status"))),
          "agentic_smoke: backend must observe tasks mutated by apps/agent"
      );

      List<CompletableFuture<SmokeSupport.JsonResponse>> concurrentCreates = new ArrayList<>();
      for (int index = 0; index < 3; index += 1) {
        final int current = index;
        concurrentCreates.add(CompletableFuture.supplyAsync(() -> {
          try {
            return SmokeSupport.request(
                "POST",
                "http://localhost:" + agentPort + "/tools/task_create/execute",
                Map.of("input", Map.of("title", "Concurrent agent task " + (current + 1)))
            );
          } catch (Exception error) {
            throw new RuntimeException(error);
          }
        }));
        concurrentCreates.add(CompletableFuture.supplyAsync(() -> {
          try {
            return SmokeSupport.request(
                "POST",
                "http://localhost:" + backendPort + "/tasks",
                Map.of("title", "Concurrent backend task " + (current + 1))
            );
          } catch (Exception error) {
            throw new RuntimeException(error);
          }
        }));
      }
      for (CompletableFuture<SmokeSupport.JsonResponse> future : concurrentCreates) {
        SmokeSupport.assertTrue(
            future.join().statusCode < 300,
            "agentic_smoke: concurrent backend/agent writes must all complete"
        );
      }

      SmokeSupport.JsonResponse finalList = SmokeSupport.request("GET", "http://localhost:" + backendPort + "/tasks", null);
      List<Object> finalTasks = SmokeSupport.list(
          SmokeSupport.map(finalList.jsonMap("agentic_smoke: final backend list must return object").get("data"), "agentic_smoke: final list data must be object").get("tasks"),
          "agentic_smoke: final tasks must be array"
      );
      SmokeSupport.assertTrue(finalTasks.size() >= 7, "agentic_smoke: concurrent backend/agent writes must preserve every task");
    }

    System.out.println("agentic_smoke: ok");
  }
}
