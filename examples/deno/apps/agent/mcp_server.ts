import { bootstrap } from "./app";

const dataDirectory = Deno.env.get("APP_DENO_DATA_DIR");

function bindConsoleToStderr(): void {
  const encoder = new TextEncoder();
  const write =
    (level: "debug" | "info" | "warn" | "error") => (...args: unknown[]) => {
      const message = args
        .map((value) =>
          typeof value === "string" ? value : Deno.inspect(value, { depth: 6 })
        )
        .join(" ");
      Deno.stderr.writeSync(encoder.encode(`[${level}] ${message}\n`));
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
