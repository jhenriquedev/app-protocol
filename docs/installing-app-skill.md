# Installing the `/app` Skill

This guide explains how to install the canonical `/app` skill for Codex and Claude.

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

## Project-local install

Install for both supported hosts inside the current project:

```bash
npx @app-protocol/skill-app install all --project .
```

Install only for Codex:

```bash
npx @app-protocol/skill-app install codex --project .
```

Install only for Claude:

```bash
npx @app-protocol/skill-app install claude --project .
```

Expected directories:

- `.codex/skills/app/`
- `.claude/skills/app/`

## Global install

Install globally for Codex:

```bash
npx @app-protocol/skill-app install codex --global
```

Install globally for Claude:

```bash
npx @app-protocol/skill-app install claude --global
```

Default global targets:

- Codex: `~/.codex/skills/app/`
- Claude: `~/.claude/skills/app/`

If `CODEX_HOME` or `CLAUDE_HOME` is set, the installer uses those roots instead.

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

## Troubleshooting

If `npx @app-protocol/skill-app validate` fails:

- confirm your npm installation works
- confirm the package version exists on npm
- confirm network access to `registry.npmjs.org`

If the host does not find the skill after install:

- verify the target directory exists
- verify the file is named `SKILL.md`
- verify the frontmatter still contains `name: app`

If npm is unavailable:

- install from the GitHub Release tarball instead

## Next

- [`using-app-skill.md`](./using-app-skill.md)
- [`publishing.md`](./publishing.md)
