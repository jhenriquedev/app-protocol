import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function normalizeVersion(input) {
  return input.startsWith("v") ? input.slice(1) : input;
}

async function readJson(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return readFile(filePath, "utf8");
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected "${expected}", got "${actual}".`);
  }
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label} missing required content: ${needle}`);
  }
}

async function main() {
  const [inputVersion] = process.argv.slice(2);

  if (!inputVersion) {
    throw new Error("Usage: node scripts/verify-release-alignment.mjs <version>");
  }

  const version = normalizeVersion(inputVersion);
  const protocolVersion = `app@v${version}`;
  const prdVersion = `${version}-prd`;

  const rootPackage = await readJson("package.json");
  const examplePackage = await readJson("examples/typescript/package.json");
  const installerPackage = await readJson("tooling/skill-app/package.json");
  const skillManifest = await readJson("skills/app/skill.json");
  const skillDoc = await readText("docs/skill_v5.md");
  const installableSkill = await readText("skills/app/SKILL.md");

  assertEqual(rootPackage.version, version, "Root package version");
  assertEqual(examplePackage.version, version, "Example package version");
  assertEqual(installerPackage.version, version, "Installer package version");
  assertEqual(skillManifest.version, version, "Skill manifest version");
  assertEqual(skillManifest.revision, prdVersion, "Skill manifest revision");

  assertIncludes(skillDoc, `Version: \`${prdVersion}\``, "docs/skill_v5.md");
  assertIncludes(skillDoc, `Protocol: \`${protocolVersion}\``, "docs/skill_v5.md");
  assertIncludes(installableSkill, `Version: \`${prdVersion}\``, "skills/app/SKILL.md");
  assertIncludes(installableSkill, `Protocol: \`${protocolVersion}\``, "skills/app/SKILL.md");

  console.log(`release alignment verified for v${version}`);
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Release alignment verification failed."
  );
  process.exit(1);
}
