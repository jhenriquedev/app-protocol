import {
  createTempDataDirectory,
  removeDirectory,
  requestText,
  spawnServer,
  waitForHealth,
} from "./runtime";

async function main() {
  const dataDirectory = await createTempDataDirectory("app-typescript-portal-");
  const backend = spawnServer("apps/backend/server.ts", {
    PORT: "3401",
    DATA_DIRECTORY: dataDirectory,
  });
  const portal = spawnServer("apps/portal/server.ts", {
    PORT: "3411",
    BACKEND_BASE_URL: "http://localhost:3401",
  });

  try {
    await waitForHealth("http://localhost:3401/health");
    await waitForHealth("http://localhost:3411/health");

    const created = await requestText("http://localhost:3411/actions/task-create", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        title: "Portal smoke item",
        description: "Created through the portal action.",
      }),
      redirect: "manual",
    });

    if (created.status !== 303) {
      throw new Error("Portal smoke expected a redirect after create");
    }

    const page = await requestText("http://localhost:3411/");
    if (
      !page.text.includes("Task Studio") ||
      !page.text.includes("Portal smoke item")
    ) {
      throw new Error("Portal smoke expected the rendered board item");
    }

    console.log("portal smoke passed");
  } finally {
    await Promise.all([portal.close(), backend.close()]);
    await removeDirectory(dataDirectory);
  }
}

void main();
