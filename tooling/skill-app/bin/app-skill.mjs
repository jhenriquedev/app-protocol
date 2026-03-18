#!/usr/bin/env node

import { cp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const skillDir = path.join(packageRoot, "skill");
const manifest = JSON.parse(
  await readFile(path.join(skillDir, "skill.json"), "utf8")
);

function printHelp() {
  console.log(`app-skill ${manifest.version}

Usage:
  app-skill install [codex|claude|all] [--project <path>]
  app-skill install [codex|claude|all] --global
  app-skill manifest
  app-skill validate
  app-skill help

Examples:
  app-skill install all --project .
  app-skill install codex --global
  npx @app-protocol/skill-app install claude --project .
`);
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
  if (normalized === "codex" || normalized === "codex-app") return "codex";
  if (normalized === "claude" || normalized === "claude-code") return "claude";
  throw new Error(`Unsupported host "${value}". Use codex, claude, or all.`);
}

function parseArgs(argv) {
  const [command = "help", maybeHost, ...rest] = argv;
  const args = {
    command,
    host: maybeHost && !maybeHost.startsWith("--") ? maybeHost : "all",
    project: process.cwd(),
    global: false,
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
  const hosts = host === "all" ? ["codex", "claude"] : [host];
  return hosts.map((entry) => ({
    host: entry,
    target: isGlobal ? getGlobalRoot(entry) : getProjectRoot(entry, projectRoot),
  }));
}

async function install(host, projectRoot, isGlobal) {
  const targets = resolveTargets(host, projectRoot, isGlobal);

  for (const { host: targetHost, target } of targets) {
    await rm(target, { recursive: true, force: true });
    await mkdir(path.dirname(target), { recursive: true });
    await cp(skillDir, target, { recursive: true });
    console.log(`installed ${manifest.name} for ${targetHost} at ${target}`);
  }
}

async function validatePackage() {
  const requiredFiles = [
    path.join(skillDir, manifest.entry),
    path.join(skillDir, "skill.json"),
  ];

  for (const file of requiredFiles) {
    await readFile(file, "utf8");
  }

  if (manifest.name !== "app") {
    throw new Error(`Unexpected manifest name "${manifest.name}".`);
  }

  console.log(`validated ${manifest.name}@${manifest.version}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = normalizeHost(args.host);

  switch (args.command) {
    case "help":
      printHelp();
      return;
    case "manifest":
      console.log(JSON.stringify(manifest, null, 2));
      return;
    case "validate":
      await validatePackage();
      return;
    case "install":
      await install(host, path.resolve(args.project), args.global);
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
