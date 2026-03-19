import { bootstrap } from "./app";

const resolvedPort = Number(
  Deno.env.get("PORT") ?? Deno.env.get("AGENT_PORT") ?? 3001,
);
const dataDirectory = Deno.env.get("APP_DENO_DATA_DIR");

void bootstrap({
  port: Number.isFinite(resolvedPort) ? resolvedPort : 3001,
  dataDirectory,
}).startAgent();
