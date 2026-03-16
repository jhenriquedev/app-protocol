# Changelog

All notable changes to this project should be documented in this file.

## Unreleased

- Repository foundation for public GitHub publication
- Governance, contribution, RFC, and CI scaffolding
- Working draft promoted to `spec.md`
- Documentation consistency pass across README, spec, and process docs
- English-first policy documented for active materials
- Portuguese backup copies preserved under `i18n/pt-br`
- `examples/typescript/` standalone example (in progress)

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
- Non-Goals expanded: SDK, CLI, and scaffold explicitly excluded from protocol scope (spec §9)
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
