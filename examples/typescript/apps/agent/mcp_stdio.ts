import readline from "node:readline";
import {
  BaseAppMcpProcessAdapter,
  type AppMcpServer,
} from "../../core/shared/app_mcp_contracts";
import { dispatchJsonRpcRequest } from "./mcp_protocol";

export class StdioAppMcpAdapter extends BaseAppMcpProcessAdapter {
  public readonly transport = "stdio";

  public async serve(server: AppMcpServer): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      crlfDelay: Infinity,
    });

    process.stderr.write("[typescript/agent:mcp] stdio server ready\n");

    for await (const line of rl) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(trimmed);
      } catch (error) {
        process.stdout.write(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32700,
              message: error instanceof Error ? error.message : "Invalid JSON payload",
            },
          })}\n`
        );
        continue;
      }

      const response = await dispatchJsonRpcRequest(server, payload, {
        transport: this.transport,
      });

      if (response) {
        process.stdout.write(`${JSON.stringify(response)}\n`);
      }
    }
  }
}
