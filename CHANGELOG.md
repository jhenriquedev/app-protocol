# Changelog

All notable changes to this project should be documented in this file.

## Unreleased

- No unreleased changes yet.

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
