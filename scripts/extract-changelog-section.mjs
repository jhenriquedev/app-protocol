import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const changelogPath = path.join(repoRoot, "CHANGELOG.md");

function normalizeVersion(input) {
  return input.startsWith("v") ? input : `v${input}`;
}

function extractSection(markdown, version) {
  const heading = `## ${version}`;
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);

  if (start === -1) {
    throw new Error(`Release heading "${heading}" not found in CHANGELOG.md.`);
  }

  const collected = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## ")) break;
    collected.push(line);
  }

  const section = collected.join("\n").trim();

  if (!section) {
    throw new Error(`Release heading "${heading}" exists but has no body.`);
  }

  return section;
}

async function main() {
  const [inputVersion] = process.argv.slice(2);

  if (!inputVersion) {
    throw new Error("Usage: node scripts/extract-changelog-section.mjs <version>");
  }

  const version = normalizeVersion(inputVersion);
  const markdown = await readFile(changelogPath, "utf8");
  process.stdout.write(`${extractSection(markdown, version)}\n`);
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Failed to extract changelog section."
  );
  process.exit(1);
}
