# Apps

This example uses three APP host apps:

- `backend` for Kotlin/JVM API execution and local persistence ownership
- `portal` for Kotlin/JS UI execution
- `agent` for tool catalog publication and agentic execution over HTTP, MCP
  stdio, and remote MCP HTTP

Each host keeps the canonical APP files:

- `app.kt`
- `registry.kt`

Additional runtime entry files may exist when the host runtime needs them:

- `server.kt` for the backend process entrypoint
- `server.kt` for the agent HTTP process entrypoint, including the remote MCP endpoint
- `mcp_server.kt` for the agent MCP stdio entrypoint
- `main.kt` for the portal runtime
