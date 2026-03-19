import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
export const exampleRoot = resolve(scriptsDirectory, "..");
const tsxBinary = join(
  exampleRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx"
);

export interface SpawnedServer {
  child: ChildProcess;
  close(): Promise<void>;
}

export async function createTempDataDirectory(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function removeDirectory(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export function spawnServer(
  entrypoint: string,
  env: Record<string, string | undefined> = {}
): SpawnedServer {
  const child = spawn(tsxBinary, [entrypoint], {
    cwd: exampleRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk) => {
    process.stderr.write(String(chunk));
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(String(chunk));
  });

  return {
    child,
    async close() {
      if (child.exitCode !== null) {
        return;
      }

      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
        setTimeout(() => {
          if (child.exitCode === null) {
            child.kill("SIGKILL");
          }
        }, 5000);
      });
    },
  };
}

export async function waitForHealth(url: string, attempts = 50): Promise<void> {
  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Healthcheck ${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Could not reach ${url}`);
}

export async function requestJson(
  url: string,
  init?: RequestInit
): Promise<{
  status: number;
  headers: Headers;
  data: unknown;
}> {
  const response = await fetch(url, init);
  const text = await response.text();
  const data = text.trim().length > 0 ? JSON.parse(text) : undefined;
  return {
    status: response.status,
    headers: response.headers,
    data,
  };
}

export async function requestText(
  url: string,
  init?: RequestInit
): Promise<{
  status: number;
  headers: Headers;
  text: string;
}> {
  const response = await fetch(url, init);
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    text,
  };
}
