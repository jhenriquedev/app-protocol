import { AppCaseError } from "../../core/shared/app_structural_contracts";
import {
  AppMcpProtocolError,
  type AppMcpCallResult,
  type AppMcpInitializeParams,
  type AppMcpInitializeResult,
  type AppMcpReadResourceResult,
  type AppMcpRequestContext,
  type AppMcpResourceDescriptor,
  type AppMcpServer,
  type AppMcpToolDescriptor,
} from "../../core/shared/app_mcp_contracts";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseJsonRpcRequest(value: unknown): JsonRpcRequest {
  if (!isRecord(value) || value.jsonrpc !== "2.0" || typeof value.method !== "string") {
    throw new AppMcpProtocolError(-32600, "Invalid JSON-RPC request");
  }

  return value as unknown as JsonRpcRequest;
}

function toSuccess(id: string | number | null | undefined, result: unknown): JsonRpcSuccessResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result,
  };
}

function toError(
  id: string | number | null | undefined,
  error: AppMcpProtocolError | AppCaseError | Error
): JsonRpcErrorResponse {
  if (error instanceof AppMcpProtocolError) {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      error: {
        code: error.code,
        message: error.message,
        ...(error.data !== undefined ? { data: error.data } : {}),
      },
    };
  }

  if (error instanceof AppCaseError) {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      error: {
        code: -32000,
        message: error.message,
        data: error.toAppError(),
      },
    };
  }

  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code: -32603,
      message: error.message,
    },
  };
}

function getRequestContext(
  request: JsonRpcRequest,
  baseContext: Partial<AppMcpRequestContext>
): Partial<AppMcpRequestContext> {
  const params = isRecord(request.params) ? request.params : {};
  const clientInfo = isRecord(params.clientInfo)
    ? {
        name: String(params.clientInfo.name ?? "unknown-client"),
        version: String(params.clientInfo.version ?? "0.0.0"),
      }
    : baseContext.clientInfo;

  return {
    ...baseContext,
    requestId: request.id ?? null,
    protocolVersion:
      typeof params.protocolVersion === "string"
        ? params.protocolVersion
        : baseContext.protocolVersion,
    clientInfo,
  };
}

function requireObjectParams(
  params: unknown,
  method: string
): Record<string, unknown> {
  if (!isRecord(params)) {
    throw new AppMcpProtocolError(-32602, `${method} requires an object params payload`);
  }

  return params;
}

export async function dispatchJsonRpcRequest(
  server: AppMcpServer,
  rawRequest: unknown,
  baseContext: Partial<AppMcpRequestContext>
): Promise<JsonRpcResponse | undefined> {
  let request: JsonRpcRequest;

  try {
    request = parseJsonRpcRequest(rawRequest);
  } catch (error) {
    return toError(null, error as Error);
  }

  const context = getRequestContext(request, baseContext);

  try {
    if (request.method === "notifications/initialized") {
      return undefined;
    }

    let result: unknown;

    switch (request.method) {
      case "initialize": {
        result = await server.initialize(
          request.params as AppMcpInitializeParams | undefined,
          context
        );
        break;
      }

      case "tools/list": {
        result = {
          tools: await server.listTools(context),
        };
        break;
      }

      case "resources/list": {
        result = {
          resources: await server.listResources(context),
        };
        break;
      }

      case "resources/read": {
        const params = requireObjectParams(request.params, request.method);
        if (typeof params.uri !== "string") {
          throw new AppMcpProtocolError(-32602, "resources/read requires a string uri");
        }
        result = await server.readResource(params.uri, context);
        break;
      }

      case "tools/call": {
        const params = requireObjectParams(request.params, request.method);
        if (typeof params.name !== "string") {
          throw new AppMcpProtocolError(-32602, "tools/call requires a string name");
        }
        result = await server.callTool(params.name, params.arguments, context);
        break;
      }

      default:
        throw new AppMcpProtocolError(
          -32601,
          `Unsupported MCP method ${request.method}`
        );
    }

    return toSuccess(request.id, result);
  } catch (error) {
    return toError(request.id, error as Error);
  }
}
