# Publishing `/app`

This repository publishes the installable `/app` skill through GitHub Releases and npm.

## Release source of truth

- installable source: [`../skills/app/`](../skills/app/)
- npm package: [`../tooling/skill-app/`](../tooling/skill-app/)
- release workflow: [`../.github/workflows/release-skill-app.yml`](../.github/workflows/release-skill-app.yml)

## One-time setup

### 1. Own the npm package name

The npm package name in [`../tooling/skill-app/package.json`](../tooling/skill-app/package.json)
must belong to your npm user or organization.

If `@app-protocol/skill-app` is not under your control, either:

- create or claim the `app-protocol` npm organization and publish from there, or
- rename the package to a scope you already control

### 2. Configure npm Trusted Publishing

Configure the repository as a Trusted Publisher in npm for the package above.

Expected trust binding:

- provider: GitHub Actions
- repository: `jhenriquedev/app-protocol`
- workflow: `release-skill-app.yml`

The workflow already requests the required permissions:

- `contents: write`
- `id-token: write`

## Release flow

1. prepare version, changelog, and tag in the repository
2. push the tag, for example `v1.0.1`
3. GitHub Actions validates release alignment, typecheck, boundaries, skill package, and example scenario/tests
4. the workflow packs and publishes `tooling/skill-app/` to npm
5. the workflow creates or updates the GitHub Release and attaches the package tarball

## Manual fallback

If npm publishing is still blocked, the GitHub Release tarball remains installable:

```bash
npm exec --yes --package https://github.com/jhenriquedev/app-protocol/releases/download/vX.Y.Z/app-protocol-skill-app-X.Y.Z.tgz app-skill -- install all --project .
```
