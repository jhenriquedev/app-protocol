import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const repoBlobBaseUrl = "https://github.com/jhenriquedev/app-protocol/blob/main";
const repoTreeBaseUrl = "https://github.com/jhenriquedev/app-protocol/tree/main";

function isDirectory(relativePath) {
  try {
    return statSync(path.join(repoRoot, relativePath)).isDirectory();
  } catch {
    return false;
  }
}

function toRepoUrl(target) {
  const [rawPath, rawHash] = target.split("#");
  const relativePath = path.posix.resolve("/", rawPath).slice(1);
  const baseUrl =
    rawPath.endsWith("/") || isDirectory(relativePath)
      ? repoTreeBaseUrl
      : repoBlobBaseUrl;

  return `${baseUrl}/${relativePath}${rawHash ? `#${rawHash}` : ""}`;
}

export function buildInstallableSpec(source) {
  return source.replace(
    /\]\(((?:\.\/|\.\.\/)[^)]+)\)/g,
    (_match, target) => `](${toRepoUrl(target)})`
  );
}
