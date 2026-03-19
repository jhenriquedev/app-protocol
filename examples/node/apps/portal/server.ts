import { bootstrap } from "./app";

const resolvedPort = Number(process.env.PORT ?? process.env.PORTAL_PORT ?? 5173);
const apiBaseURL = process.env.API_BASE_URL ?? "http://localhost:3000";

void bootstrap({
  apiBaseURL,
  port: Number.isFinite(resolvedPort) ? resolvedPort : 5173,
}).startPortal();
