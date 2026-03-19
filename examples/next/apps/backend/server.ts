import { bootstrap } from "./app";

const resolvedPort = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
const dataDirectory = process.env.APP_NEXT_DATA_DIR;

void bootstrap({
  port: Number.isFinite(resolvedPort) ? resolvedPort : 3000,
  dataDirectory,
}).startBackend();
