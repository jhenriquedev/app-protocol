import { bootstrap } from "./app";

const port = Number(process.env.PORT ?? "3310");
const backendBaseUrl = process.env.BACKEND_BASE_URL;

const portal = bootstrap({
  port,
  backendBaseUrl,
});

void portal.start();
