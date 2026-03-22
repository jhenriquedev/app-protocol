#!/usr/bin/env node

import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const skillDir = path.join(packageRoot, "skill");
const packageManifest = JSON.parse(
  await readFile(path.join(packageRoot, "package.json"), "utf8")
);
const manifest = JSON.parse(
  await readFile(path.join(skillDir, "skill.json"), "utf8")
);
const supportedHosts = Object.keys(manifest.hosts);
const hostAliases = new Map([
  ["codex-app", "codex"],
  ["claude-code", "claude"],
  ["github", "copilot"],
  ["github-copilot", "copilot"],
  ["cascade", "windsurf"],
  ["codeium", "windsurf"],
  ["agent-skills", "agents"],
  ["agentskills", "agents"],
]);

function printHelp() {
  const hostList = [...supportedHosts, "all"].join("|");
  console.log(`app-skill ${manifest.version}

Usage:
  app-skill [--help|-h|--version|-v]
  app-skill version
  app-skill outdated [${hostList}] [--project <path>]
  app-skill outdated [${hostList}] --global
  app-skill install [${hostList}] [--project <path>] [--version <version>]
  app-skill install [${hostList}] --global [--version <version>]
  app-skill update [${hostList}] [--project <path>] [--version <version>]
  app-skill update [${hostList}] --global [--version <version>]
  app-skill upgrade [${hostList}] [--project <path>] [--version <version>]
  app-skill downgrade [${hostList}] [--project <path>] --version <version>
  app-skill uninstall [${hostList}] [--project <path>]
  app-skill uninstall [${hostList}] --global
  app-skill manifest
  app-skill validate
  app-skill help

Host aliases:
  github, github-copilot -> copilot
  cascade, codeium -> windsurf
  codex-app -> codex
  claude-code -> claude
  agent-skills, agentskills -> agents

Compatibility:
  Works on macOS, Linux, and Windows with Node.js >= 20.
  Project-local install paths and global install paths are resolved with Node path APIs.
  npm invocation uses a Windows-specific fallback to support npm launchers on win32.

Examples:
  app-skill install all --project .
  app-skill install codex --global
  app-skill outdated all --project .
  app-skill update copilot --project .
  app-skill upgrade all --project .
  app-skill uninstall windsurf --global
  app-skill downgrade all --project . --version 0.0.8
  npx @app-protocol/skill-app install claude --project .
`);
}

function printVersion() {
  console.log(manifest.version);
}

function expandHome(inputPath) {
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function normalizeHost(value = "all") {
  const normalized = value.toLowerCase();
  if (normalized === "all") return "all";
  if (supportedHosts.includes(normalized)) return normalized;
  const aliased = hostAliases.get(normalized);
  if (aliased) return aliased;
  throw new Error(
    `Unsupported host "${value}". Use ${supportedHosts.join(", ")}, or all.`
  );
}

function parseArgs(argv) {
  if (argv.length === 0) {
    return {
      command: "help",
      host: "all",
      project: process.cwd(),
      global: false,
      version: null,
    };
  }

  if (argv[0] === "--help" || argv[0] === "-h") {
    return {
      command: "help",
      host: "all",
      project: process.cwd(),
      global: false,
      version: null,
    };
  }

  if (argv[0] === "--version" || argv[0] === "-v") {
    return {
      command: "version",
      host: "all",
      project: process.cwd(),
      global: false,
      version: null,
    };
  }

  const [command = "help", maybeHost, ...rest] = argv;
  const args = {
    command: command === "check-updates" ? "outdated" : command,
    host: maybeHost && !maybeHost.startsWith("--") ? maybeHost : "all",
    project: process.cwd(),
    global: false,
    version: null,
  };

  const flags = maybeHost && maybeHost.startsWith("--") ? [maybeHost, ...rest] : rest;

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === "--project") {
      args.project = flags[index + 1];
      index += 1;
      continue;
    }
    if (flag === "--global") {
      args.global = true;
      continue;
    }
    if (flag === "--version") {
      args.version = flags[index + 1];
      index += 1;
      continue;
    }
    if (flag === "--help" || flag === "-h") {
      args.command = "help";
      continue;
    }
    throw new Error(`Unknown flag "${flag}".`);
  }

  return args;
}

function getGlobalRoot(host) {
  const config = manifest.hosts[host];
  const envValue = process.env[config.globalPathEnv];
  if (envValue) {
    return path.join(envValue, "skills", manifest.name);
  }
  return expandHome(config.globalPathFallback);
}

function getProjectRoot(host, projectRoot) {
  return path.join(projectRoot, manifest.hosts[host].projectPath);
}

function resolveTargets(host, projectRoot, isGlobal) {
  const hosts = host === "all" ? supportedHosts : [host];
  return hosts.map((entry) => ({
    host: entry,
    target: isGlobal ? getGlobalRoot(entry) : getProjectRoot(entry, projectRoot),
  }));
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

async function readInstalledVersion(target) {
  try {
    const installed = JSON.parse(
      await readFile(path.join(target, "skill.json"), "utf8")
    );
    return typeof installed.version === "string" ? installed.version : null;
  } catch {
    return null;
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const output = stderr.trim() || stdout.trim();
      reject(
        new Error(
          output || `${command} exited with code ${code ?? "unknown"}.`
        )
      );
    });
  });
}

async function runNpm(args) {
  if (process.platform === "win32") {
    return runCommand("npm", args, { shell: true });
  }

  return runCommand("npm", args);
}

function describeTransition(command, previousVersion, nextVersion) {
  if (!previousVersion) {
    return `installed ${manifest.name}@${nextVersion}`;
  }

  switch (command) {
    case "install":
      return `installed ${manifest.name}@${nextVersion} over ${previousVersion}`;
    case "update":
      return `updated ${manifest.name} from ${previousVersion} to ${nextVersion}`;
    case "upgrade":
      return compareVersions(nextVersion, previousVersion) > 0
        ? `upgraded ${manifest.name} from ${previousVersion} to ${nextVersion}`
        : `reinstalled ${manifest.name}@${nextVersion} (requested upgrade; previous ${previousVersion})`;
    case "downgrade":
      return compareVersions(nextVersion, previousVersion) < 0
        ? `downgraded ${manifest.name} from ${previousVersion} to ${nextVersion}`
        : `reinstalled ${manifest.name}@${nextVersion} (requested downgrade; previous ${previousVersion})`;
    default:
      return `installed ${manifest.name}@${nextVersion}`;
  }
}

function normalizeVersionSelector(command, requestedVersion) {
  if (requestedVersion) {
    return requestedVersion;
  }

  if (command === "upgrade") {
    return "latest";
  }

  if (command === "downgrade") {
    throw new Error(
      'The "downgrade" command requires --version <version>, for example --version 0.0.8.'
    );
  }

  return null;
}

function shouldSkipInstall(command, previousVersion, nextVersion) {
  if (!previousVersion) {
    return null;
  }

  const comparison = compareVersions(nextVersion, previousVersion);

  if (command === "upgrade" && comparison <= 0) {
    return `skipped upgrade because installed version ${previousVersion} is already >= target ${nextVersion}`;
  }

  if (command === "downgrade" && comparison >= 0) {
    return `skipped downgrade because installed version ${previousVersion} is already <= target ${nextVersion}`;
  }

  return null;
}

async function prepareInstallSource(command, requestedVersion) {
  const selector = normalizeVersionSelector(command, requestedVersion);

  if (!selector || selector === manifest.version) {
    return {
      sourceDir: skillDir,
      resolvedVersion: manifest.version,
      cleanup: async () => {},
    };
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "app-skill-"));
  const packageSpec = `${packageManifest.name}@${selector}`;
  const packageSegments = packageManifest.name.split("/");

  try {
    await runNpm([
      "install",
      "--prefix",
      tempRoot,
      "--no-save",
      "--no-package-lock",
      packageSpec,
    ]);

    const downloadedSkillDir = path.join(
      tempRoot,
      "node_modules",
      ...packageSegments,
      "skill"
    );
    const downloadedManifest = JSON.parse(
      await readFile(path.join(downloadedSkillDir, "skill.json"), "utf8")
    );

    return {
      sourceDir: downloadedSkillDir,
      resolvedVersion: downloadedManifest.version,
      cleanup: async () => {
        await rm(tempRoot, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

async function install(host, projectRoot, isGlobal, command, requestedVersion) {
  const source = await prepareInstallSource(command, requestedVersion);
  const targets = resolveTargets(host, projectRoot, isGlobal);

  try {
    for (const { host: targetHost, target } of targets) {
      const previousVersion = await readInstalledVersion(target);
      const skipReason = shouldSkipInstall(
        command,
        previousVersion,
        source.resolvedVersion
      );

      if (skipReason) {
        console.log(`${skipReason} for ${targetHost} at ${target}`);
        continue;
      }

      await rm(target, { recursive: true, force: true });
      await mkdir(path.dirname(target), { recursive: true });
      await cp(source.sourceDir, target, { recursive: true });
      console.log(
        `${describeTransition(command, previousVersion, source.resolvedVersion)} for ${targetHost} at ${target}`
      );
    }
  } finally {
    await source.cleanup();
  }
}

async function uninstall(host, projectRoot, isGlobal) {
  const targets = resolveTargets(host, projectRoot, isGlobal);

  for (const { host: targetHost, target } of targets) {
    const previousVersion = await readInstalledVersion(target);
    await rm(target, { recursive: true, force: true });
    if (previousVersion) {
      console.log(`removed ${manifest.name}@${previousVersion} for ${targetHost} from ${target}`);
      continue;
    }
    console.log(`no existing ${manifest.name} install for ${targetHost} at ${target}`);
  }
}

async function validatePackage() {
  const specEntry = typeof manifest.specEntry === "string" ? manifest.specEntry : null;
  const requiredFiles = [
    path.join(skillDir, manifest.entry),
    path.join(skillDir, "skill.json"),
    path.join(skillDir, "agents", "openai.yaml"),
    specEntry ? path.join(skillDir, specEntry) : null,
  ];

  for (const file of requiredFiles) {
    if (!file) continue;
    await readFile(file, "utf8");
  }

  if (manifest.name !== "app") {
    throw new Error(`Unexpected manifest name "${manifest.name}".`);
  }

  if (supportedHosts.length < 3) {
    throw new Error("Expected at least three supported hosts in the manifest.");
  }

  if (specEntry !== "spec.md") {
    throw new Error('Expected manifest.specEntry to be "spec.md".');
  }

  if (
    !Array.isArray(manifest.requiredReads) ||
    !manifest.requiredReads.includes(manifest.entry) ||
    !manifest.requiredReads.includes(specEntry)
  ) {
    throw new Error(
      `Expected manifest.requiredReads to include "${manifest.entry}" and "${specEntry}".`
    );
  }

  for (const [host, config] of Object.entries(manifest.hosts)) {
    if (!config.projectPath || !config.globalPathFallback || !config.globalPathEnv) {
      throw new Error(`Host "${host}" is missing install path configuration.`);
    }
  }

  console.log(`validated ${manifest.name}@${manifest.version}`);
}

async function fetchLatestPublishedVersion() {
  const { stdout } = await runNpm(["view", packageManifest.name, "version"]);
  const latest = stdout.trim();

  if (!latest) {
    throw new Error(`Could not resolve the latest published version for ${packageManifest.name}.`);
  }

  return latest;
}

async function printOutdated(host, projectRoot, isGlobal) {
  const latestPublishedVersion = await fetchLatestPublishedVersion();
  console.log(
    `package ${packageManifest.name} current=${manifest.version} latest=${latestPublishedVersion}`
  );

  const targets = resolveTargets(host, projectRoot, isGlobal);
  for (const { host: targetHost, target } of targets) {
    const installedVersion = await readInstalledVersion(target);
    const comparison = installedVersion
      ? compareVersions(installedVersion, latestPublishedVersion)
      : null;
    const state = installedVersion
      ? comparison < 0
        ? "update-available"
        : comparison > 0
          ? "ahead-of-latest"
          : "up-to-date"
      : "not-installed";

    console.log(
      `${targetHost} installed=${installedVersion ?? "none"} latest=${latestPublishedVersion} state=${state} path=${target}`
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = normalizeHost(args.host);

  switch (args.command) {
    case "help":
      printHelp();
      return;
    case "version":
      printVersion();
      return;
    case "outdated":
      await printOutdated(host, path.resolve(args.project), args.global);
      return;
    case "manifest":
      console.log(JSON.stringify(manifest, null, 2));
      return;
    case "validate":
      await validatePackage();
      return;
    case "install":
    case "update":
    case "upgrade":
    case "downgrade":
      await install(
        host,
        path.resolve(args.project),
        args.global,
        args.command,
        args.version
      );
      return;
    case "uninstall":
      await uninstall(host, path.resolve(args.project), args.global);
      return;
    default:
      throw new Error(`Unknown command "${args.command}".`);
  }
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "app-skill failed unexpectedly"
  );
  process.exit(1);
}
