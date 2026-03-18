import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(repoRoot, "skills", "app");

const targets = [
  path.join(repoRoot, ".codex", "skills", "app"),
  path.join(repoRoot, ".claude", "skills", "app"),
  path.join(repoRoot, ".github", "skills", "app"),
  path.join(repoRoot, ".windsurf", "skills", "app"),
  path.join(repoRoot, ".agents", "skills", "app"),
  path.join(repoRoot, "tooling", "skill-app", "skill"),
];

async function syncDir(from, to) {
  await rm(to, { recursive: true, force: true });
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
}

for (const target of targets) {
  await syncDir(sourceDir, target);
  console.log(`synced ${path.relative(repoRoot, sourceDir)} -> ${path.relative(repoRoot, target)}`);
}
