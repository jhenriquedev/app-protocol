import util from "node:util";

import { bootstrap } from "./app";

const dataDirectory = process.env.APP_REACT_DATA_DIR;

function bindConsoleToStderr(): void {
  const write =
    (level: "debug" | "info" | "warn" | "error") =>
    (...args: unknown[]) => {
      process.stderr.write(`[${level}] ${util.format(...args)}\n`);
    };

  console.debug = write("debug");
  console.info = write("info");
  console.warn = write("warn");
  console.error = write("error");
}

bindConsoleToStderr();

void bootstrap({
  dataDirectory,
}).publishMcp();
