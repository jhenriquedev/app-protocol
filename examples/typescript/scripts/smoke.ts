import {
  createTempDataDirectory,
  removeDirectory,
  requestJson,
  spawnServer,
  waitForHealth,
} from "./runtime";

async function main() {
  const dataDirectory = await createTempDataDirectory("app-typescript-backend-");
  const backend = spawnServer("apps/backend/server.ts", {
    PORT: "3400",
    DATA_DIRECTORY: dataDirectory,
  });

  try {
    await waitForHealth("http://localhost:3400/health");

    const created = await requestJson("http://localhost:3400/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Smoke backend item",
        description: "Created by the backend smoke script.",
      }),
    });

    const createdPayload = created.data as {
      success: boolean;
      data?: { id: string; status: string };
    };

    if (!createdPayload.success || !createdPayload.data) {
      throw new Error("Backend smoke could not create an item");
    }

    const listed = await requestJson("http://localhost:3400/tasks");
    const listedPayload = listed.data as {
      success: boolean;
      data?: { items: Array<{ id: string }> };
    };

    if (!listedPayload.success || listedPayload.data?.items.length !== 1) {
      throw new Error("Backend smoke expected exactly one listed item");
    }

    const moved = await requestJson(
      `http://localhost:3400/tasks/${createdPayload.data.id}/status`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          targetStatus: "active",
        }),
      }
    );

    const movedPayload = moved.data as {
      success: boolean;
      data?: { status: string };
    };

    if (!movedPayload.success || movedPayload.data?.status !== "active") {
      throw new Error("Backend smoke expected the item to move to active");
    }

    console.log("backend smoke passed");
  } finally {
    await backend.close();
    await removeDirectory(dataDirectory);
  }
}

void main();
