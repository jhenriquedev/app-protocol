import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const prefixPalette = {
  api: "\u001B[36m",
  portal: "\u001B[35m",
  agent: "\u001B[33m",
  reset: "\u001B[0m",
} as const;

type ManagedProcess = {
  name: "api" | "portal" | "agent";
  child: ChildProcess;
};

const managedProcesses: ManagedProcess[] = [];
let shuttingDown = false;

function pipeOutput(
  name: ManagedProcess["name"],
  stream: NodeJS.ReadableStream | null,
  target: NodeJS.WriteStream
): void {
  if (!stream) {
    return;
  }

  const reader = createInterface({ input: stream });
  const color = prefixPalette[name];

  reader.on("line", (line) => {
    target.write(`${color}[${name}]${prefixPalette.reset} ${line}\n`);
  });
}

function spawnScript(name: ManagedProcess["name"], script: string): void {
  const child = spawn(npmCommand, ["run", script], {
    cwd: projectRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  managedProcesses.push({ name, child });
  pipeOutput(name, child.stdout, process.stdout);
  pipeOutput(name, child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    process.stderr.write(
      `[dev] ${name} stopped unexpectedly (${signal ?? code ?? "unknown"}).\n`
    );
    void stopAll(signal === "SIGTERM" ? "SIGTERM" : "SIGINT").finally(() => {
      process.exit(typeof code === "number" ? code : 1);
    });
  });
}

async function stopAll(signal: NodeJS.Signals): Promise<void> {
  const closers = managedProcesses.map(
    ({ child }) =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) {
          resolve();
          return;
        }

        child.once("exit", () => resolve());
        child.kill(signal);
      })
  );

  await Promise.all(closers);
}

function registerShutdown(signal: NodeJS.Signals): void {
  process.on(signal, () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    void stopAll(signal).finally(() => {
      process.exit(0);
    });
  });
}

registerShutdown("SIGINT");
registerShutdown("SIGTERM");

spawnScript("api", "dev:api");
spawnScript("portal", "dev:portal");
spawnScript("agent", "dev:agent");

process.stdout.write(
  "[dev] Running api on http://localhost:3000, portal on http://localhost:5173, and agent HTTP on http://localhost:3001 (remote MCP at /mcp). Start MCP stdio separately with `npm run dev:agent:mcp` because stdio transport needs direct client ownership.\n"
);
