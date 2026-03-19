# Agent Host

Runtime role:

- bootstrap the agentic host runtime
- register canonical `agentic` surfaces and their backing `api` surfaces
- materialize `AgenticContext` per execution
- publish the tool catalog through HTTP and MCP from the same runtime
- project the complete `AgenticDefinition` automatically from the registry
- assemble the global host prompt from registered tool prompt fragments
- execute tools through the canonical APP flow
- enforce confirmation and execution-mode rules at runtime

Exposed routes:

- `GET /health`
- `GET /manifest`
- `GET /catalog`
- `POST /tools/:toolName/execute`

Exposed MCP transports:

- `stdio` through `apps/agent/mcp_server.ts`
- remote MCP HTTP through `GET/POST /mcp` on `apps/agent/server.ts`
- lifecycle: `initialize` + `notifications/initialized`
- operations: `tools/list`, `resources/list`, `resources/read`, `tools/call`

Semantic publication model:

- `tools/list` exposes a concise semantic summary derived from `prompt`, `discovery`, `context`, and policy
- MCP `resources/list` and `resources/read` expose the full projected semantic payload for each tool plus the host global system prompt
- `GET /catalog` mirrors the same registry-driven publication for human inspection and smoke tests

Structural status:

- `AgenticRegistry` implemented on top of `AppRegistry`
- full agent host runtime implemented in `app.ts`
- HTTP entrypoint created in `server.ts`
- MCP stdio entrypoint created in `mcp_server.ts`
- remote MCP HTTP transport mounted in the same runtime at `/mcp`
- concrete MCP adapters bound in `_providers.mcpAdapters`
- task Cases exposed through `task_list`, `task_create`, and `task_move`
