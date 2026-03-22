# Changelog

All notable changes to this project should be documented in this file.

## Unreleased

## v1.1.4

### Changed

- Root, installer, example, skill metadata, runtime headers, docs, and release alignment now advance to `1.1.4`
- The current working draft and the installable skill spec now point to `v1.1.4` as the latest released snapshot

### Fixed

- Updated the `/app` skill frontmatter description to remove XML-like angle-bracket notation so `SKILL.md` can be imported by Claude Code without `description cannot contain XML tags`
- Kept the installable skill metadata aligned with the same Claude-compatible wording across the canonical skill, mirrored host installs, and the npm package

## v1.1.3

### Changed

- Root, installer, example, skill metadata, runtime headers, docs, and release alignment now advance to `1.1.3`
- The current working draft and the installable skill spec now point to `v1.1.3` as the latest released snapshot
- Release docs and snapshot indexes now reflect the new patch release and keep `v1.1.1` visible in the release alignment chain

### Fixed

- Stabilized the installable `spec.md` copies generated for skill hosts by rewriting root-relative links to canonical GitHub URLs
- Fixed markdownlint drift in release-facing docs and plans so the release branch matches CI expectations
- Cut a release snapshot from the post-`v1.1.2` documentation and validation fixes instead of leaving them only on `main`

## v1.1.2

### Added

- RFC [`0003-visual-surface-specialization.md`](./rfcs/0003-visual-surface-specialization.md) to formalize the visual surface family and platform-specialized contracts
- Canonical `web.case.ts` and `mobile.case.ts` base contracts in the TypeScript baseline, plus `AppCaseSurfaces.web` and `AppCaseSurfaces.mobile`
- Installer command `outdated` to compare installed `/app` skill versions against the latest published npm release
- Installable `spec.md` shipped alongside `SKILL.md` inside the canonical `/app` skill package
- Release snapshot [`versions/v1.1.2.md`](./versions/v1.1.2.md) for the current working draft

### Changed

- APP visual surfaces now form a family: `ui` remains the general surface while `web` and `mobile` are specialized optional surfaces with shared semantics and independent concrete contracts
- Root, installer, example, skill metadata, runtime headers, docs, and release verification now align on `1.1.2`
- The active `/app` documentation set is promoted to `docs/skill_v6.md`
- `/app` now requires agents to read the installed adjacent `spec.md` together with `SKILL.md`
- Skill sync now copies the current root `spec.md` into the installable skill before mirroring it to host targets and the npm package

### Fixed

- Removed drift where active docs, release checks, and skill manifests still referenced `v1.1.1` or `docs/skill_v5.md`
- Removed installer-package ambiguity by making `spec.md` a required installed artifact instead of a repo-only reference

## v1.1.1

### Added

- Exact canonical class templates for `domain`, atomic/composed `api`, `ui`, atomic/composed `stream`, and `agentic` in the active `/app` skill materials
- Release snapshot [`versions/v1.1.1.md`](./versions/v1.1.1.md) for the current working draft

### Changed

- Repository, example manifests, skill metadata, and host-visible version strings advance to `1.1.1`
- Docs CI now validates APP boundaries and the installable skill package in addition to typecheck
- The active `/app` documentation set is synchronized across `skills/app/`, installable skill mirrors, and `docs/skill_v5.md`
- Example index/docs now point to the maintained Deno companion and remove stale `.NET` references that were no longer backed by a current example directory
- The canonical agent host now validates its runtime once and enforces that validation before tool execution and MCP operations

### Fixed

- `user_register.ui.case.ts` and `user_validate.ui.case.ts` tests no longer depend on ambient host HTTP clients; they stub and restore `ctx.api` locally
- Removed ambiguity in `/app` around the exact class shape required for each Case surface

## v1.1.0

### Added

- Self-contained `examples/typescript/` as a full 100% TypeScript APP companion with `backend`, `portal`, and `agent` hosts plus HTTP, MCP `stdio`, and remote MCP HTTP publication
- Companion runnable references for Next.js, Node.js, Go, Deno, .NET, Angular, Flutter, Java, Kotlin, and Python under `examples/`
- Release snapshot [`versions/v1.1.0.md`](./versions/v1.1.0.md) for the current working draft

### Changed

- Root baseline `src/` now centers the canonical `apps/agent/` host and shared MCP contracts, with the legacy root `chatbot` host removed
- `/app` review and validation flow now hardens boundary checking, agent-host completeness, and `.us.md` coverage across the active references
- Repository, examples, skill metadata, and host-visible version strings advance to `1.1.0`

### Fixed

- Removed remaining drift where `examples/typescript/` depended structurally on root `src/core` instead of keeping a local APP `core/`
- Completed semantic-resource publication, system prompt projection, and confirmation enforcement across the TypeScript `apps/agent/` host and its MCP smoke coverage
- Corrected stale example documentation that still described `examples/typescript/` as a compact legacy-style reference

## v1.0.1

### Added

- Formal MCP adapter contract for app-level agentic hosts in the working draft and the React reference example
- MCP stdio boundary for [`examples/react/apps/agent`](./examples/react/apps/agent) with end-to-end smoke coverage
- MCP semantic-resource publication (`resources/list`, `resources/read`) and host-built global prompt projection in the React reference agent host

### Changed

- `apps/agent/` conformance in the working draft and `/app` skill now requires both HTTP and MCP boundaries for complete app-level agentic hosts
- The `/app` skill now normatizes abstract MCP contracts in `core/shared/` and concrete transport implementations in `_providers`
- The `/app` skill, spec, and conformance docs now require registry-driven projection of the complete `AgenticDefinition`, descriptor-level semantic summaries, and host prompts assembled from registered tool prompt fragments
- Active release metadata now advances the repository, examples, installer package, and skill manifests to `1.0.1`

### Fixed

- Removed drift where complete agentic hosts could declare rich Case-level agentic metadata without normatively requiring the host runtime to project and publish it
- Completed agentic metadata and structured-error propagation across the remaining non-React agentic cases in the repository

## v1.0.0

### Added

- `v1.0.0` release snapshot under [`versions/`](./versions)
- Stable-release alignment across the protocol docs, installable `/app` skill package, and release automation for the first major APP publication

### Changed

- Root, examples, installer package, skill metadata, runtime headers, and host-visible version strings advanced to `1.0.0`
- Active docs and release instructions now treat `v1.0.0` as the latest stable APP snapshot
- `ROADMAP.md` now closes the v1 readiness phase and treats APP as having a stable baseline while leaving post-v1 tooling and ecosystem work open

### Fixed

- The `@app-protocol/skill-app` CLI now exposes `version`, `--version`, and `-v`, and the installer docs describe those entrypoints explicitly
- Removed stale `0.0.11` and `0.0.12` version drift from current manifests, runtime headers, and release-facing documentation

## v0.0.12

### Added

- `v0.0.12` release snapshot under [`versions/`](./versions)
- RFC [`0002-agent-host-contracts.md`](./rfcs/0002-agent-host-contracts.md) to formalize app-level agentic host contracts
- Normative `AgenticRegistry` and agent-host runtime responsibilities in [`spec.md`](./spec.md)

### Changed

- Root, example, installer package, skill metadata, and runtime headers advanced to `0.0.12`
- The canonical generic host name for app-level agentic runtimes is now `agent`; `chatbot` remains only a conversational specialization or legacy example reference
- Active docs and `/app` skill materials now distinguish Case-level `agentic.case.ts` from app-level agentic runtime responsibilities
- Canonical architecture and philosophy docs now reflect the agent host in the execution model

### Fixed

- Removed version drift where the active `/app` skill still declared alignment with `v0.0.11` after the working draft had already moved beyond that snapshot
- Removed documentation drift where the canonical agentic execution diagram omitted the host/runtime responsibilities now required by the spec
- Removed wording drift that treated `agentic.case.ts` as sufficient for full app-level agentic operability
- Removed ambiguity in host-app guidance that described `AgenticRegistry` as informal after it became a formal host contract in the spec

## v0.0.11

### Added

- `v0.0.11` release snapshot under [`versions/`](./versions)
- New active guides for APP structural work: [`docs/create-app-project.md`](./docs/create-app-project.md), [`docs/add-host-app.md`](./docs/add-host-app.md), [`docs/using-packages.md`](./docs/using-packages.md), and [`docs/migrating-existing-projects.md`](./docs/migrating-existing-projects.md)
- Expanded `/app` skill coverage for new-project bootstrap, host-app creation, package introduction, classification across `cases/`, `packages/`, and `core/shared/`, and incremental adoption of existing projects

### Changed

- Root, example, installer package, skill metadata, and runtime headers advanced to `0.0.11`
- `spec.md`, `README.md`, skill docs, and active supporting docs now align on APP bootstrap, host-app semantics, `packages/` usage, and incremental adoption
- The spec now formalizes promotion boundaries between `cases/`, `packages/`, `core/shared/`, and protocol evolution in `core/`
- The `/app` package README and host metadata now advertise the broader structural workflow, not only Case-level edits
- `ROADMAP.md` now treats published bootstrap/migration guidance as delivered documentation and moves the remaining migration item toward ecosystem validation

### Fixed

- Installer version fetch now works on Windows-compatible npm launchers instead of assuming a Unix-style `npm` executable
- `upgrade` and `downgrade` no longer reinstall the wrong published version when the local install is already newer or already lower than the requested target

## v0.0.10

### Added

- `v0.0.10` release snapshot under [`versions/`](./versions)
- Stronger conversion-oriented npm README for [`@app-protocol/skill-app`](./tooling/skill-app/README.md), including explicit positioning, quick start, and prompt examples

### Changed

- Root, example, installer package, skill metadata, and runtime headers advanced to `0.0.10`
- `/app` descriptions now emphasize inspecting architecture, creating or updating Cases, implementing surfaces, validating APP grammar, and reviewing drift
- Getting started, skill usage, and package docs now explain APP as the protocol layer of the AI-First Programming Paradigm and improve first-use onboarding

## v0.0.9

### Added

- `v0.0.9` release snapshot under [`versions/`](./versions)
- Native host mirrors and installer support for GitHub Copilot, Windsurf, and generic Agent Skills-compatible hosts
- `/app` skill onboarding improvements, including a stronger entry point, concrete prompt examples, and a canonical `usuario_criar` walkthrough

### Changed

- Root, example, installer package, skill metadata, and runtime headers advanced to `0.0.9`
- The installer CLI now supports `install`, `update`, `upgrade`, `downgrade`, and `uninstall`
- Installation docs, package README, repository README, and development-flow docs now align with the multi-host skill lifecycle
- Open Work now treats `/app` stabilization and expanded host coverage as closed in `v0.0.9`

## v0.0.8

### Added

- `v0.0.8` release snapshot under [`versions/`](./versions)
- Complete onboarding and operational documentation set under [`docs/`](./docs), including getting started, installation, usage, protocol overview, core concepts, examples, FAQ, glossary, and spec-reading guides
- Package-level README for [`@app-protocol/skill-app`](./tooling/skill-app/README.md)
- Automated GitHub Actions release workflow for the installable `/app` skill under [`.github/workflows/release-skill-app.yml`](./.github/workflows/release-skill-app.yml)
- Release helpers for changelog extraction and version alignment verification under [`scripts/`](./scripts)

### Changed

- Root, example, and npm installer package versions advanced to `0.0.8`
- README, spec, and versions index now align with `v0.0.8`
- Root package scripts now expose `npm run release:notes` and `npm run release:verify`
- README and development-flow docs now document the automated publish pipeline and the release tarball fallback
- `docs/skill_v5.md`, `skills/app/skill.json`, and runtime metadata now align with `0.0.8`

## v0.0.7

### Added

- `v0.0.7` release snapshot under [`versions/`](./versions)
- Canonical installable `/app` skill package under [`skills/app/`](./skills/app)
- npm-publishable installer package under [`tooling/skill-app/`](./tooling/skill-app)
- `skill.json` manifest and `agents/openai.yaml` metadata for `/app`
- `scripts/sync-app-skill.mjs` to mirror the canonical skill into `.codex/`, `.claude/`, and the installer package

### Changed

- Root, example, and npm installer package versions advanced to `0.0.7`
- README, spec, and versions index now align with `v0.0.7`
- `.codex/skills/app/` and `.claude/skills/app/` now contain real skill packages with frontmatter and host metadata instead of thin pointers
- README and development-flow docs now distinguish the published `/app` revision in `docs/` from the installable source in `skills/app/`
- Root package scripts now expose `npm run skill:sync` and `npm run skill:pack`
- `docs/skill_v5.md`, `skills/app/skill.json`, and runtime metadata now align with `0.0.7`

## v0.0.6

### Added

- `v0.0.6` release snapshot under [`versions/`](./versions)
- `docs/skill_v5.md` as the refined revision of the canonical `/app` operational skill

### Changed

- Root and example package versions advanced to `0.0.6`
- README, spec, roadmap, and versions index now align with `v0.0.6`
- `.codex/skills/app/SKILL.md` and `.claude/skills/app/SKILL.md` now point to `docs/skill_v5.md`
- The active `/app` revision moved from `docs/skill_v4.md` to `docs/skill_v5.md`
- Open Work now treats the refined `/app` revision as closed in `v0.0.6` and moves remaining tooling hardening to the next cycle

## v0.0.5

### Added

- `v0.0.5` release snapshot under [`versions/`](./versions)
- `docs/skill_v3.md` as the first HML of the canonical `/app` operational skill
- `.codex/skills/app/SKILL.md` and `.claude/skills/app/SKILL.md` as mirrored `/app` skill entrypoints
- `<case>.us.md` as the canonical support artifact for stricter operational profiles
- Explicit baseline-vs-profile language in conformance documentation for skill-driven enforcement

### Changed

- Root and example package versions advanced to `0.0.5`
- README, spec, roadmap, and versions index now align with `v0.0.5`
- Open Work now treats the first `/app` skill HML as delivered and moves remaining tooling hardening to the next cycle
- Active documentation now frames `app_infra_contracts` as minimal illustrative integration contracts and keeps `auth`, `db`, and `queue` host-defined
- Baseline APP now treats `test()` as strongly recommended while operational profiles such as `/app` may require it
- `docs/skill_v3.md` was translated into the English-first active documentation set
- Legacy `.docs/` materials were removed from the active repository tree; the current skill draft now lives under `docs/`

### Fixed

- Request-scoped `ctx.cases` materialization across backend, lambda, chatbot, and TypeScript example hosts to prevent boot-context leakage during cross-case composition
- `user_register` API validation now rejects short passwords consistently with domain invariants
- Lambda HTTP responses now derive status codes from structured APP results, and the portal adapter preserves APP error envelopes instead of discarding them
- Backend, lambda, and chatbot hosts now dispatch the `user_registered` post-success event consistently
- Public agentic examples now unwrap `ApiResponse` correctly before returning tool output

## v0.0.4

### Added

- `v0.0.4` release snapshot under [`versions/`](./versions)
- Initial static boundary validator via `npm run validate:boundaries`
- Unified registry slots across illustrative hosts (`_cases`, `_providers`, `_packages`)
- Host-level stream recovery compatibility checks and dead-letter bindings in `src/` and `examples/typescript/`
- Stream dispatch wrapper in the TypeScript example so scenario execution goes through the app host instead of calling stream handlers directly

### Changed

- Root and example package versions advanced to `0.0.4`
- README and spec snapshot alignment updated to `v0.0.4`
- Open Work synchronized with completed documentation, `packages/`, chatbot-host, and stream-recovery items
- Active documentation no longer frames APP as a library-style deliverable; APP remains documented as a protocol

### Fixed

- Removed remaining legacy retry-slot references from active illustrative hosts
- Removed stale MCP integration blocker wording from active canonical materials
- Aligned `src/apps/chatbot/registry.ts` and `src/apps/lambdas/registry.ts` with the unified registry contract
- Updated the TypeScript example chatbot host metadata to `0.0.4`

## v0.0.3

### Breaking

- Removed `_present` slot from API surface pipeline — pipeline is now `validate → authorize → (composition | service)`
- Canonical `test()` signature standardized to `test(): Promise<void>` across all surfaces (no input, no output)

### Added

- `test()` abstract method on `BaseAgenticCase` and `BaseDomainCase`
- `InferCasesMap` utility type for type-safe cross-case composition via `ctx.cases`
- Per-app registry pattern using `satisfies` for type preservation
- `tsconfig.json` and `package.json` for type-checking illustrative code
- TypeCheck job in CI workflow (`.github/workflows/docs.yml`)
- `AppCaseSurfaces` typed with specific context types (`ApiContext`, `UiContext`, etc.) instead of `AppBaseContext`
- `idempotencyKey` property on `StreamEvent`
- Lifecycle hooks documented as Non-Goal in spec §9
- Domain surface integration documented as "manual by design" in spec §5.1
- `AppCaseError` throwable class implementing `AppError` — canonical error for business failures
- `BaseApiCase.execute()` catches `AppCaseError` and returns structured `{ success: false, error }` instead of re-throwing
- `apps/chatbot/` — agentic host example with tool discovery, MCP registration, and error handling
- §8.1 Canonical Test Model — phased conformance testing (definition → slots → integrated execution)
- `BaseAgenticCase.validateDefinition()` with structural invariant checks (discovery, tool, prompt, mcp)
- `user_register.domain.case.ts` examples (3 scenarios: valid, invalid email, short password)
- `AppSchema` formally documented as compatible subset of JSON Schema Draft 2020-12 (spec §4, JSDoc)
- Non-Goals expanded: importable runtime library, CLI, and scaffold explicitly excluded from protocol scope (spec §9)
- Open Work (spec §11) rewritten with versioned roadmap (v0.0.4, v0.0.4/v0.0.5, v0.0.5+)

### Changed

- `BaseUiCase` `initialState` now optional (defaults to `{} as TState`)
- `BaseUiCase` slot signatures accept variadic args (`(...args: unknown[]): unknown`)
- `docs/agentic.md` rewritten for class-based `BaseAgenticCase`
- `rfcs/0001-agentic-protocol.md` rewritten with class-based example and corrected field names
- `AppStorageClient` JSDoc clarified: semantic distinction from `AppCache` (durable vs ephemeral)
- Portal registry changed from `: AppRegistry` to `satisfies` for type preservation consistency
- All example `test()` methods updated to phased model (Phase 1: structure, Phase 2: slots, Phase 3: integration)
- API `_validate` slots use `AppCaseError("VALIDATION_FAILED")` with structured details instead of plain `Error`
- Directory layout in spec updated to include `chatbot` host
- Spec §7.1 updated to list `chatbot` as agentic host example

### Fixed

- Dependency direction violation: `user_register.api.case.ts` no longer imports from `apps/` — uses local `ExpectedCasesMap` for cross-case composition typing
- All TypeScript compilation errors resolved (strict mode, `@types/node`, union type casts)
- `agentic.case.ts` clarified as optional for now, but normative when present

## v0.0.2

- Introduced the `agentic.case.ts` surface
- Added conceptual sections for discovery, context, prompt, tool, MCP, RAG, policy, and examples
- Expanded APP from a case-structure protocol into an agent-operable model

## v0.0.1

- Introduced `Case` as the canonical unit of organization
- Defined core surfaces for `domain`, `api`, `ui`, and `stream`
- Established dependency boundaries and case-oriented filesystem conventions
