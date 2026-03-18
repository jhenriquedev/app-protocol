# Installing the `/app` Skill

This guide explains how to install, update, downgrade, and remove the canonical `/app` skill for Codex, Claude, GitHub Copilot, Windsurf, and other Agent Skills-compatible hosts.

## Prerequisites

- Node.js `20+`
- npm
- access to the target project directory or your user home directory

## Package

Published npm package:

```text
@app-protocol/skill-app
```

Validate the package before installing:

```bash
npx @app-protocol/skill-app validate
```

List commands and print the installer version:

```bash
npx @app-protocol/skill-app --help
npx @app-protocol/skill-app --version
npx @app-protocol/skill-app -v
```

## Project-local install

Install for every supported host inside the current project:

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

Expected directories:

- `.codex/skills/app/`
- `.claude/skills/app/`
- `.github/skills/app/`
- `.windsurf/skills/app/`
- `.agents/skills/app/`

## Global install

Install globally for the selected host:

```bash
npx @app-protocol/skill-app install codex --global
npx @app-protocol/skill-app install claude --global
npx @app-protocol/skill-app install copilot --global
npx @app-protocol/skill-app install windsurf --global
npx @app-protocol/skill-app install agents --global
```

Default global targets:

- Codex: `~/.codex/skills/app/`
- Claude: `~/.claude/skills/app/`
- GitHub Copilot: `~/.copilot/skills/app/`
- Windsurf: `~/.codeium/windsurf/skills/app/`
- Generic agent-skills host: `~/.agents/skills/app/`

If `CODEX_HOME`, `CLAUDE_HOME`, `COPILOT_HOME`, `WINDSURF_HOME`, or `AGENTS_HOME` is set, the installer uses those roots instead.

## Update an existing install

Update re-installs the current package version into the selected host directories:

```bash
npx @app-protocol/skill-app update all --project .
npx @app-protocol/skill-app update copilot --global
```

## Upgrade or downgrade by version

Upgrade and downgrade are version-pinned reinstalls. The effective target version comes from the package version you execute:

```bash
npx @app-protocol/skill-app upgrade all --project .
npx @app-protocol/skill-app downgrade all --project . --version 0.0.9
npx @app-protocol/skill-app install all --project . --version 0.0.9
```

`upgrade` skips when the installed version is already newer or equal to the resolved target. `downgrade` skips when the installed version is already lower or equal to the requested target.

You can do the same with a globally installed CLI:

```bash
npm install --global @app-protocol/skill-app
app-skill --version
app-skill upgrade codex --project .
```

## Uninstall

Remove the installed skill from the selected host directories:

```bash
npx @app-protocol/skill-app uninstall all --project .
npx @app-protocol/skill-app uninstall windsurf --global
```

## Install from GitHub Release tarball

Use this when npm is unavailable or when you want a pinned release asset:

```bash
npm exec --yes --package https://github.com/jhenriquedev/app-protocol/releases/download/vX.Y.Z/app-protocol-skill-app-X.Y.Z.tgz app-skill -- install all --project .
```

## Install from the repository source

If you are working inside this repository:

```bash
npm run skill:sync
npm exec --yes --package ./tooling/skill-app app-skill -- install all --project .
```

## Verify installation

Validate the package itself:

```bash
npx @app-protocol/skill-app validate
```

Verify the installed files:

```bash
find .codex/skills/app -maxdepth 3 -type f | sort
find .claude/skills/app -maxdepth 3 -type f | sort
find .github/skills/app -maxdepth 3 -type f | sort
find .windsurf/skills/app -maxdepth 3 -type f | sort
find .agents/skills/app -maxdepth 3 -type f | sort
```

Minimum expected files per host:

- `SKILL.md`
- `skill.json`

## What the installer does

The installer copies the canonical skill package into the host-specific skill directory.

It does not:

- modify your project code
- change the APP protocol
- update already installed skills automatically unless you run install again
- guess a downgrade target version without an explicit package version

## Troubleshooting

If `npx @app-protocol/skill-app validate` fails:

- confirm your npm installation works
- confirm the package version exists on npm
- confirm network access to `registry.npmjs.org`

If the host does not find the skill after install:

- verify the target directory exists
- verify the file is named `SKILL.md`
- verify the frontmatter still contains `name: app`
- verify you selected the correct host directory for the tool you are using

If npm is unavailable:

- install from the GitHub Release tarball instead

## Next

- [`using-app-skill.md`](./using-app-skill.md)
- [`publishing.md`](./publishing.md)
