import {
  createTempDataDirectory,
  removeDirectory,
  requestJson,
  spawnServer,
  waitForHealth,
} from "./runtime";

async function main() {
  const dataDirectory = await createTempDataDirectory("app-typescript-agentic-");
  const agent = spawnServer("apps/agent/server.ts", {
    PORT: "3420",
    DATA_DIRECTORY: dataDirectory,
  });

  try {
    await waitForHealth("http://localhost:3420/health");

    const catalog = await requestJson("http://localhost:3420/catalog");
    const catalogPayload = catalog.data as {
      success?: boolean;
      data?: {
        systemPrompt?: string;
        resources?: Array<{ uri: string }>;
        tools?: Array<{ publishedName: string; requiresConfirmation: boolean }>;
      };
    };

    if (!catalogPayload.success || !catalogPayload.data) {
      throw new Error("Agentic smoke expected a successful catalog envelope");
    }

    if (
      !catalogPayload.data.tools?.some(
        (entry) => entry.publishedName === "task_create"
      )
    ) {
      throw new Error("Agentic smoke expected task_create in catalog");
    }

    if (!catalogPayload.data.systemPrompt?.includes("Tool task_create")) {
      throw new Error("Agentic smoke expected the host system prompt in catalog");
    }

    const resourceUris = (catalogPayload.data.resources ?? [])
      .map((resource) => resource.uri)
      .sort();

    if (
      JSON.stringify(resourceUris) !==
      JSON.stringify([
        "app://agent/system/prompt",
        "app://agent/tools/task_create/semantic",
        "app://agent/tools/task_list/semantic",
        "app://agent/tools/task_move/semantic",
      ])
    ) {
      throw new Error("Agentic smoke expected the canonical MCP semantic resources");
    }

    const created = await requestJson("http://localhost:3420/tools/task_create/execute", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        input: {
          title: "Agentic smoke item",
          description: "Created through the HTTP agent host.",
        },
      }),
    });

    const createdPayload = created.data as {
      success: boolean;
      data?: { id: string; status: string };
    };

    if (!createdPayload.success || createdPayload.data?.status !== "backlog") {
      throw new Error("Agentic smoke expected a backlog item");
    }

    const moveWithoutConfirmation = await requestJson(
      "http://localhost:3420/tools/task_move/execute",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          input: {
            itemId: createdPayload.data.id,
            targetStatus: "complete",
          },
        }),
      }
    );

    const moveWithoutConfirmationPayload = moveWithoutConfirmation.data as {
      success: boolean;
      error?: { code?: string };
    };

    if (
      moveWithoutConfirmationPayload.success !== false ||
      moveWithoutConfirmationPayload.error?.code !== "CONFIRMATION_REQUIRED"
    ) {
      throw new Error(
        "Agentic smoke expected task_move to enforce confirmation over HTTP"
      );
    }

    const moved = await requestJson("http://localhost:3420/tools/task_move/execute", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        confirmed: true,
        input: {
          itemId: createdPayload.data.id,
          targetStatus: "complete",
        },
      }),
    });

    const movedPayload = moved.data as {
      success: boolean;
      data?: { status: string };
    };

    if (!movedPayload.success || movedPayload.data?.status !== "complete") {
      throw new Error("Agentic smoke expected the moved item to be complete");
    }

    console.log("agentic smoke passed");
  } finally {
    await agent.close();
    await removeDirectory(dataDirectory);
  }
}

void main();
