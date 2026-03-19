import { bootstrap } from "./app";

const resolvedPort = Number(
  Deno.env.get("PORT") ?? Deno.env.get("API_PORT") ?? 3000,
);
const dataDirectory = Deno.env.get("APP_DENO_DATA_DIR");

void bootstrap({
  port: Number.isFinite(resolvedPort) ? resolvedPort : 3000,
  dataDirectory,
}).startBackend();
