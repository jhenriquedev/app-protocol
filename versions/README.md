# Versions

This directory contains released snapshots of the APP specification.

Conventions:

- `spec.md` is the living draft
- files in `versions/` are historical snapshots
- released snapshots should not be edited except for obvious editorial fixes with strong justification
- later conceptual clarifications should land in `spec.md` and the next released snapshot rather than retroactively rewriting historical releases, unless a released file contains a clear factual or editorial defect
- new released snapshots should be published in English
- Portuguese backups of legacy native-language materials are preserved in [`../i18n/pt-br/`](../i18n/pt-br/)

Current snapshots:

- [`v1.1.6`](./v1.1.6.md)
- [`v1.1.5`](./v1.1.5.md)
- [`v1.1.4`](./v1.1.4.md)
- [`v1.1.3`](./v1.1.3.md)
- [`v1.1.2`](./v1.1.2.md)
- [`v1.1.1`](./v1.1.1.md)
- [`v1.1.0`](./v1.1.0.md)
- [`v1.0.1`](./v1.0.1.md)
- [`v1.0.0`](./v1.0.0.md)
- [`v0.0.12`](./v0.0.12.md)
- [`v0.0.11`](./v0.0.11.md)
- [`v0.0.10`](./v0.0.10.md)
- [`v0.0.9`](./v0.0.9.md)
- [`v0.0.8`](./v0.0.8.md)
- [`v0.0.7`](./v0.0.7.md)
- [`v0.0.6`](./v0.0.6.md)
- [`v0.0.5`](./v0.0.5.md)
- [`v0.0.4`](./v0.0.4.md)
- [`v0.0.2`](./v0.0.2.md)
- [`v0.0.1`](./v0.0.1.md)

Note:

- `v1.1.6` is the correctly aligned release of the Claude Code compatibility patch: it republishes the frontmatter-safe `/app` skill wording on a commit/tag pair cut in sequence after the broken `v1.1.5` tag.
- `v1.1.5` is the clean re-cut of the Claude Code compatibility patch: it republishes the frontmatter-safe `/app` skill wording on a correctly aligned release/tag pair after the broken `v1.1.4` tag cut.
- `v1.1.4` is the Claude Code compatibility patch for the installable `/app` skill: it removes XML-like angle-bracket notation from the skill description frontmatter while preserving the `spec.md`-alongside-`SKILL.md` installation model and aligned release metadata.
- `v1.1.3` is the stabilization patch for the `v1.1.2` release train: it cuts a clean release from the CI/documentation fixes, preserves the installable `spec.md` publishing model, and keeps the release metadata aligned after the post-tag corrections.
- `v1.1.2` formalizes the visual surface family around `ui`, `web`, and `mobile`, installs `spec.md` alongside the canonical `/app` skill, and adds installer support for checking whether an installed skill is behind the latest published version.
- `v1.1.1` hardens the operational APP release surface: the active `/app` skill now includes exact canonical class templates for every Case surface, docs CI validates boundaries plus the installable skill package, agent-host runtime validation is enforced before tool and MCP operations, and stale example docs now point to the maintained Deno companion instead of an absent `.NET` reference.
- `v1.1.0` consolidates the multi-runtime reference wave: the root baseline now centers the canonical `apps/agent/` host, the repository ships a self-contained 100% TypeScript companion reference, and companion examples across Next.js, Node.js, Go, Deno, .NET, Angular, Flutter, Java, Kotlin, and Python are aligned under the current `/app` profile.
- `v1.0.1` closes the first post-stable APP refinement cycle: the `/app` skill and the working draft now normatize registry-driven projection of the complete agentic contract, host-built global prompts, and MCP semantic resources for complete `apps/agent/` publication.
- `v1.0.0` is the first stable APP release. It packages the current protocol baseline, the formal app-level agentic host contract, aligned release tooling, and the installer/runtime version cleanup required for stable publication.
- `v0.0.12` formalizes app-level agentic host contracts, `apps/agent/` as the canonical generic host name for agentic runtimes, and the supporting documentation alignment needed to close drift between Case-level and app-level operability.
- `v0.0.11` adds structural APP guidance for new-project bootstrap, host-app creation, `packages/` usage, incremental adoption of existing projects, and sharper protocol boundaries around `core/` evolution.
- `v0.0.10` improves `/app` package discoverability with stronger positioning, onboarding copy, and prompt-based package guidance.
- `v0.0.9` stabilizes `/app` with stronger onboarding, lifecycle operations, and native host coverage across Codex, Claude, GitHub Copilot, Windsurf, and compatible skill hosts.
- `v0.0.8` adds a complete onboarding and operational documentation layer for APP and `/app`.
- `v0.0.7` packages `/app` as an installable skill with host mirrors and npm/npx installer support.
- `v0.0.6` promotes `docs/skill_v5.md` as the active `/app` revision.
- `v0.0.5` is the first release aligned with the canonical `/app` skill HML.
- `v0.0.4` is the first English snapshot published under the current documentation policy.
- `v0.0.1` and `v0.0.2` are legacy Portuguese snapshots that predate the English-first documentation policy.
