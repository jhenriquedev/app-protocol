# Tasks Domain

The tasks domain owns the board capability for the Next.js + Node example.

Implemented v1 Cases:

- create a task
- list tasks for the board
- move a task between columns

Each implemented Case also exposes an `agentic` surface for the `apps/agent`
host, which publishes the same capabilities through HTTP and MCP.
