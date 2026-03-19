import {
  createTempDataDirectory,
  removeDirectory,
  requestJson,
  spawnServer,
  waitForHealth,
} from "./runtime";

async function main() {
  const dataDirectory = await createTempDataDirectory("app-typescript-mcp-http-");
  const agent = spawnServer("apps/agent/server.ts", {
    PORT: "3421",
    DATA_DIRECTORY: dataDirectory,
  });

  try {
    await waitForHealth("http://localhost:3421/health");

    const initialized = await requestJson("http://localhost:3421/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {
            tools: {},
          },
          clientInfo: {
            name: "smoke-suite",
            version: "1.0.0",
          },
        },
      }),
    });

    const initializedPayload = initialized.data as {
      result?: { protocolVersion: string };
      error?: { message: string };
    };

    if (initializedPayload.error || initializedPayload.result?.protocolVersion !== "2025-06-18") {
      throw new Error("MCP HTTP smoke expected successful initialize");
    }

    const tools = await requestJson("http://localhost:3421/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });

    const toolsPayload = tools.data as {
      result?: { tools?: Array<{ name: string }> };
    };

    if (!toolsPayload.result?.tools?.some((tool) => tool.name === "task_create")) {
      throw new Error("MCP HTTP smoke expected task_create in tools/list");
    }

    const created = await requestJson("http://localhost:3421/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "task_create",
          arguments: {
            title: "MCP HTTP item",
            description: "Created through the remote MCP smoke flow.",
          },
        },
      }),
    });

    const createdPayload = created.data as {
      result?: {
        structuredContent?: { id?: string; status?: string };
        isError?: boolean;
      };
    };

    if (
      createdPayload.result?.isError ||
      createdPayload.result?.structuredContent?.status !== "backlog" ||
      !createdPayload.result?.structuredContent?.id
    ) {
      throw new Error("MCP HTTP smoke expected a backlog item");
    }

    const deniedMove = await requestJson("http://localhost:3421/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "task_move",
          arguments: {
            itemId: createdPayload.result.structuredContent.id,
            targetStatus: "complete",
          },
        },
      }),
    });

    const deniedMovePayload = deniedMove.data as {
      result?: {
        structuredContent?: { error?: { code?: string } };
        isError?: boolean;
      };
    };

    if (
      deniedMovePayload.result?.isError !== true ||
      deniedMovePayload.result?.structuredContent?.error?.code !== "CONFIRMATION_REQUIRED"
    ) {
      throw new Error("MCP HTTP smoke expected task_move confirmation enforcement");
    }

    const moved = await requestJson("http://localhost:3421/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "task_move",
          arguments: {
            confirmed: true,
            itemId: createdPayload.result.structuredContent.id,
            targetStatus: "complete",
          },
        },
      }),
    });

    const movedPayload = moved.data as {
      result?: {
        structuredContent?: { status?: string };
        isError?: boolean;
      };
    };

    if (
      movedPayload.result?.isError ||
      movedPayload.result?.structuredContent?.status !== "complete"
    ) {
      throw new Error("MCP HTTP smoke expected task_move to honor confirmed execution");
    }

    console.log("agent mcp http smoke passed");
  } finally {
    await agent.close();
    await removeDirectory(dataDirectory);
  }
}

void main();
