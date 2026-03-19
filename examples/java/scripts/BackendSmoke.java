package scripts;

import apps.backend.BackendApp;
import apps.backend.BackendRegistry;
import core.BaseApiCase.ApiContext;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public final class BackendSmoke {
  private BackendSmoke() {}

  public static void main(String[] args) throws Exception {
    Path dataDirectory = SmokeSupport.tempDirectory("app-java-backend-smoke-");
    int port = SmokeSupport.freePort();

    BackendRegistry.BackendConfig config = new BackendRegistry.BackendConfig();
    config.port = port;
    config.dataDirectory = dataDirectory;
    BackendApp app = BackendApp.bootstrap(config);
    ApiContext context = app.createApiContext(Map.of("correlationId", "smoke"));

    SmokeSupport.assertTrue(context.cases.containsKey("tasks"), "backend_smoke: ctx.cases must include tasks");
    SmokeSupport.assertTrue(context.packages.containsKey("data"), "backend_smoke: ctx.packages must include data");

    try (SmokeSupport.ManagedProcess backend = SmokeSupport.startJavaProcess(
        "apps.backend.BackendServer",
        Map.of(
            "PORT", String.valueOf(port),
            "APP_JAVA_DATA_DIR", dataDirectory.toString()
        ),
        "backend"
    )) {
      SmokeSupport.waitForHttp("http://localhost:" + port + "/health", "backend");
      backend.requireRunning();

      SmokeSupport.JsonResponse health = SmokeSupport.request("GET", "http://localhost:" + port + "/health", null);
      SmokeSupport.assertEquals(200, health.statusCode, "backend_smoke: health must return 200");
      SmokeSupport.assertTrue(
          SmokeSupport.bool(health.jsonMap("backend_smoke: health must return object").get("ok"), "backend_smoke: health.ok must be boolean"),
          "backend_smoke: health endpoint must be healthy"
      );

      SmokeSupport.JsonResponse notFound = SmokeSupport.request("GET", "http://localhost:" + port + "/missing", null);
      SmokeSupport.assertEquals(404, notFound.statusCode, "backend_smoke: unknown route must return 404");
      SmokeSupport.assertEquals(
          "NOT_FOUND",
          SmokeSupport.map(
              notFound.jsonMap("backend_smoke: notFound must return object").get("error"),
              "backend_smoke: notFound.error must be an object"
          ).get("code"),
          "backend_smoke: unknown route must keep structured errors"
      );

      SmokeSupport.JsonResponse invalidJson = SmokeSupport.request(
          "POST",
          "http://localhost:" + port + "/tasks",
          "{bad json"
      );
      SmokeSupport.assertEquals(400, invalidJson.statusCode, "backend_smoke: invalid JSON must return 400");
      SmokeSupport.assertEquals(
          "INVALID_REQUEST",
          SmokeSupport.map(
              invalidJson.jsonMap("backend_smoke: invalid JSON must return object").get("error"),
              "backend_smoke: invalid JSON error must be object"
          ).get("code"),
          "backend_smoke: invalid JSON must preserve structured errors"
      );

      Map<String, Object> createInput = new LinkedHashMap<>();
      createInput.put("title", "Smoke test task");
      createInput.put("description", "Created by backend smoke");
      SmokeSupport.JsonResponse created = SmokeSupport.request(
          "POST",
          "http://localhost:" + port + "/tasks",
          createInput
      );
      SmokeSupport.assertEquals(201, created.statusCode, "backend_smoke: create must return 201");
      Map<String, Object> createdBody = created.jsonMap("backend_smoke: create must return object");
      Map<String, Object> createdTask = SmokeSupport.map(
          SmokeSupport.map(createdBody.get("data"), "backend_smoke: create.data must be object").get("task"),
          "backend_smoke: create.data.task must be object"
      );
      String createdTaskId = SmokeSupport.string(createdTask.get("id"), "backend_smoke: created task must include id");
      SmokeSupport.assertEquals("todo", createdTask.get("status"), "backend_smoke: new tasks must start in todo");

      SmokeSupport.JsonResponse listed = SmokeSupport.request("GET", "http://localhost:" + port + "/tasks", null);
      List<Object> tasks = SmokeSupport.list(
          SmokeSupport.map(listed.jsonMap("backend_smoke: list must return object").get("data"), "backend_smoke: list.data must be object").get("tasks"),
          "backend_smoke: list.data.tasks must be an array"
      );
      SmokeSupport.assertTrue(
          tasks.stream().map(item -> SmokeSupport.map(item, "backend_smoke: task must be object"))
              .anyMatch(task -> createdTaskId.equals(task.get("id"))),
          "backend_smoke: created task must appear in the list"
      );

      SmokeSupport.JsonResponse moved = SmokeSupport.request(
          "PATCH",
          "http://localhost:" + port + "/tasks/" + createdTaskId + "/status",
          Map.of("targetStatus", "doing")
      );
      SmokeSupport.assertEquals(200, moved.statusCode, "backend_smoke: move must return 200");
      Map<String, Object> movedTask = SmokeSupport.map(
          SmokeSupport.map(moved.jsonMap("backend_smoke: move must return object").get("data"), "backend_smoke: move.data must be object").get("task"),
          "backend_smoke: move.data.task must be object"
      );
      SmokeSupport.assertEquals("doing", movedTask.get("status"), "backend_smoke: move must update task status");

      List<CompletableFuture<SmokeSupport.JsonResponse>> concurrent = new ArrayList<>();
      for (int index = 0; index < 4; index += 1) {
        final int current = index;
        concurrent.add(CompletableFuture.supplyAsync(() -> {
          try {
            return SmokeSupport.request(
                "POST",
                "http://localhost:" + port + "/tasks",
                Map.of("title", "Concurrent smoke task " + (current + 1))
            );
          } catch (Exception error) {
            throw new RuntimeException(error);
          }
        }));
      }

      List<String> concurrentIds = new ArrayList<>();
      for (CompletableFuture<SmokeSupport.JsonResponse> future : concurrent) {
        SmokeSupport.JsonResponse response = future.join();
        SmokeSupport.assertEquals(201, response.statusCode, "backend_smoke: concurrent creates must succeed");
        Map<String, Object> task = SmokeSupport.map(
            SmokeSupport.map(response.jsonMap("backend_smoke: concurrent create must return object").get("data"), "backend_smoke: concurrent data must be object").get("task"),
            "backend_smoke: concurrent task must be object"
        );
        concurrentIds.add(SmokeSupport.string(task.get("id"), "backend_smoke: concurrent task must include id"));
      }
      SmokeSupport.assertEquals(
          concurrentIds.size(),
          new java.util.LinkedHashSet<>(concurrentIds).size(),
          "backend_smoke: concurrent creates must return distinct task ids"
      );
    }

    try (SmokeSupport.ManagedProcess restarted = SmokeSupport.startJavaProcess(
        "apps.backend.BackendServer",
        Map.of(
            "PORT", String.valueOf(port),
            "APP_JAVA_DATA_DIR", dataDirectory.toString()
        ),
        "backend-restart"
    )) {
      SmokeSupport.waitForHttp("http://localhost:" + port + "/health", "backend restart");
      SmokeSupport.JsonResponse listed = SmokeSupport.request("GET", "http://localhost:" + port + "/tasks", null);
      List<Object> tasks = SmokeSupport.list(
          SmokeSupport.map(listed.jsonMap("backend_smoke: list after restart must return object").get("data"), "backend_smoke: list after restart data must be object").get("tasks"),
          "backend_smoke: list after restart tasks must be array"
      );
      SmokeSupport.assertTrue(tasks.size() >= 5, "backend_smoke: persistence must survive backend restart");
    }

    System.out.println("backend_smoke: ok");
  }
}
