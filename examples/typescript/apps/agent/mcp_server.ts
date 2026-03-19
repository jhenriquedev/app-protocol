import { bootstrap } from "./app";

const dataDirectory = process.env.DATA_DIRECTORY;

const agent = bootstrap({
  dataDirectory,
});

void agent.publishMcp();
