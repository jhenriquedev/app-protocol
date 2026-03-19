package scripts;

import java.nio.file.Path;
import java.util.Map;

public final class PortalSmoke {
  private PortalSmoke() {}

  public static void main(String[] args) throws Exception {
    Path dataDirectory = SmokeSupport.tempDirectory("app-java-portal-smoke-");
    int backendPort = SmokeSupport.freePort();
    int portalPort = SmokeSupport.freePort();

    try (SmokeSupport.ManagedProcess backend = SmokeSupport.startJavaProcess(
        "apps.backend.BackendServer",
        Map.of(
            "PORT", String.valueOf(backendPort),
            "APP_JAVA_DATA_DIR", dataDirectory.toString()
        ),
        "portal-backend"
    )) {
      SmokeSupport.waitForHttp("http://localhost:" + backendPort + "/health", "portal backend");

      try (SmokeSupport.ManagedProcess portal = SmokeSupport.startJavaProcess(
          "apps.portal.PortalServer",
          Map.of(
              "PORT", String.valueOf(portalPort),
              "APP_JAVA_API_BASE_URL", "http://localhost:" + backendPort
          ),
          "portal"
      )) {
        SmokeSupport.waitForHttp("http://localhost:" + portalPort + "/", "portal");

        SmokeSupport.JsonResponse page = SmokeSupport.request("GET", "http://localhost:" + portalPort + "/", null);
        SmokeSupport.assertEquals(200, page.statusCode, "portal_smoke: root must return 200");
        SmokeSupport.assertTrue(page.bodyText.contains("Task Board"), "portal_smoke: root must render the board shell");

        SmokeSupport.JsonResponse created = SmokeSupport.requestForm(
            "POST",
            "http://localhost:" + portalPort + "/tasks",
            Map.of(
                "title", "Portal smoke task",
                "description", "Created through the portal smoke"
            )
        );
        SmokeSupport.assertEquals(302, created.statusCode, "portal_smoke: create must redirect");

        SmokeSupport.JsonResponse listed = SmokeSupport.request("GET", "http://localhost:" + backendPort + "/tasks", null);
        Map<String, Object> task = SmokeSupport.map(
            SmokeSupport.list(
                SmokeSupport.map(listed.jsonMap("portal_smoke: backend list must return object").get("data"), "portal_smoke: backend list data must be object").get("tasks"),
                "portal_smoke: backend tasks must be array"
            ).get(0),
            "portal_smoke: newest task must be an object"
        );
        String taskId = SmokeSupport.string(task.get("id"), "portal_smoke: portal-created task must include id");
        SmokeSupport.assertEquals("Portal smoke task", task.get("title"), "portal_smoke: portal create must persist the task");

        SmokeSupport.JsonResponse moved = SmokeSupport.requestForm(
            "POST",
            "http://localhost:" + portalPort + "/tasks/" + taskId + "/status",
            Map.of("targetStatus", "doing")
        );
        SmokeSupport.assertEquals(302, moved.statusCode, "portal_smoke: move must redirect");

        SmokeSupport.JsonResponse afterMove = SmokeSupport.request("GET", "http://localhost:" + backendPort + "/tasks", null);
        Map<String, Object> movedTask = SmokeSupport.map(
            SmokeSupport.list(
                SmokeSupport.map(afterMove.jsonMap("portal_smoke: backend list after move must return object").get("data"), "portal_smoke: backend move data must be object").get("tasks"),
                "portal_smoke: backend move tasks must be array"
            ).get(0),
            "portal_smoke: moved task must be object"
        );
        SmokeSupport.assertEquals("doing", movedTask.get("status"), "portal_smoke: portal move must update backend state");
      }
    }

    System.out.println("portal_smoke: ok");
  }
}
