import { fromFileUrl } from "@std/path";

const projectRoot = fromFileUrl(new URL("..", import.meta.url));
const encoder = new TextEncoder();
const prefixPalette = {
  api: "\u001B[36m",
  front: "\u001B[35m",
  agent: "\u001B[33m",
  reset: "\u001B[0m",
} as const;

type ManagedName = "api" | "front" | "agent";
type SyncWriter = {
  writeSync(data: Uint8Array): number;
};

type ManagedProcess = {
  name: ManagedName;
  child: Deno.ChildProcess;
  pipes: Promise<void>[];
};

const managedProcesses: ManagedProcess[] = [];
let shuttingDown = false;

function writeLine(target: SyncWriter, line: string): void {
  target.writeSync(encoder.encode(line));
}

async function readLines(
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void | Promise<void>,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
        buffer = buffer.slice(newlineIndex + 1);
        await onLine(line);
        newlineIndex = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();
    const finalLine = buffer.replace(/\r$/, "");
    if (finalLine) {
      await onLine(finalLine);
    }
  } finally {
    reader.releaseLock();
  }
}

function pipeOutput(
  name: ManagedName,
  stream: ReadableStream<Uint8Array> | null,
  target: SyncWriter,
): Promise<void> {
  if (!stream) {
    return Promise.resolve();
  }

  const color = prefixPalette[name];
  return readLines(stream, (line) => {
    writeLine(target, `${color}[${name}]${prefixPalette.reset} ${line}\n`);
  });
}

function spawnScript(name: ManagedName, args: string[]): void {
  const child = new Deno.Command(Deno.execPath(), {
    cwd: projectRoot,
    args,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  }).spawn();

  const managed: ManagedProcess = {
    name,
    child,
    pipes: [
      pipeOutput(name, child.stdout, Deno.stdout),
      pipeOutput(name, child.stderr, Deno.stderr),
    ],
  };

  managedProcesses.push(managed);

  void child.status.then(async (status) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    writeLine(
      Deno.stderr,
      `[dev] ${name} stopped unexpectedly (${
        status.signal ?? status.code ?? "unknown"
      }).\n`,
    );
    await stopAll("SIGTERM");
    Deno.exit(status.code || 1);
  });
}

async function stopAll(signal: Deno.Signal): Promise<void> {
  await Promise.allSettled(
    managedProcesses.map(async ({ child, pipes }) => {
      try {
        child.kill(signal);
      } catch {
        // Ignore: the child may already be stopped.
      }

      await Promise.allSettled([child.status, ...pipes]);
    }),
  );
}

function registerShutdown(signal: Deno.Signal): void {
  Deno.addSignalListener(signal, () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    void stopAll(signal).finally(() => {
      Deno.exit(0);
    });
  });
}

registerShutdown("SIGINT");
registerShutdown("SIGTERM");

spawnScript("api", [
  "run",
  "--unstable-sloppy-imports",
  "-A",
  "--watch",
  "apps/backend/server.ts",
]);
spawnScript("front", [
  "run",
  "--unstable-sloppy-imports",
  "-A",
  "npm:vite",
  "--config",
  "apps/portal/vite.config.ts",
]);
spawnScript("agent", [
  "run",
  "--unstable-sloppy-imports",
  "-A",
  "--watch",
  "apps/agent/server.ts",
]);

writeLine(
  Deno.stdout,
  "[dev] Running api on http://localhost:3000, front on http://localhost:5173, and agent HTTP on http://localhost:3001 (remote MCP at /mcp). Start MCP stdio separately with `deno task dev:agent:mcp` because stdio transport needs direct client ownership.\n",
);
