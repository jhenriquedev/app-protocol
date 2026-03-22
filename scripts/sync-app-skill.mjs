import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildInstallableSpec } from "./lib/installable-spec.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(repoRoot, "skills", "app");
const sourceSpec = path.join(repoRoot, "spec.md");
const installedSpec = path.join(sourceDir, "spec.md");

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

await mkdir(sourceDir, { recursive: true });
await writeFile(
  installedSpec,
  buildInstallableSpec(await readFile(sourceSpec, "utf8")),
  "utf8"
);
console.log(
  `synced ${path.relative(repoRoot, sourceSpec)} -> ${path.relative(repoRoot, installedSpec)}`
);

for (const target of targets) {
  await syncDir(sourceDir, target);
  console.log(`synced ${path.relative(repoRoot, sourceDir)} -> ${path.relative(repoRoot, target)}`);
}
