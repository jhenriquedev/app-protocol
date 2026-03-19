# Apps

This example uses three APP host apps:

- `backend` for Node API execution and local persistence ownership
- `portal` for Angular UI execution
- `agent` for tool catalog publication and agentic execution over HTTP, MCP stdio, and remote MCP HTTP

Each host keeps the canonical APP files:

- `app.ts`
- `registry.ts`

Additional runtime entry files may exist when the host runtime needs them:

- `server.ts` for the backend process entrypoint
- `server.ts` for the agent HTTP process entrypoint, including the remote MCP endpoint
- `mcp_server.ts` for the agent MCP stdio entrypoint
- `src/main.ts` and `src/root.component.ts` for the portal runtime
