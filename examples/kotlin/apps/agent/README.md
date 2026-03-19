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

Required exposed routes target:

- `GET /health`
- `GET /manifest`
- `GET /catalog`
- `POST /tools/:toolName/execute`

Required exposed MCP transports target:

- `stdio` through `apps/agent/mcp_server.kt`
- remote MCP HTTP through `/mcp` on `apps/agent/server.kt`
- lifecycle: `initialize` + `notifications/initialized`
- operations: `tools/list`, `resources/list`, `resources/read`, `tools/call`
