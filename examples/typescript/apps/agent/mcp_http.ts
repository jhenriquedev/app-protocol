import {
  BaseAppMcpHttpAdapter,
  type AppMcpHttpExchange,
  type AppMcpHttpResponse,
  type AppMcpServer,
} from "../../core/shared/app_mcp_contracts";
import { dispatchJsonRpcRequest } from "./mcp_protocol";

export class StreamableHttpAppMcpAdapter extends BaseAppMcpHttpAdapter {
  public readonly transport = "http";
  public readonly endpointPath = "/mcp";

  public async handle(
    exchange: AppMcpHttpExchange,
    server: AppMcpServer
  ): Promise<AppMcpHttpResponse | undefined> {
    if (exchange.path !== this.endpointPath) {
      return undefined;
    }

    if (exchange.method !== "POST") {
      return {
        statusCode: 405,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
        bodyText: JSON.stringify({
          error: "Method not allowed",
        }),
      };
    }

    try {
      const payload =
        exchange.bodyText && exchange.bodyText.trim().length > 0
          ? JSON.parse(exchange.bodyText)
          : {};

      const rpcResponse = await dispatchJsonRpcRequest(server, payload, {
        transport: this.transport,
      });

      return {
        statusCode: rpcResponse ? 200 : 204,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
        bodyText: rpcResponse ? JSON.stringify(rpcResponse) : "",
      };
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
        bodyText: JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: error instanceof Error ? error.message : "Invalid JSON body",
          },
        }),
      };
    }
  }
}
