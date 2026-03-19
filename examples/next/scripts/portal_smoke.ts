import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const nextBinary = join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);

async function waitForPortal(url: string, timeoutMs: number): Promise<string> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return await response.text();
      }
    } catch {
      // Keep retrying while the dev server boots.
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  throw new Error(`portal_smoke: timed out waiting for ${url}`);
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await once(child, "exit");
}

async function run(): Promise<void> {
  const child = spawn(nextBinary, ["dev", "--port", "3102"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stderrLines: string[] = [];
  child.stderr?.on("data", (chunk) => {
    stderrLines.push(String(chunk));
  });

  try {
    const html = await waitForPortal("http://127.0.0.1:3102", 30_000);

    assert.match(
      html,
      /Task Board/,
      "portal_smoke: home page must include the board title"
    );
    assert.match(
      html,
      /Next\.js \+ Node APP example/,
      "portal_smoke: home page must include the Next.js shell subtitle"
    );
    assert.match(
      html,
      /New Task/,
      "portal_smoke: home page must render the create-task entry point"
    );

    console.log("portal_smoke: ok");
  } catch (error: unknown) {
    const details = stderrLines.join("");

    throw new Error(
      `${
        error instanceof Error ? error.message : "portal smoke failed"
      }\n${details}`.trim()
    );
  } finally {
    await stop(child).catch(() => undefined);
  }
}

void run();
