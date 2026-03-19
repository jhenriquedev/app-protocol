import { assert, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";

import { bootstrap as bootstrapBackend } from "../apps/backend/app";

const MCP_PROTOCOL_VERSION = "2025-11-25";
const MCP_LEGACY_PROTOCOL_VERSION = "2025-06-18";
const encoder = new TextEncoder();

type RunningServer = Deno.HttpServer<Deno.NetAddr>;
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

async function closeServer(server: RunningServer): Promise<void> {
  await server.shutdown();
}

async function startBackend(dataDirectory: string): Promise<{
  server: RunningServer;
  baseUrl: string;
}> {
  const app = bootstrapBackend({
    dataDirectory,
    port: 0,
  });
  const server = await app.startBackend();

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.addr.port}`,
  };
}

async function assertSuccess<T>(
  response: Response,
  description: string,
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
      }`,
    );
  }

  return payload.data;
}

async function readLines(
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void | Promise<void>,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
        buffer = buffer.slice(newlineIndex + 1);
        await onLine(line);
        newlineIndex = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();
    const finalLine = buffer.replace(/\r$/, "");
    if (finalLine) {
      await onLine(finalLine);
    }
  } finally {
    reader.releaseLock();
  }
}

class McpClient {
  private readonly child: Deno.ChildProcess;
  private readonly stdinWriter: WritableStreamDefaultWriter<Uint8Array>;
  private readonly pending = new Map<
    JsonRpcId,
    {
      resolve(value: unknown): void;
      reject(error: Error): void;
    }
  >();
  private readonly stderrLines: string[] = [];
  private readonly readers: Promise<void>[];
  private nextId = 1;

  constructor(child: Deno.ChildProcess) {
    this.child = child;

    if (!child.stdin || !child.stdout || !child.stderr) {
      throw new Error("agent_mcp_smoke: MCP child must use piped stdio");
    }

    this.stdinWriter = child.stdin.getWriter();
    this.readers = [
      this.readStdout(child.stdout),
      this.readStderr(child.stderr),
      this.observeExit(),
    ];
  }

  private async observeExit(): Promise<void> {
    const status = await this.child.status;

    if (status.success) {
      return;
    }

    const error = new Error(
      `MCP child exited unexpectedly with code ${status.code}`,
    );

    for (const [, resolver] of this.pending) {
      resolver.reject(error);
    }

    this.pending.clear();
  }

  private async readStdout(stream: ReadableStream<Uint8Array>): Promise<void> {
    await readLines(stream, (line) => {
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
            }`,
          ),
        );
        return;
      }

      resolver.resolve(message.result);
    });
  }

  private async readStderr(stream: ReadableStream<Uint8Array>): Promise<void> {
    await readLines(stream, (line) => {
      this.stderrLines.push(line);
    });
  }

  private async writeMessage(payload: unknown): Promise<void> {
    await this.stdinWriter.write(
      encoder.encode(`${JSON.stringify(payload)}\n`),
    );
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

    await this.writeMessage(payload);
    return result;
  }

  public notify(method: string, params?: unknown): void {
    const payload = {
      jsonrpc: "2.0" as const,
      method,
      ...(params !== undefined ? { params } : {}),
    };

    void this.writeMessage(payload);
  }

  public async close(): Promise<void> {
    await this.stdinWriter.close().catch(() => undefined);
    try {
      this.child.kill("SIGTERM");
    } catch {
      // Ignore: the child may already be stopped.
    }

    await Promise.allSettled(this.readers);
  }

  public stderrSummary(): string {
    return this.stderrLines.join("\n");
  }
}

async function run(): Promise<void> {
  const tempDirectory = await Deno.makeTempDir({
    prefix: "app-deno-agent-mcp-smoke-",
  });
  const projectRoot = fromFileUrl(new URL("..", import.meta.url));

  let backendServer: RunningServer | undefined;
  let mcpClient: McpClient | undefined;

  try {
    const backend = await startBackend(tempDirectory);
    backendServer = backend.server;

    const child = new Deno.Command(Deno.execPath(), {
      cwd: projectRoot,
      args: [
        "run",
        "--unstable-sloppy-imports",
        "-A",
        "apps/agent/mcp_server.ts",
      ],
      env: {
        APP_DENO_DATA_DIR: tempDirectory,
      },
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    }).spawn();

    mcpClient = new McpClient(child);

    let unsupportedProtocolError: string | undefined;
    try {
      await mcpClient.request("initialize", {
        protocolVersion: "1999-01-01",
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: "agent-mcp-smoke",
          version: "1.0.0",
        },
      });
    } catch (error: unknown) {
      unsupportedProtocolError = error instanceof Error
        ? error.message
        : String(error);
    }

    assert(
      unsupportedProtocolError?.includes("Unsupported MCP protocol version"),
      "agent_mcp_smoke: initialize must reject unknown protocol versions explicitly",
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

    assertEquals(
      initialize.protocolVersion,
      MCP_PROTOCOL_VERSION,
      "agent_mcp_smoke: initialize must negotiate the host-supported MCP protocol version",
    );
    assertEquals(
      initialize.serverInfo.name,
      "deno-task-board-agent",
      "agent_mcp_smoke: initialize must expose the agent host server name",
    );
    assertEquals(
      initialize.capabilities.resources?.listChanged,
      false,
      "agent_mcp_smoke: initialize must advertise MCP resources support",
    );
    assertEquals(
      initialize.instructions?.includes("Tool task_create"),
      true,
      "agent_mcp_smoke: initialize instructions must include the registry-derived prompt fragments",
    );

    mcpClient.notify("notifications/initialized");

    const list = await mcpClient.request<{
      tools: Array<{
        name: string;
        description?: string;
        annotations?: { appSemantic?: { resourceUri?: string } };
      }>;
    }>("tools/list");
    const toolNames = list.tools.map((tool) => tool.name).sort();

    assertEquals(
      toolNames,
      ["task_create", "task_list", "task_move"],
      "agent_mcp_smoke: MCP tools/list must expose the three task tools",
    );
    assertEquals(
      list.tools.some(
        (tool) =>
          tool.name === "task_move" &&
          tool.description?.includes(
            "Require confirmation before mutating the board",
          ),
      ),
      true,
      "agent_mcp_smoke: MCP tool descriptions must project semantic prompt/constraint data",
    );

    const resources = await mcpClient.request<{
      resources: Array<{ uri: string; name: string }>;
    }>("resources/list");
    const resourceUris = resources.resources.map((resource) => resource.uri)
      .sort();

    assertEquals(
      resourceUris,
      [
        "app://agent/system/prompt",
        "app://agent/tools/task_create/semantic",
        "app://agent/tools/task_list/semantic",
        "app://agent/tools/task_move/semantic",
      ],
      "agent_mcp_smoke: resources/list must publish the system prompt plus one semantic resource per tool",
    );

    const moveSemantic = await mcpClient.request<{
      contents: Array<{ uri: string; text: string }>;
    }>("resources/read", {
      uri: "app://agent/tools/task_move/semantic",
    });
    const moveSemanticPayload = JSON.parse(
      moveSemantic.contents[0]?.text ?? "{}",
    ) as {
      semanticSummary?: string;
      promptFragment?: string;
      definition?: {
        rag?: {
          resources?: Array<{ ref?: string }>;
        };
      };
    };

    assertEquals(
      moveSemanticPayload.promptFragment?.includes("Tool task_move"),
      true,
      "agent_mcp_smoke: resources/read must expose the tool prompt fragment",
    );
    assertEquals(
      moveSemanticPayload.definition?.rag?.resources?.some(
        (resource) => resource.ref === "tasks/task_list",
      ),
      true,
      "agent_mcp_smoke: resources/read must preserve RAG resources from the registry definition",
    );

    const invalidCreate = await mcpClient.request<McpToolCallResult>(
      "tools/call",
      {
        name: "task_create",
        arguments: {
          title: "   ",
        },
      },
    );

    assertEquals(
      invalidCreate.isError,
      true,
      "agent_mcp_smoke: invalid task_create must surface an MCP tool error result",
    );
    assertEquals(
      (invalidCreate.structuredContent as {
        success: boolean;
        error?: { code?: string };
      }).success,
      false,
      "agent_mcp_smoke: invalid task_create must preserve success=false in structuredContent",
    );
    assertEquals(
      (invalidCreate.structuredContent as {
        error?: { code?: string };
      }).error?.code,
      "VALIDATION_FAILED",
      "agent_mcp_smoke: invalid task_create must preserve the APP validation code",
    );

    const created = await mcpClient.request<McpToolCallResult>("tools/call", {
      name: "task_create",
      arguments: {
        title: "MCP-created task",
        description: "Created through MCP stdio",
      },
    });

    assertEquals(
      created.isError,
      false,
      "agent_mcp_smoke: task_create must succeed through MCP",
    );

    const createdPayload = created.structuredContent as { task: Task };
    assertEquals(
      createdPayload.task.status,
      "todo",
      "agent_mcp_smoke: MCP task_create must create todo tasks",
    );

    const listed = await mcpClient.request<McpToolCallResult>("tools/call", {
      name: "task_list",
      arguments: {},
    });
    const listedPayload = listed.structuredContent as { tasks: Task[] };

    assertEquals(
      listedPayload.tasks.some((task) => task.id === createdPayload.task.id),
      true,
      "agent_mcp_smoke: MCP task_list must see tasks created through MCP",
    );

    const moveWithoutConfirmation = await mcpClient.request<McpToolCallResult>(
      "tools/call",
      {
        name: "task_move",
        arguments: {
          taskId: createdPayload.task.id,
          targetStatus: "doing",
        },
      },
    );

    assertEquals(
      moveWithoutConfirmation.isError,
      true,
      "agent_mcp_smoke: task_move without confirmation must fail through MCP",
    );
    assertEquals(
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
      "agent_mcp_smoke: task_move without confirmation must preserve success=false",
    );
    assertEquals(
      (moveWithoutConfirmation.structuredContent as {
        error?: { code?: string };
      }).error?.code,
      "CONFIRMATION_REQUIRED",
      "agent_mcp_smoke: MCP task_move must preserve confirmation error codes",
    );
    assertEquals(
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
      "agent_mcp_smoke: MCP task_move must preserve confirmation details",
    );

    const moved = await mcpClient.request<McpToolCallResult>("tools/call", {
      name: "task_move",
      arguments: {
        taskId: createdPayload.task.id,
        targetStatus: "doing",
        confirmed: true,
      },
    });

    assertEquals(
      moved.isError,
      false,
      "agent_mcp_smoke: confirmed task_move must succeed through MCP",
    );

    const movedPayload = moved.structuredContent as { task: Task };
    assertEquals(
      movedPayload.task.status,
      "doing",
      "agent_mcp_smoke: MCP task_move must mutate the task",
    );

    const listedByBackend = await assertSuccess<{ tasks: Task[] }>(
      await fetch(`${backend.baseUrl}/tasks`),
      "backend list after MCP execution",
    );

    const movedTask = listedByBackend.tasks.find((task) =>
      task.id === createdPayload.task.id
    );
    assert(
      movedTask,
      `agent_mcp_smoke: backend must observe tasks written through the MCP agent host\n${mcpClient.stderrSummary()}`,
    );
    assertEquals(
      movedTask.status,
      "doing",
      "agent_mcp_smoke: backend must observe the status written through MCP",
    );
  } finally {
    if (mcpClient) {
      await mcpClient.close();
    }

    if (backendServer) {
      await closeServer(backendServer).catch(() => undefined);
    }

    await Deno.remove(tempDirectory, { recursive: true }).catch(() =>
      undefined
    );
  }
}

void run().catch((error: unknown) => {
  console.error(
    "agent_mcp_smoke failed",
    error instanceof Error ? error.stack ?? error.message : error,
  );
  Deno.exit(1);
});
