import { bootstrap } from "./app";

const port = Number(process.env.PORT ?? "3320");
const dataDirectory = process.env.DATA_DIRECTORY;

const agent = bootstrap({
  port,
  dataDirectory,
});

void agent.start();
