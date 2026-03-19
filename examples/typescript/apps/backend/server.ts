import { bootstrap } from "./app";

const port = Number(process.env.PORT ?? "3300");
const dataDirectory = process.env.DATA_DIRECTORY;

const backend = bootstrap({
  port,
  dataDirectory,
});

void backend.start();
