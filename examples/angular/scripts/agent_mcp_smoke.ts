import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { bootstrap as bootstrapBackend } from "../apps/backend/app";

const MCP_PROTOCOL_VERSION = "2025-11-25";
const MCP_LEGACY_PROTOCOL_VERSION = "2025-06-18";

type JsonRpcId = string | number | null;

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
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

async function startBackend(dataDirectory: string): Promise<{
  server: Server;
  baseUrl: string;
}> {
  const app = bootstrapBackend({
    dataDirectory,
    port: 0,
  });
  const server = await app.startBackend();
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("agent_mcp_smoke: failed to resolve backend address");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function assertSuccess<T>(
  response: Response,
  description: string
): Promise<T> {
  const payload = (await response.json()) as {
    success: boolean;
    data?: T;
    error?: { message?: string };
  };

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(
      `agent_mcp_smoke: ${description} failed: ${
        payload.error?.message ?? `HTTP ${response.status}`
      }`
    );
  }

  return payload.data;
}

class McpClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<
    JsonRpcId,
    {
      resolve(value: unknown): void;
      reject(error: Error): void;
    }
  >();
  private nextId = 1;
  private readonly stderrLines: string[] = [];

  constructor(child: ChildProcessWithoutNullStreams) {
    this.child = child;

    const stdoutReader = createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    stdoutReader.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      const message = JSON.parse(trimmed) as JsonRpcResponse;
      const resolver = this.pending.get(message.id);
      if (!resolver) {
        return;
      }

      this.pending.delete(message.id);

      if (message.error) {
        resolver.reject(
          new Error(
            `MCP error ${message.error.code}: ${message.error.message}${
              message.error.data ? ` ${JSON.stringify(message.error.data)}` : ""
            }`
          )
        );
        return;
      }

      resolver.resolve(message.result);
    });

    const stderrReader = createInterface({
      input: child.stderr,
      crlfDelay: Infinity,
    });

    stderrReader.on("line", (line) => {
      this.stderrLines.push(line);
    });
  }

  public async request<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    const payload = {
      jsonrpc: "2.0" as const,
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    };

    const result = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });

    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
    return result;
  }

  public notify(method: string, params?: unknown): void {
    const payload = {
      jsonrpc: "2.0" as const,
      method,
      ...(params !== undefined ? { params } : {}),
    };

    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  public async close(): Promise<void> {
    this.child.kill("SIGTERM");

    await new Promise<void>((resolve) => {
      this.child.once("exit", () => resolve());
    });
  }

  public stderrSummary(): string {
    return this.stderrLines.join("\n");
  }
}

async function run(): Promise<void> {
  const tempDirectory = await mkdtemp(
    join(os.tmpdir(), "app-angular-agent-mcp-smoke-")
  );
  const projectRoot = fileURLToPath(new URL("..", import.meta.url));
  const tsxBinary = join(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx"
  );

  let backendServer: Server | undefined;
  let mcpClient: McpClient | undefined;

  try {
    const backend = await startBackend(tempDirectory);
    backendServer = backend.server;

    const child = spawn(tsxBinary, ["apps/agent/mcp_server.ts"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        APP_ANGULAR_DATA_DIR: tempDirectory,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    mcpClient = new McpClient(child);

    await assert.rejects(
      () =>
        mcpClient!.request("initialize", {
          protocolVersion: "1999-01-01",
          capabilities: {
            tools: {},
          },
          clientInfo: {
            name: "agent-mcp-smoke",
            version: "1.0.0",
          },
        }),
      /Unsupported MCP protocol version/,
      "agent_mcp_smoke: initialize must reject unknown protocol versions explicitly"
    );

    const initialize = await mcpClient.request<{
      protocolVersion: string;
      capabilities: {
        tools?: {
          listChanged?: boolean;
        };
        resources?: {
          listChanged?: boolean;
        };
      };
      serverInfo: {
        name: string;
        version: string;
      };
      instructions?: string;
    }>("initialize", {
      protocolVersion: MCP_LEGACY_PROTOCOL_VERSION,
      capabilities: {
        tools: {},
      },
      clientInfo: {
        name: "agent-mcp-smoke",
        version: "1.0.0",
      },
    });

    assert.equal(
      initialize.protocolVersion,
      MCP_PROTOCOL_VERSION,
      "agent_mcp_smoke: initialize must negotiate the host-supported MCP protocol version"
    );
    assert.equal(
      initialize.serverInfo.name,
      "angular-task-board-agent",
      "agent_mcp_smoke: initialize must expose the agent host server name"
    );
    assert.equal(
      initialize.capabilities.resources?.listChanged,
      false,
      "agent_mcp_smoke: initialize must advertise MCP resources support"
    );
    assert.equal(
      initialize.instructions?.includes("Tool task_create"),
      true,
      "agent_mcp_smoke: initialize instructions must include the registry-derived prompt fragments"
    );

    mcpClient.notify("notifications/initialized");

    const list = await mcpClient.request<{
      tools: Array<{ name: string; description?: string; annotations?: { appSemantic?: { resourceUri?: string } } }>;
    }>("tools/list");
    const toolNames = list.tools.map((tool) => tool.name).sort();

    assert.deepEqual(
      toolNames,
      ["task_create", "task_list", "task_move"],
      "agent_mcp_smoke: MCP tools/list must expose the three task tools"
    );
    assert.equal(
      list.tools.some(
        (tool) =>
          tool.name === "task_move" &&
          tool.description?.includes("Require confirmation before mutating the board")
      ),
      true,
      "agent_mcp_smoke: MCP tool descriptions must project semantic prompt/constraint data"
    );

    const resources = await mcpClient.request<{
      resources: Array<{ uri: string; name: string }>;
    }>("resources/list");
    const resourceUris = resources.resources.map((resource) => resource.uri).sort();

    assert.deepEqual(
      resourceUris,
      [
        "app://agent/system/prompt",
        "app://agent/tools/task_create/semantic",
        "app://agent/tools/task_list/semantic",
        "app://agent/tools/task_move/semantic",
      ],
      "agent_mcp_smoke: resources/list must publish the system prompt plus one semantic resource per tool"
    );

    const moveSemantic = await mcpClient.request<{
      contents: Array<{ uri: string; text: string }>;
    }>("resources/read", {
      uri: "app://agent/tools/task_move/semantic",
    });
    const moveSemanticPayload = JSON.parse(moveSemantic.contents[0]?.text ?? "{}") as {
      semanticSummary?: string;
      promptFragment?: string;
      definition?: {
        rag?: {
          resources?: Array<{ ref?: string }>;
        };
      };
    };

    assert.equal(
      moveSemanticPayload.promptFragment?.includes("Tool task_move"),
      true,
      "agent_mcp_smoke: resources/read must expose the tool prompt fragment"
    );
    assert.equal(
      moveSemanticPayload.definition?.rag?.resources?.some(
        (resource) => resource.ref === "tasks/task_list"
      ),
      true,
      "agent_mcp_smoke: resources/read must preserve RAG resources from the registry definition"
    );

    const invalidCreate = await mcpClient.request<McpToolCallResult>("tools/call", {
      name: "task_create",
      arguments: {
        title: "   ",
      },
    });

    assert.equal(
      invalidCreate.isError,
      true,
      "agent_mcp_smoke: invalid task_create must surface an MCP tool error result"
    );
    assert.equal(
      (invalidCreate.structuredContent as {
        success: boolean;
        error?: { code?: string };
      }).success,
      false,
      "agent_mcp_smoke: invalid task_create must preserve success=false in structuredContent"
    );
    assert.equal(
      (invalidCreate.structuredContent as {
        error?: { code?: string };
      }).error?.code,
      "VALIDATION_FAILED",
      "agent_mcp_smoke: invalid task_create must preserve the APP validation code"
    );

    const created = await mcpClient.request<McpToolCallResult>("tools/call", {
      name: "task_create",
      arguments: {
        title: "MCP-created task",
        description: "Created through MCP stdio",
      },
    });

    assert.equal(
      created.isError,
      false,
      "agent_mcp_smoke: task_create must succeed through MCP"
    );

    const createdPayload = created.structuredContent as { task: Task };
    assert.equal(
      createdPayload.task.status,
      "todo",
      "agent_mcp_smoke: MCP task_create must create todo tasks"
    );

    const listed = await mcpClient.request<McpToolCallResult>("tools/call", {
      name: "task_list",
      arguments: {},
    });
    const listedPayload = listed.structuredContent as { tasks: Task[] };

    assert.equal(
      listedPayload.tasks.some((task) => task.id === createdPayload.task.id),
      true,
      "agent_mcp_smoke: MCP task_list must see tasks created through MCP"
    );

    const moveWithoutConfirmation = await mcpClient.request<McpToolCallResult>(
      "tools/call",
      {
        name: "task_move",
        arguments: {
          taskId: createdPayload.task.id,
          targetStatus: "doing",
        },
      }
    );

    assert.equal(
      moveWithoutConfirmation.isError,
      true,
      "agent_mcp_smoke: task_move without confirmation must fail through MCP"
    );
    assert.equal(
      (moveWithoutConfirmation.structuredContent as {
        success: boolean;
        error?: {
          code?: string;
          details?: {
            toolName?: string;
            executionMode?: string;
          };
        };
      }).success,
      false,
      "agent_mcp_smoke: task_move without confirmation must preserve success=false"
    );
    assert.equal(
      (moveWithoutConfirmation.structuredContent as {
        error?: { code?: string };
      }).error?.code,
      "CONFIRMATION_REQUIRED",
      "agent_mcp_smoke: MCP task_move must preserve confirmation error codes"
    );
    assert.deepEqual(
      (moveWithoutConfirmation.structuredContent as {
        error?: {
          details?: {
            toolName?: string;
            executionMode?: string;
          };
        };
      }).error?.details,
      {
        toolName: "task_move",
        executionMode: "manual-approval",
      },
      "agent_mcp_smoke: MCP task_move must preserve confirmation details"
    );

    const moved = await mcpClient.request<McpToolCallResult>("tools/call", {
      name: "task_move",
      arguments: {
        taskId: createdPayload.task.id,
        targetStatus: "doing",
        confirmed: true,
      },
    });

    assert.equal(
      moved.isError,
      false,
      "agent_mcp_smoke: confirmed task_move must succeed through MCP"
    );

    const movedPayload = moved.structuredContent as { task: Task };
    assert.equal(
      movedPayload.task.status,
      "doing",
      "agent_mcp_smoke: MCP task_move must mutate the task"
    );

    const listedByBackend = await assertSuccess<{ tasks: Task[] }>(
      await fetch(`${backend.baseUrl}/tasks`),
      "backend list after MCP execution"
    );

    const movedTask = listedByBackend.tasks.find(
      (task) => task.id === createdPayload.task.id
    );
    assert.ok(
      movedTask,
      "agent_mcp_smoke: backend must observe tasks written through the MCP agent host"
    );
    assert.equal(
      movedTask.status,
      "doing",
      "agent_mcp_smoke: backend must observe the status written through MCP"
    );
  } finally {
    if (mcpClient) {
      await mcpClient.close();
    }

    if (backendServer) {
      await closeServer(backendServer);
    }

    await rm(tempDirectory, { recursive: true, force: true });
  }
}

void run().catch((error: unknown) => {
  console.error(
    "agent_mcp_smoke failed",
    error instanceof Error ? error.stack ?? error.message : error
  );
  process.exitCode = 1;
});
