import { fromFileUrl } from "@std/path";

const projectRoot = fromFileUrl(new URL("..", import.meta.url));
const smokeScripts = [
  "scripts/smoke.ts",
  "scripts/agentic_smoke.ts",
  "scripts/agent_mcp_smoke.ts",
  "scripts/agent_mcp_http_smoke.ts",
] as const;

for (const script of smokeScripts) {
  const command = new Deno.Command(Deno.execPath(), {
    cwd: projectRoot,
    args: ["run", "--unstable-sloppy-imports", "-A", script],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const child = command.spawn();
  const status = await child.status;

  if (!status.success) {
    Deno.exit(status.code);
  }
}
