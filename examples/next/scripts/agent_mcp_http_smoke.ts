import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import { join } from "node:path";

import { bootstrap as bootstrapAgent } from "../apps/agent/app";
import { bootstrap as bootstrapBackend } from "../apps/backend/app";

const MCP_PROTOCOL_VERSION = "2025-11-25";
const MCP_LEGACY_PROTOCOL_VERSION = "2025-06-18";

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type Task = {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "done";
  createdAt: string;
  updatedAt: string;
};

type McpToolCallResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
};

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function startServer(
  kind: "backend" | "agent",
  dataDirectory: string
): Promise<{
  server: Server;
  baseUrl: string;
}> {
  if (kind === "backend") {
    const app = bootstrapBackend({
      dataDirectory,
      port: 0,
    });
    const server = await app.startBackend();
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("agent_mcp_http_smoke: failed to resolve backend address");
    }

    return {
      server,
      baseUrl: `http://127.0.0.1:${address.port}`,
    };
  }

  const app = bootstrapAgent({
    dataDirectory,
    port: 0,
  });
  const server = await app.startAgent();
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("agent_mcp_http_smoke: failed to resolve agent address");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function mcpPost<T>(
  endpoint: string,
  payload: unknown
): Promise<{
  response: Response;
  body: T;
}> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as T;
  return { response, body };
}

async function assertBackendTasks(
  baseUrl: string
): Promise<{ tasks: Task[] }> {
  const response = await fetch(`${baseUrl}/tasks`);
  const payload = (await response.json()) as {
    success: boolean;
    data?: { tasks: Task[] };
  };

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error("agent_mcp_http_smoke: backend list failed");
  }

  return payload.data;
}

async function run(): Promise<void> {
  const tempDirectory = await mkdtemp(
    join(os.tmpdir(), "app-next-agent-mcp-http-smoke-")
  );
  let backendServer: Server | undefined;
  let agentServer: Server | undefined;

  try {
    const backend = await startServer("backend", tempDirectory);
    const agent = await startServer("agent", tempDirectory);
    backendServer = backend.server;
    agentServer = agent.server;

    const mcpUrl = `${agent.baseUrl}/mcp`;

    const getResponse = await fetch(mcpUrl, {
      headers: {
        accept: "text/event-stream",
      },
    });
    assert.equal(
      getResponse.status,
      405,
      "agent_mcp_http_smoke: GET /mcp should explicitly reject SSE when unsupported"
    );

    const invalidInitialize = await mcpPost<JsonRpcResponse>(mcpUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "1999-01-01",
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: "agent-mcp-http-smoke",
          version: "1.0.0",
        },
      },
    });

    assert.equal(
      invalidInitialize.response.status,
      200,
      "agent_mcp_http_smoke: initialize errors should return JSON-RPC payloads"
    );
    assert.equal(
      invalidInitialize.body.error?.message.includes(
        "Unsupported MCP protocol version"
      ),
      true,
      "agent_mcp_http_smoke: initialize must reject unsupported MCP versions"
    );

    const initialize = await mcpPost<JsonRpcResponse>(mcpUrl, {
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: {
        protocolVersion: MCP_LEGACY_PROTOCOL_VERSION,
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: "agent-mcp-http-smoke",
          version: "1.0.0",
        },
      },
    });

    assert.equal(
      initialize.body.result !== undefined,
      true,
      "agent_mcp_http_smoke: initialize must return a result"
    );
    const initializeResult = initialize.body.result as {
      protocolVersion: string;
      capabilities?: {
        resources?: {
          listChanged?: boolean;
        };
      };
      serverInfo: { name: string };
      instructions?: string;
    };
    assert.equal(
      initializeResult.protocolVersion,
      MCP_PROTOCOL_VERSION,
      "agent_mcp_http_smoke: initialize must negotiate the host-supported protocol version"
    );
    assert.equal(
      initializeResult.serverInfo.name,
      "next-task-board-agent",
      "agent_mcp_http_smoke: initialize must expose the agent host server name"
    );
    assert.equal(
      initializeResult.capabilities?.resources?.listChanged,
      false,
      "agent_mcp_http_smoke: initialize must advertise MCP resources support"
    );
    assert.equal(
      initializeResult.instructions?.includes("Tool task_list"),
      true,
      "agent_mcp_http_smoke: initialize instructions must include registry-derived prompt fragments"
    );

    const initializedNotification = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      }),
    });

    assert.equal(
      initializedNotification.status,
      202,
      "agent_mcp_http_smoke: notifications/initialized should be accepted"
    );

    const listed = await mcpPost<JsonRpcResponse>(mcpUrl, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
      params: {},
    });

    const listedTools = (
      listed.body.result as {
        tools: Array<{ name: string; description?: string }>;
      }
    ).tools
      .map((tool) => tool.name)
      .sort();
    assert.deepEqual(
      listedTools,
      ["task_create", "task_list", "task_move"],
      "agent_mcp_http_smoke: remote MCP tools/list must expose the three task tools"
    );
    assert.equal(
      (
        listed.body.result as {
          tools: Array<{ name: string; description?: string }>;
        }
      ).tools.some(
        (tool) =>
          tool.name === "task_list" &&
          tool.description?.includes("Use when: When the user asks to see the board")
      ),
      true,
      "agent_mcp_http_smoke: remote MCP descriptors must include semantic summaries from prompt/discovery/context"
    );

    const listedResources = await mcpPost<JsonRpcResponse>(mcpUrl, {
      jsonrpc: "2.0",
      id: 4,
      method: "resources/list",
      params: {},
    });
    const resourceUris = (
      listedResources.body.result as {
        resources: Array<{ uri: string }>;
      }
    ).resources
      .map((resource) => resource.uri)
      .sort();
    assert.deepEqual(
      resourceUris,
      [
        "app://agent/system/prompt",
        "app://agent/tools/task_create/semantic",
        "app://agent/tools/task_list/semantic",
        "app://agent/tools/task_move/semantic",
      ],
      "agent_mcp_http_smoke: remote MCP resources/list must publish the system prompt plus per-tool semantic resources"
    );

    const promptResource = await mcpPost<JsonRpcResponse>(mcpUrl, {
      jsonrpc: "2.0",
      id: 5,
      method: "resources/read",
      params: {
        uri: "app://agent/system/prompt",
      },
    });
    const promptText = (
      promptResource.body.result as { contents: Array<{ text: string }> }
    ).contents[0]?.text;
    assert.equal(
      promptText?.includes("Tool task_move"),
      true,
      "agent_mcp_http_smoke: resources/read must expose the host global prompt built from tool fragments"
    );

    const invalidCreate = await mcpPost<JsonRpcResponse>(mcpUrl, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "task_create",
        arguments: {
          title: "   ",
        },
      },
    });

    const invalidCreateResult = invalidCreate.body.result as McpToolCallResult;
    assert.equal(
      invalidCreateResult.isError,
      true,
      "agent_mcp_http_smoke: invalid task_create must fail through remote MCP"
    );
    assert.equal(
      (invalidCreateResult.structuredContent as {
        error?: { code?: string };
      }).error?.code,
      "VALIDATION_FAILED",
      "agent_mcp_http_smoke: invalid task_create must preserve the APP validation code"
    );

    const created = await mcpPost<JsonRpcResponse>(mcpUrl, {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "task_create",
        arguments: {
          title: "Remote MCP task",
          description: "Created through streamable HTTP MCP",
        },
      },
    });

    const createdResult = created.body.result as McpToolCallResult;
    assert.equal(
      createdResult.isError,
      false,
      "agent_mcp_http_smoke: task_create must succeed through remote MCP"
    );
    const createdTask = (createdResult.structuredContent as { task: Task }).task;

    const moveWithoutConfirmation = await mcpPost<JsonRpcResponse>(mcpUrl, {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "task_move",
        arguments: {
          taskId: createdTask.id,
          targetStatus: "doing",
        },
      },
    });

    const moveWithoutConfirmationResult =
      moveWithoutConfirmation.body.result as McpToolCallResult;
    assert.equal(
      moveWithoutConfirmationResult.isError,
      true,
      "agent_mcp_http_smoke: task_move without confirmation must fail through remote MCP"
    );
    assert.equal(
      (moveWithoutConfirmationResult.structuredContent as {
        error?: { code?: string };
      }).error?.code,
      "CONFIRMATION_REQUIRED",
      "agent_mcp_http_smoke: task_move without confirmation must preserve the confirmation code"
    );

    const moved = await mcpPost<JsonRpcResponse>(mcpUrl, {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "task_move",
        arguments: {
          taskId: createdTask.id,
          targetStatus: "doing",
          confirmed: true,
        },
      },
    });

    const movedResult = moved.body.result as McpToolCallResult;
    assert.equal(
      movedResult.isError,
      false,
      "agent_mcp_http_smoke: confirmed task_move must succeed through remote MCP"
    );

    const backendTasks = await assertBackendTasks(backend.baseUrl);
    assert.equal(
      backendTasks.tasks.some((task) => task.id === createdTask.id),
      true,
      "agent_mcp_http_smoke: backend must observe tasks created through remote MCP"
    );
    assert.equal(
      backendTasks.tasks.find((task) => task.id === createdTask.id)?.status,
      "doing",
      "agent_mcp_http_smoke: backend must observe status changes made through remote MCP"
    );
  } finally {
    await Promise.allSettled([
      backendServer ? closeServer(backendServer) : Promise.resolve(),
      agentServer ? closeServer(agentServer) : Promise.resolve(),
    ]);
    await rm(tempDirectory, {
      recursive: true,
      force: true,
    });
  }
}

void run().catch((error: unknown) => {
  console.error(
    "agent_mcp_http_smoke failed",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
