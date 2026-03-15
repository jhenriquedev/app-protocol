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
- new registry behavior

Substantive changes should start with an issue or an RFC.

### 3. Release

A release snapshots the current accepted spec into `versions/`.

## Recommended Workflow

1. Open an issue for the problem or proposal.
2. If the change is substantive, create an RFC in `rfcs/`.
3. Update `spec.md`.
4. Update supporting docs in `docs/`.
5. If accepted, publish a new version snapshot in `versions/`.
6. Update `CHANGELOG.md`.

## Repository Discipline

- `spec.md` is the living draft.
- `versions/` contains historical snapshots.
- `docs/` explains the model but does not override the spec.
- `examples/` should demonstrate conformance once implementations exist.

## Release Criteria

Do not cut a new version unless the change:

- is internally consistent
- has clear migration implications
- is reflected in the working draft
- is captured in the changelog

## Medium-Term Process Improvements

Planned process upgrades:

- RFC numbering rules
- semantic versioning policy for the spec
- conformance checklist for releases
- automated validation of examples
