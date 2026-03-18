# `@app-protocol/skill-app`

Install, update, downgrade, and remove the canonical `/app` skill for APP projects.

`/app` is the canonical skill for applying the APP protocol in real projects.
APP is the protocol layer of the AI-First Programming Paradigm.

## What this package does

This package installs the official `/app` operational workflow into supported AI coding hosts so they can:

- inspect APP architecture
- set up a new APP project
- add a new host app such as `backend`, `portal`, `agent`, `worker`, or `lambdas`
- create or update Cases
- introduce `packages/` and expose them correctly through host registries
- classify whether shared code belongs in `cases/`, `packages/`, or `core/shared/`
- implement `domain`, `api`, `ui`, `stream`, and `agentic` surfaces
- maintain `<case>.us.md`
- validate APP grammar
- review structural drift
- adapt existing projects to APP incrementally

For generic app-level agentic hosts, the canonical host name is `agent`.
Names such as `chatbot` are reserved for explicitly conversational specializations.

## Supported hosts

The package installs the `app` skill into native skill directories for:

- Codex
- Claude
- GitHub Copilot
- Windsurf
- other Agent Skills-compatible hosts through `.agents/skills`

Project-local targets:

- `.codex/skills/app/`
- `.claude/skills/app/`
- `.github/skills/app/`
- `.windsurf/skills/app/`
- `.agents/skills/app/`

## Validate the package

```bash
npx @app-protocol/skill-app validate
```

## CLI help

List all commands, host aliases, examples, and compatibility notes:

```bash
npx @app-protocol/skill-app --help
app-skill --help
```

Print only the CLI version:

```bash
npx @app-protocol/skill-app --version
npx @app-protocol/skill-app -v
app-skill version
app-skill --version
app-skill -v
```

## Quick start

```bash
npx @app-protocol/skill-app install all --project .
```

Then use prompts such as:

```text
inspect this project with /app
set up a new APP project with /app
add an agent host app using /app
create case usuario_criar
validate app grammar in this repository
adapt this existing project to APP incrementally
```

## Install into the current project

```bash
npx @app-protocol/skill-app install all --project .
```

Install only for one host:

```bash
npx @app-protocol/skill-app install codex --project .
npx @app-protocol/skill-app install claude --project .
npx @app-protocol/skill-app install copilot --project .
npx @app-protocol/skill-app install windsurf --project .
npx @app-protocol/skill-app install agents --project .
```

## Install globally

```bash
npx @app-protocol/skill-app install codex --global
npx @app-protocol/skill-app install claude --global
npx @app-protocol/skill-app install copilot --global
npx @app-protocol/skill-app install windsurf --global
npx @app-protocol/skill-app install agents --global
```

## Update an existing install

```bash
npx @app-protocol/skill-app update all --project .
npx @app-protocol/skill-app update copilot --global
```

## Upgrade or downgrade by package version

```bash
npx @app-protocol/skill-app upgrade all --project .
npx @app-protocol/skill-app downgrade all --project . --version 0.0.9
npx @app-protocol/skill-app install all --project . --version 0.0.9
```

`upgrade` installs npm `latest` by default, but now skips the operation when the installed version is already newer or equal. `downgrade` requires `--version` and skips the operation when the installed version is already lower or equal. `install` and `update` also accept `--version` when you want an explicit published version.

## Remove an installed skill

```bash
npx @app-protocol/skill-app uninstall all --project .
npx @app-protocol/skill-app uninstall windsurf --global
```

## Install the CLI with npm

```bash
npm install --global @app-protocol/skill-app
app-skill --help
app-skill --version
app-skill validate
app-skill install all --project .
```

## Platform compatibility

The installer is designed to work on:

- macOS
- Linux
- Windows

Compatibility notes:

- it uses Node.js standard library APIs for path resolution and file operations
- global and project-local install targets are built with `path.join`, not shell-specific path concatenation
- npm invocation uses a Windows-specific fallback so `npm.cmd`-style launchers work on `win32`
- no Unix-only shell commands are required by the installer itself

## Release tarball fallback

```bash
npm exec --yes --package https://github.com/jhenriquedev/app-protocol/releases/download/vX.Y.Z/app-protocol-skill-app-X.Y.Z.tgz app-skill -- install all --project .
```

## What `/app` is for

Use `/app` when working in APP projects to:

- inspect project structure and explain APP topology
- set up a new APP project
- add a new host app
- create or update Cases
- introduce `packages/`
- classify shared code across `cases/`, `packages/`, and `core/shared/`
- implement or revise surfaces
- maintain `<case>.us.md`
- validate APP grammar
- review structural drift
- adapt existing projects incrementally

## More documentation

- repository: [app-protocol](https://github.com/jhenriquedev/app-protocol)
- getting started: [docs/getting-started.md](https://github.com/jhenriquedev/app-protocol/blob/main/docs/getting-started.md)
- create a new project: [docs/create-app-project.md](https://github.com/jhenriquedev/app-protocol/blob/main/docs/create-app-project.md)
- add a host app: [docs/add-host-app.md](https://github.com/jhenriquedev/app-protocol/blob/main/docs/add-host-app.md)
- use packages: [docs/using-packages.md](https://github.com/jhenriquedev/app-protocol/blob/main/docs/using-packages.md)
- migrate an existing project: [docs/migrating-existing-projects.md](https://github.com/jhenriquedev/app-protocol/blob/main/docs/migrating-existing-projects.md)
- installation: [docs/installing-app-skill.md](https://github.com/jhenriquedev/app-protocol/blob/main/docs/installing-app-skill.md)
- usage: [docs/using-app-skill.md](https://github.com/jhenriquedev/app-protocol/blob/main/docs/using-app-skill.md)
