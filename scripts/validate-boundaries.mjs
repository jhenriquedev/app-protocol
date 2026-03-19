import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const violations = [];

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".kt",
  ".py",
  ".dart",
  ".go",
  ".cs",
  ".java",
]);

const REGISTRY_EXTENSIONS = new Set([
  ".ts",
  ".kt",
  ".py",
  ".dart",
  ".go",
  ".cs",
]);

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  "build",
  ".gradle",
  "kotlin-js-store",
  "__pycache__",
  "dist",
  ".next",
  ".dart_tool",
  "bin",
  "obj",
  "target",
  ".venv",
  "venv",
]);

function toCanonicalName(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  if (!(await pathExists(dir))) {
    return [];
  }

  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) return [];
        return walk(fullPath);
      }
      return SOURCE_EXTENSIONS.has(extname(fullPath)) ? [fullPath] : [];
    })
  );

  return files.flat();
}

function pushMatches(target, pattern, index, imports) {
  let match = pattern.exec(target);
  while (match) {
    imports.push(match[index]);
    match = pattern.exec(target);
  }
}

function extractImports(source, file) {
  const imports = [];
  const extension = extname(file);

  if (extension === ".ts" || extension === ".tsx" || extension === ".dart") {
    pushMatches(
      source,
      /import\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g,
      1,
      imports
    );
    pushMatches(source, /export\s+[^'"]*?\s+from\s+["']([^"']+)["']/g, 1, imports);
    pushMatches(source, /import\s*\(\s*["']([^"']+)["']\s*\)/g, 1, imports);
    return imports;
  }

  if (extension === ".kt") {
    pushMatches(
      source,
      /^\s*import\s+([A-Za-z0-9_.*]+(?:\.[A-Za-z0-9_*]+)+)/gm,
      1,
      imports
    );
    return imports;
  }

  if (extension === ".py") {
    pushMatches(source, /^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+/gm, 1, imports);

    const importPattern = /^\s*import\s+([A-Za-z0-9_.,\s]+)/gm;
    let match = importPattern.exec(source);
    while (match) {
      const modules = match[1]
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part.split(/\s+as\s+/)[0]);
      imports.push(...modules);
      match = importPattern.exec(source);
    }

    return imports;
  }

  if (extension === ".go") {
    const importPattern = /^\s*import\s*(?:\(([\s\S]*?)\)|"([^"]+)")/gm;
    let match = importPattern.exec(source);
    while (match) {
      if (match[2]) {
        imports.push(match[2]);
      }
      if (match[1]) {
        for (const inner of match[1].matchAll(/"([^"]+)"/g)) {
          imports.push(inner[1]);
        }
      }
      match = importPattern.exec(source);
    }

    return imports;
  }

  if (extension === ".cs") {
    pushMatches(
      source,
      /^\s*(?:global\s+)?using\s+([A-Za-z0-9_.]+)\s*;/gm,
      1,
      imports
    );
    return imports;
  }

  if (extension === ".java") {
    pushMatches(source, /^\s*import\s+([A-Za-z0-9_.]+)\s*;/gm, 1, imports);
    return imports;
  }

  return imports;
}

function record(file, message) {
  violations.push(`${relative(repoRoot, file)}: ${message}`);
}

function resolveImportPath(file, specifier) {
  if (!specifier.startsWith(".")) return null;
  return normalize(resolve(dirname(file), specifier));
}

function currentCaseRef(file) {
  const relativeFile = relative(repoRoot, file);
  const match = relativeFile.match(/cases\/([^/]+)\/([^/]+)\//);
  if (!match) {
    return null;
  }

  return {
    domain: toCanonicalName(match[1]),
    caseName: toCanonicalName(match[2]),
  };
}

function importedCaseRef(file, specifier) {
  const resolvedPath = resolveImportPath(file, specifier);
  if (resolvedPath) {
    const match = resolvedPath.match(/[\\/]cases[\\/]([^/\\]+)[\\/]([^/\\]+)[\\/]/);
    if (match) {
      return {
        domain: toCanonicalName(match[1]),
        caseName: toCanonicalName(match[2]),
      };
    }
    return null;
  }

  const pathMatch = specifier.match(/\/cases\/([^/]+)\/([^/]+)/);
  if (pathMatch) {
    return {
      domain: toCanonicalName(pathMatch[1]),
      caseName: toCanonicalName(pathMatch[2]),
    };
  }

  const dottedMatch = specifier.match(
    /(?:^|[./])cases[./]([A-Za-z0-9_]+)[./]([A-Za-z0-9_]+)/i
  );
  if (dottedMatch) {
    return {
      domain: toCanonicalName(dottedMatch[1]),
      caseName: toCanonicalName(dottedMatch[2]),
    };
  }

  return null;
}

function isPackageImport(file, specifier) {
  const resolvedPath = resolveImportPath(file, specifier);
  if (resolvedPath) {
    return /[\\/]packages[\\/]/.test(resolvedPath);
  }

  return specifier.includes("/packages/")
    || /(?:^|[./])packages(?:[./]|$)/i.test(specifier);
}

function hasRegistrySlot(source, slotName, file) {
  const extension = extname(file);

  if (extension === ".cs") {
    const propertyName = {
      _cases: "Cases",
      _providers: "Providers",
      _packages: "Packages",
    }[slotName];

    return new RegExp(`\\b${propertyName}\\b`).test(source);
  }

  return new RegExp(`["']?${slotName}["']?\\s*[:=]`).test(source);
}

function isRegistryFile(file) {
  const extension = extname(file);
  return REGISTRY_EXTENSIONS.has(extension) && /[\\/]registry\.[^.]+$/.test(file);
}

async function validateCaseBoundaries(root) {
  const files = await walk(join(repoRoot, root));

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const imports = extractImports(source, file);
    const currentCase = currentCaseRef(file);

    for (const specifier of imports) {
      if (isPackageImport(file, specifier)) {
        record(
          file,
          "contextual Case surfaces must not import from packages/ directly; consume shared libraries via ctx.packages"
        );
      }

      const importedCase = importedCaseRef(file, specifier);
      if (
        currentCase
        && importedCase
        && (
          currentCase.domain !== importedCase.domain
          || currentCase.caseName !== importedCase.caseName
        )
      ) {
        record(
          file,
          "Cases must not import other Cases directly; use ctx.cases for cross-case composition"
        );
      }
    }
  }
}

async function validateRegistries(root) {
  const files = (await walk(join(repoRoot, root))).filter(isRegistryFile);

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const imports = extractImports(source, file);
    const caseImports = imports.filter((specifier) => importedCaseRef(file, specifier));
    const packageImports = imports.filter((specifier) => isPackageImport(file, specifier));

    if (!hasRegistrySlot(source, "_cases", file)) {
      record(file, "registry file must declare the canonical cases slot");
    }

    if (caseImports.length > 0 && !hasRegistrySlot(source, "_cases", file)) {
      record(file, "imports from cases/ must be mounted under the registry cases slot");
    }

    if (
      packageImports.length > 0
      && !hasRegistrySlot(source, "_packages", file)
      && !hasRegistrySlot(source, "_providers", file)
    ) {
      record(
        file,
        "imports from packages/ must be mounted under the registry packages or providers slot"
      );
    }
  }
}

async function collectExampleRoots(kind) {
  const examplesDir = join(repoRoot, "examples");
  if (!(await pathExists(examplesDir))) {
    return [];
  }

  const entries = await readdir(examplesDir, { withFileTypes: true });
  const roots = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const relativeRoot = join("examples", entry.name, kind);
    if (await pathExists(join(repoRoot, relativeRoot))) {
      roots.push(relativeRoot);
    }
  }

  return roots;
}

await validateCaseBoundaries("src/cases");
for (const root of await collectExampleRoots("cases")) {
  await validateCaseBoundaries(root);
}

await validateRegistries("src/apps");
for (const root of await collectExampleRoots("apps")) {
  await validateRegistries(root);
}

if (violations.length > 0) {
  console.error("APP boundary validation failed:\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("APP boundary validation passed.");
