import { TextLineStream } from "@std/streams/text-line-stream";

import {
  type AppMcpCallResult,
  type AppMcpInitializeResult,
  AppMcpProtocolError,
  type AppMcpReadResourceResult,
  type AppMcpRequestContext,
  type AppMcpResourceDescriptor,
  type AppMcpServer,
  type AppMcpToolDescriptor,
  BaseAppMcpProcessAdapter,
} from "../../core/shared/app_mcp_contracts";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result:
    | AppMcpInitializeResult
    | { tools: AppMcpToolDescriptor[] }
    | { resources: AppMcpResourceDescriptor[] }
    | AppMcpReadResourceResult
    | AppMcpCallResult
    | Record<string, never>;
};

type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type SessionPhase =
  | "awaiting_initialize"
  | "awaiting_initialized_notification"
  | "ready";

const encoder = new TextEncoder();

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toFailure(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcFailure {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data !== undefined ? { data } : {}),
    },
  };
}

function isJsonRpcMessage(value: unknown): value is {
  jsonrpc: "2.0";
  method: string;
  id?: JsonRpcId;
  params?: unknown;
} {
  return (
    isObject(value) &&
    value.jsonrpc === "2.0" &&
    typeof value.method === "string"
  );
}

function isInitializeParams(value: unknown): value is {
  protocolVersion: string;
  capabilities?: Record<string, unknown>;
  clientInfo?: {
    name: string;
    version: string;
  };
} {
  if (!isObject(value) || typeof value.protocolVersion !== "string") {
    return false;
  }

  if (value.clientInfo === undefined) {
    return true;
  }

  return (
    isObject(value.clientInfo) &&
    typeof value.clientInfo.name === "string" &&
    typeof value.clientInfo.version === "string"
  );
}

function writeMessage(message: JsonRpcSuccess | JsonRpcFailure): void {
  Deno.stdout.writeSync(encoder.encode(`${JSON.stringify(message)}\n`));
}

export class StdioAppMcpAdapter extends BaseAppMcpProcessAdapter {
  public readonly transport = "stdio" as const;

  public async serve(server: AppMcpServer): Promise<void> {
    const sessionId = generateId();
    let phase: SessionPhase = "awaiting_initialize";
    let protocolVersion: string | undefined;
    let clientInfo:
      | {
        name: string;
        version: string;
      }
      | undefined;

    const handleRequest = async (
      request: JsonRpcRequest,
      context: AppMcpRequestContext,
    ): Promise<JsonRpcSuccess> => {
      switch (request.method) {
        case "initialize": {
          if (phase !== "awaiting_initialize") {
            throw new AppMcpProtocolError(
              -32600,
              "MCP initialize may only run once per stdio session.",
            );
          }

          const result = await server.initialize(
            isInitializeParams(request.params) ? request.params : undefined,
            context,
          );
          protocolVersion = result.protocolVersion;
          clientInfo =
            isObject(request.params) && isObject(request.params.clientInfo)
              ? {
                name: typeof request.params.clientInfo.name === "string"
                  ? request.params.clientInfo.name
                  : "unknown-client",
                version: typeof request.params.clientInfo.version === "string"
                  ? request.params.clientInfo.version
                  : "0.0.0",
              }
              : undefined;
          phase = "awaiting_initialized_notification";

          return {
            jsonrpc: "2.0",
            id: request.id,
            result,
          };
        }
        case "ping":
          if (phase !== "ready") {
            throw new AppMcpProtocolError(
              -32002,
              "MCP session is not ready; complete initialization first.",
            );
          }

          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {},
          };
        case "tools/list":
          if (phase !== "ready") {
            throw new AppMcpProtocolError(
              -32002,
              "MCP session is not ready; complete initialization first.",
            );
          }

          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              tools: await server.listTools(context),
            },
          };
        case "resources/list":
          if (phase !== "ready") {
            throw new AppMcpProtocolError(
              -32002,
              "MCP session is not ready; complete initialization first.",
            );
          }

          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              resources: await server.listResources(context),
            },
          };
        case "resources/read":
          if (phase !== "ready") {
            throw new AppMcpProtocolError(
              -32002,
              "MCP session is not ready; complete initialization first.",
            );
          }

          if (
            !isObject(request.params) || typeof request.params.uri !== "string"
          ) {
            throw new AppMcpProtocolError(
              -32602,
              "MCP resources/read requires a string resource uri.",
            );
          }

          return {
            jsonrpc: "2.0",
            id: request.id,
            result: await server.readResource(request.params.uri, context),
          };
        case "tools/call":
          if (phase !== "ready") {
            throw new AppMcpProtocolError(
              -32002,
              "MCP session is not ready; complete initialization first.",
            );
          }

          if (
            !isObject(request.params) || typeof request.params.name !== "string"
          ) {
            throw new AppMcpProtocolError(
              -32602,
              "MCP tools/call requires a string tool name.",
            );
          }

          return {
            jsonrpc: "2.0",
            id: request.id,
            result: await server.callTool(
              request.params.name,
              request.params.arguments,
              context,
            ),
          };
        default:
          throw new AppMcpProtocolError(
            -32601,
            `MCP method ${request.method} is not implemented by this server.`,
          );
      }
    };

    const handleNotification = (notification: JsonRpcNotification): void => {
      switch (notification.method) {
        case "notifications/initialized":
          if (phase === "awaiting_initialized_notification") {
            phase = "ready";
          }
          return;
        case "notifications/cancelled":
          return;
        default:
          return;
      }
    };

    const toContext = (requestId?: JsonRpcId): AppMcpRequestContext => ({
      transport: this.transport,
      requestId,
      sessionId,
      correlationId: generateId(),
      clientInfo,
      protocolVersion,
    });

    const lines = Deno.stdin.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream());

    for await (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed) as unknown;
      } catch (error: unknown) {
        writeMessage(
          toFailure(
            null,
            -32700,
            "Invalid JSON-RPC payload.",
            error instanceof Error ? error.message : undefined,
          ),
        );
        continue;
      }

      if (!isJsonRpcMessage(parsed)) {
        writeMessage(
          toFailure(null, -32600, "Invalid JSON-RPC request shape."),
        );
        continue;
      }

      const hasId = Object.prototype.hasOwnProperty.call(parsed, "id");
      if (!hasId) {
        handleNotification(parsed);
        continue;
      }

      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: typeof parsed.id === "string" || typeof parsed.id === "number"
          ? parsed.id
          : null,
        method: parsed.method,
        params: parsed.params,
      };

      try {
        const response = await handleRequest(request, toContext(request.id));
        writeMessage(response);
      } catch (error: unknown) {
        if (error instanceof AppMcpProtocolError) {
          writeMessage(
            toFailure(request.id, error.code, error.message, error.data),
          );
          continue;
        }

        writeMessage(
          toFailure(
            request.id,
            -32603,
            "Internal MCP server error.",
            error instanceof Error ? { message: error.message } : undefined,
          ),
        );
      }
    }
  }
}
