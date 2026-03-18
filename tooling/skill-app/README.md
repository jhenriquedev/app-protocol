# `@app-protocol/skill-app`

Install the canonical `/app` skill for APP projects.

## What it installs

The package installs the `app` skill into supported host directories:

- Codex
- Claude

## Validate the package

```bash
npx @app-protocol/skill-app validate
```

## Install into the current project

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

## Global install

```bash
npx @app-protocol/skill-app install codex --global
npx @app-protocol/skill-app install claude --global
```

## Release tarball fallback

```bash
npm exec --yes --package https://github.com/jhenriquedev/app-protocol/releases/download/vX.Y.Z/app-protocol-skill-app-X.Y.Z.tgz app-skill -- install all --project .
```

## What `/app` is for

Use `/app` when working in APP projects to:

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
