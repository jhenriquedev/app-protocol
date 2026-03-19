import { bootstrap } from "./app";

const resolvedPort = Number(process.env.PORT ?? process.env.AGENT_PORT ?? 3001);
const dataDirectory = process.env.APP_NEXT_DATA_DIR;

void bootstrap({
  port: Number.isFinite(resolvedPort) ? resolvedPort : 3001,
  dataDirectory,
}).startAgent();
