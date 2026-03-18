# Development Flow

This repository should evolve like a serious specification project, not like an ad hoc notes folder.

## Change Types

APP changes fall into three categories.

### 1. Editorial

Examples:

- wording improvements
- typo fixes
- clarifications that do not change meaning

Editorial changes can go directly to pull requests.

### 2. Substantive

Examples:

- new surfaces
- changes to dependency rules
- schema changes
- conformance rules
- architectural properties
- canonical diagrams or visual grammar
- new registry behavior

Substantive changes should start with an issue.

An RFC is required when the change affects:

- protocol semantics
- canonical surfaces
- dependency rules
- formal schemas
- governance or release policy

### 3. Release

A release snapshots the current accepted spec into `versions/`.

## Recommended Workflow

1. Open an issue for the problem or proposal.
2. If the change affects protocol semantics, structure, schema, or governance, create an RFC in `rfcs/`.
3. Update `spec.md`.
4. Update supporting docs in `docs/` when the change affects philosophy, architecture, conformance, visual explanation, or the `/app` operational profile.
5. If accepted and release-worthy, publish a new version snapshot in `versions/`.
6. Update `CHANGELOG.md`.

## Repository Discipline

- `spec.md` is the living draft.
- `versions/` contains historical snapshots.
- `docs/` explains the model but does not override the spec.
- `docs/skill_v5.md` is the current published revision of the canonical `/app` skill.
- `skills/app/` is the canonical installable source of the `/app` skill.
- `.codex/skills/app/` and `.claude/skills/app/` are host mirrors generated from `skills/app/`.
- `tooling/skill-app/` is the npm-publishable installer package for `/app`.
- `.github/workflows/release-skill-app.yml` is the automated release pipeline for publishing the `/app` installer to GitHub Releases and npm.
- `docs/publishing.md` documents the one-time external npm Trusted Publishing setup that the workflow depends on.
- architectural explanations in `docs/` must remain aligned with the current working draft and must not introduce alternative semantics
- `examples/` should demonstrate conformance once implementations exist.
- `i18n/pt-br/` preserves native-language backup copies of Portuguese materials.

## Release Criteria

Do not cut a new version unless the change:

- is internally consistent
- has clear migration implications
- is reflected in the working draft
- is reflected in the active supporting docs and skill entrypoints when operational guidance changed
- is captured in the changelog

## Medium-Term Process Improvements

Planned process upgrades:

- RFC numbering rules
- semantic versioning policy for the spec
- conformance checklist for releases
- automated validation of examples
- stronger validation around architectural conformance and diagram drift
