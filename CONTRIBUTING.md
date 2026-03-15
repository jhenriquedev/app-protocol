# Contributing

Thanks for helping evolve APP.

This repository is currently a specification project. Contributions should optimize for clarity, internal consistency, and future implementability.

## Before Opening A PR

Check whether your change is:

- editorial: wording, typos, formatting, clarifications
- substantive: protocol rules, schemas, release policy, naming, execution model

Editorial changes can go straight to pull requests.

Substantive changes should start with:

- an issue

Add an RFC in [`rfcs/`](./rfcs) when the change affects:

- protocol semantics
- canonical surfaces
- dependency rules
- schemas
- governance or release policy

## Preferred Workflow

1. Describe the problem clearly.
2. Explain why the current spec is insufficient.
3. Propose the smallest coherent change.
4. Update `spec.md` first.
5. Update supporting docs when needed.
6. If the change is accepted and release-worthy, add a snapshot in `versions/`.

## Language Policy

- Active documentation is English-first.
- Portuguese backups of native-language materials live in [`i18n/pt-br/`](./i18n/pt-br/).
- New normative documentation should be written in English unless maintainers explicitly decide otherwise.

## Writing Guidelines

- Prefer normative language only when the rule is intended to be binding.
- Keep examples minimal and deterministic.
- Do not introduce framework-specific assumptions into the core spec.
- Avoid vague abstractions that cannot later be validated by tooling.

## Pull Request Checklist

- The change is scoped and coherent.
- The current working draft reflects the intended behavior.
- Supporting docs are not contradictory.
- Changelog entries are updated when appropriate.

## Commit Guidance

Recommended commit style:

- `docs: clarify agentic surface constraints`
- `spec: define registry invariants`
- `process: add RFC template`
