import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const violations = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") return [];
        return walk(fullPath);
      }
      return fullPath.endsWith(".ts") ? [fullPath] : [];
    })
  );

  return files.flat();
}

function extractImports(source) {
  const imports = [];
  const patterns = [
    /import\s+[^'"]*?from\s+["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /export\s+[^'"]*?from\s+["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(source);
    while (match) {
      imports.push(match[1]);
      match = pattern.exec(source);
    }
  }

  return imports;
}

function record(file, message) {
  violations.push(`${relative(repoRoot, file)}: ${message}`);
}

async function validateCaseBoundaries(root) {
  const files = await walk(join(repoRoot, root));

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const imports = extractImports(source);

    for (const specifier of imports) {
      if (specifier.includes("/packages/")) {
        record(
          file,
          "contextual Case surfaces must not import from packages/ directly; consume shared libraries via ctx.packages"
        );
      }
    }
  }
}

async function validateRegistries(root) {
  const files = await walk(join(repoRoot, root));
  const registryFiles = files.filter((file) => file.endsWith("/registry.ts"));

  for (const file of registryFiles) {
    const source = await readFile(file, "utf8");
    const imports = extractImports(source);
    const caseImports = imports.filter((specifier) => specifier.includes("/cases/"));
    const packageImports = imports.filter((specifier) => specifier.includes("/packages/"));

    if (!source.includes("_cases:")) {
      record(file, "registry.ts must declare the canonical _cases slot");
    }

    if (caseImports.length > 0 && !source.includes("_cases:")) {
      record(file, "imports from cases/ must be mounted under registry._cases");
    }

    if (
      packageImports.length > 0 &&
      !source.includes("_packages:") &&
      !source.includes("_providers:")
    ) {
      record(
        file,
        "imports from packages/ must be mounted under registry._packages or registry._providers"
      );
    }
  }
}

await validateCaseBoundaries("src/cases");
await validateCaseBoundaries("examples/typescript/cases");
await validateRegistries("src/apps");
await validateRegistries("examples/typescript/apps");

if (violations.length > 0) {
  console.error("APP boundary validation failed:\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("APP boundary validation passed.");
