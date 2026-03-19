import {
  AppMcpProtocolError,
  BaseAppMcpHttpAdapter,
  type AppMcpCallResult,
  type AppMcpHttpExchange,
  type AppMcpHttpResponse,
  type AppMcpInitializeResult,
  type AppMcpReadResourceResult,
  type AppMcpRequestContext,
  type AppMcpResourceDescriptor,
  type AppMcpServer,
  type AppMcpToolDescriptor,
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

function generateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toFailure(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown
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

function toJsonResponse(
  statusCode: number,
  bodyText?: string,
  headers?: Record<string, string>
): AppMcpHttpResponse {
  return {
    statusCode,
    headers: {
      "cache-control": "no-store",
      ...(bodyText !== undefined
        ? { "content-type": "application/json; charset=utf-8" }
        : {}),
      ...headers,
    },
    bodyText,
  };
}

export class StreamableHttpAppMcpAdapter extends BaseAppMcpHttpAdapter {
  public readonly transport = "streamable-http" as const;
  public readonly endpointPath = "/mcp" as const;

  public async handle(
    exchange: AppMcpHttpExchange,
    server: AppMcpServer
  ): Promise<AppMcpHttpResponse | undefined> {
    if (exchange.path !== this.endpointPath) {
      return undefined;
    }

    const method = exchange.method.toUpperCase();

    if (method === "GET") {
      return {
        statusCode: 405,
        headers: {
          allow: "POST",
          "cache-control": "no-store",
        },
      };
    }

    if (method === "DELETE") {
      return {
        statusCode: 405,
        headers: {
          allow: "POST",
          "cache-control": "no-store",
        },
      };
    }

    if (method !== "POST") {
      return {
        statusCode: 405,
        headers: {
          allow: "GET,POST,DELETE",
          "cache-control": "no-store",
        },
      };
    }

    if (!exchange.bodyText?.trim()) {
      return toJsonResponse(
        400,
        JSON.stringify(toFailure(null, -32600, "Missing JSON-RPC payload."))
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(exchange.bodyText) as unknown;
    } catch (error: unknown) {
      return toJsonResponse(
        400,
        JSON.stringify(
          toFailure(
            null,
            -32700,
            "Invalid JSON-RPC payload.",
            error instanceof Error ? error.message : undefined
          )
        )
      );
    }

    if (Array.isArray(parsed) && parsed.length === 0) {
      return toJsonResponse(
        400,
        JSON.stringify(
          toFailure(null, -32600, "Empty JSON-RPC batch payload is invalid.")
        )
      );
    }

    const messages = Array.isArray(parsed) ? parsed : [parsed];
    const responses: Array<JsonRpcSuccess | JsonRpcFailure> = [];

    for (const message of messages) {
      if (!isJsonRpcMessage(message)) {
        responses.push(
          toFailure(null, -32600, "Invalid JSON-RPC request shape.")
        );
        continue;
      }

      const hasId = Object.prototype.hasOwnProperty.call(message, "id");
      if (!hasId) {
        this.handleNotification(message);
        continue;
      }

      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id:
          typeof message.id === "string" || typeof message.id === "number"
            ? message.id
            : null,
        method: message.method,
        params: message.params,
      };

      try {
        responses.push(await this.handleRequest(request, server));
      } catch (error: unknown) {
        if (error instanceof AppMcpProtocolError) {
          responses.push(
            toFailure(request.id, error.code, error.message, error.data)
          );
          continue;
        }

        responses.push(
          toFailure(
            request.id,
            -32603,
            "Internal MCP server error.",
            error instanceof Error ? { message: error.message } : undefined
          )
        );
      }
    }

    if (responses.length === 0) {
      return {
        statusCode: 202,
        headers: {
          "cache-control": "no-store",
        },
      };
    }

    return toJsonResponse(
      200,
      JSON.stringify(responses.length === 1 ? responses[0] : responses)
    );
  }

  private handleNotification(notification: JsonRpcNotification): void {
    switch (notification.method) {
      case "notifications/initialized":
      case "notifications/cancelled":
        return;
      default:
        return;
    }
  }

  private async handleRequest(
    request: JsonRpcRequest,
    server: AppMcpServer
  ): Promise<JsonRpcSuccess> {
    const context = this.toContext(request.id);

    switch (request.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: await server.initialize(
            isInitializeParams(request.params) ? request.params : undefined,
            context
          ),
        };
      case "ping":
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {},
        };
      case "tools/list":
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            tools: await server.listTools(context),
          },
        };
      case "resources/list":
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            resources: await server.listResources(context),
          },
        };
      case "resources/read":
        if (!isObject(request.params) || typeof request.params.uri !== "string") {
          throw new AppMcpProtocolError(
            -32602,
            "MCP resources/read requires a string resource uri."
          );
        }

        return {
          jsonrpc: "2.0",
          id: request.id,
          result: await server.readResource(request.params.uri, context),
        };
      case "tools/call":
        if (!isObject(request.params) || typeof request.params.name !== "string") {
          throw new AppMcpProtocolError(
            -32602,
            "MCP tools/call requires a string tool name."
          );
        }

        return {
          jsonrpc: "2.0",
          id: request.id,
          result: await server.callTool(
            request.params.name,
            request.params.arguments,
            context
          ),
        };
      default:
        throw new AppMcpProtocolError(
          -32601,
          `MCP method ${request.method} is not implemented by this server.`
        );
    }
  }

  private toContext(requestId?: JsonRpcId): AppMcpRequestContext {
    return {
      transport: this.transport,
      requestId,
      correlationId: generateId(),
    };
  }
}
