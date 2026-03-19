import readline from "node:readline";
import {
  createTempDataDirectory,
  removeDirectory,
  spawnServer,
} from "./runtime";

interface JsonRpcResponse {
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

class StdioSession {
  private nextId = 1;
  private readonly rl: readline.Interface;
  private readonly pending = new Map<number, (response: JsonRpcResponse) => void>();

  constructor(private readonly server: ReturnType<typeof spawnServer>) {
    this.rl = readline.createInterface({
      input: this.server.child.stdout!,
      crlfDelay: Infinity,
    });

    this.rl.on("line", (line) => {
      const parsed = JSON.parse(line) as JsonRpcResponse;
      if (typeof parsed.id === "number") {
        const resolve = this.pending.get(parsed.id);
        if (resolve) {
          this.pending.delete(parsed.id);
          resolve(parsed);
        }
      }
    });
  }

  async call(method: string, params?: unknown): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    const payload = {
      jsonrpc: "2.0" as const,
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    };

    const response = new Promise<JsonRpcResponse>((resolve) => {
      this.pending.set(id, resolve);
    });

    this.server.child.stdin!.write(`${JSON.stringify(payload)}\n`);
    return response;
  }

  close() {
    this.rl.close();
  }
}

async function main() {
  const dataDirectory = await createTempDataDirectory("app-typescript-mcp-");
  const mcp = spawnServer("apps/agent/mcp_server.ts", {
    DATA_DIRECTORY: dataDirectory,
  });

  try {
    const session = new StdioSession(mcp);

    const initialized = await session.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {
        tools: {},
      },
      clientInfo: {
        name: "smoke-suite",
        version: "1.0.0",
      },
    });

    if (initialized.error) {
      throw new Error(`MCP initialize failed: ${initialized.error.message}`);
    }

    const tools = await session.call("tools/list", {});
    const toolsPayload = tools.result as {
      tools?: Array<{ name: string }>;
    };
    if (!toolsPayload.tools?.some((tool) => tool.name === "task_create")) {
      throw new Error("MCP stdio smoke expected task_create in tools/list");
    }

    const created = await session.call("tools/call", {
      name: "task_create",
      arguments: {
        title: "MCP stdio item",
        description: "Created through the stdio smoke session.",
      },
    });

    const createdPayload = created.result as {
      structuredContent?: { id?: string; status?: string };
      isError?: boolean;
    };

    if (
      createdPayload.isError ||
      createdPayload.structuredContent?.status !== "backlog" ||
      !createdPayload.structuredContent?.id
    ) {
      throw new Error("MCP stdio smoke expected a backlog item");
    }

    const deniedMove = await session.call("tools/call", {
      name: "task_move",
      arguments: {
        itemId: createdPayload.structuredContent.id,
        targetStatus: "complete",
      },
    });

    const deniedMovePayload = deniedMove.result as {
      structuredContent?: { error?: { code?: string } };
      isError?: boolean;
    };

    if (
      deniedMovePayload.isError !== true ||
      deniedMovePayload.structuredContent?.error?.code !== "CONFIRMATION_REQUIRED"
    ) {
      throw new Error("MCP stdio smoke expected task_move confirmation enforcement");
    }

    const moved = await session.call("tools/call", {
      name: "task_move",
      arguments: {
        confirmed: true,
        itemId: createdPayload.structuredContent.id,
        targetStatus: "complete",
      },
    });

    const movedPayload = moved.result as {
      structuredContent?: { status?: string };
      isError?: boolean;
    };

    if (movedPayload.isError || movedPayload.structuredContent?.status !== "complete") {
      throw new Error("MCP stdio smoke expected confirmed task_move execution");
    }

    session.close();
    console.log("agent mcp stdio smoke passed");
  } finally {
    await mcp.close();
    await removeDirectory(dataDirectory);
  }
}

void main();
