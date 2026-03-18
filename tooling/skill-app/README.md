# `@app-protocol/skill-app`

Install, update, downgrade, and remove the canonical `/app` skill for APP projects.

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
npx @app-protocol/skill-app downgrade all --project . --version 0.0.8
npx @app-protocol/skill-app install all --project . --version 0.0.8
```

`upgrade` installs npm `latest` by default. `downgrade` requires `--version`. `install` and `update` also accept `--version` when you want an explicit published version.

## Remove an installed skill

```bash
npx @app-protocol/skill-app uninstall all --project .
npx @app-protocol/skill-app uninstall windsurf --global
```

## Install the CLI with npm

```bash
npm install --global @app-protocol/skill-app
app-skill validate
app-skill install all --project .
```

## Release tarball fallback

```bash
npm exec --yes --package https://github.com/jhenriquedev/app-protocol/releases/download/vX.Y.Z/app-protocol-skill-app-X.Y.Z.tgz app-skill -- install all --project .
```

## What `/app` is for

Use `/app` when working in APP projects to:

- inspect project structure and explain APP topology
- inspect topology
- create or update Cases
- implement or revise surfaces
- maintain `<case>.us.md`
- validate APP grammar
- review structural drift

## More documentation

- repository: [app-protocol](https://github.com/jhenriquedev/app-protocol)
- getting started: [docs/getting-started.md](https://github.com/jhenriquedev/app-protocol/blob/main/docs/getting-started.md)
- installation: [docs/installing-app-skill.md](https://github.com/jhenriquedev/app-protocol/blob/main/docs/installing-app-skill.md)
- usage: [docs/using-app-skill.md](https://github.com/jhenriquedev/app-protocol/blob/main/docs/using-app-skill.md)
