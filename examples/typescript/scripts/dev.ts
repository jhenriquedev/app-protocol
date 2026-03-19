import { spawnServer } from "./runtime";

const dataDirectory = process.env.DATA_DIRECTORY;

const backend = spawnServer("apps/backend/server.ts", {
  PORT: process.env.BACKEND_PORT ?? "3300",
  DATA_DIRECTORY: dataDirectory,
});

const portal = spawnServer("apps/portal/server.ts", {
  PORT: process.env.PORTAL_PORT ?? "3310",
  BACKEND_BASE_URL: process.env.BACKEND_BASE_URL ?? "http://localhost:3300",
});

const agent = spawnServer("apps/agent/server.ts", {
  PORT: process.env.AGENT_PORT ?? "3320",
  DATA_DIRECTORY: dataDirectory,
});

async function shutdown() {
  await Promise.all([backend.close(), portal.close(), agent.close()]);
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
