# RFC 0003: Visual Surface Specialization for APP Cases

Status: Draft

## Summary

This RFC formalizes a visual surface family in APP. `ui` remains the general
visual surface, while `web` and `mobile` become optional specialized visual
surfaces. All three share APP visual semantics, but platform-specialized
surfaces are not required to reuse the same concrete technical contract.

## Motivation

APP already supports a visual surface through `<case>.ui.case.ts`, but that
single surface is too coarse for projects that need first-class web and mobile
representations of the same capability.

If APP forced `mobile` to reuse the same concrete contract as `web`, the
protocol would leak framework and runtime assumptions into the surface model.
That would be contrary to APP's goals:

- keep capability semantics explicit
- keep host/runtime concerns separable
- avoid coupling the protocol to a single UI technology stack

Projects need a way to say:

- this capability has a general visual surface
- this capability has a specialized web surface
- this capability has a specialized mobile surface

without making React, Flutter, browser routing, device lifecycle, or navigation
stacks part of the same mandatory contract.

## Proposal

### 1. Canonical visual family

APP formalizes a visual surface family composed of:

- `ui`
- `web`
- `mobile`

The family semantics are:

- `ui` is the general visual surface
- `web` is the visual surface specialized for web runtimes
- `mobile` is the visual surface specialized for mobile runtimes

### 2. Shared semantic grammar, independent concrete contracts

APP standardizes the semantic grammar of visual surfaces:

```text
view ↔ _viewmodel ↔ _service ↔ _repository
```

But APP does not require `ui`, `web`, and `mobile` to share the same concrete
technical contract.

Normative intent:

- the protocol freezes responsibilities and semantic slots
- the protocol does not freeze the same runtime object model for all platforms
- host/runtime concerns may differ by surface

That means:

- `WebContext` may expose browser, routing, or SSR/CSR concerns
- `MobileContext` may expose device, lifecycle, or navigation concerns
- `UiContext` remains the general visual context

### 3. Surface independence

`web` and `mobile` are optional specialized surfaces in the same family as
`ui`, but they are not subclasses of `ui` in protocol terms.

Normative rules:

- a Case may implement only `ui`
- a Case may implement only `web`
- a Case may implement only `mobile`
- a Case may implement any combination of `ui`, `web`, and `mobile`
- `web` and `mobile` do not require the presence of `ui`

`ui` is therefore a general fallback surface, not a structural prerequisite for
specialized visual surfaces.

### 4. Host resolution

When more than one visual surface exists for the same Case, hosts resolve them
by runtime preference:

- web host prefers `web`, then `ui`
- mobile host prefers `mobile`, then `ui`
- generic visual host may use `ui`

### 5. Composition rules

This RFC does not relax APP composition rules.

The following remain true:

- visual surfaces do not perform direct cross-case composition
- cross-case orchestration remains in explicit execution surfaces
- capability sharing still happens through `ctx.cases` and host/runtime
  materialization, never through direct imports between Cases

## Alternatives Considered

### Keep only `ui`

Rejected because it leaves no canonical way to represent platform-specialized
visual surfaces as first-class APP capabilities.

### Rename `ui` to `web`

Rejected because `ui` already carries the meaning of a general visual surface.
Renaming it to `web` would narrow a concept that is intentionally broader than
browser-only runtimes.

### Make `web` and `mobile` aliases of `ui`

Rejected because aliases would not express the host/runtime distinction clearly
enough and would still encourage accidental reuse of a single concrete contract.

### Force one shared concrete contract for all visual surfaces

Rejected because it would couple the protocol to framework/runtime assumptions
that differ across web and mobile stacks.

## Drawbacks

- APP surface count grows from five to seven canonical surfaces
- host registries and docs must explain visual-family resolution more clearly
- installable tooling and operational profiles must now document three visual
  surfaces instead of one

## Migration Impact

This RFC is additive and compatible with existing APP projects.

Existing impact:

- current projects using only `ui` remain valid
- host registries may optionally add `web` and `mobile`
- skill `/app`, the spec, and active docs must be updated to reflect the visual
  family and host resolution rules
- TypeScript baseline contracts should add `web.case.ts`, `mobile.case.ts`,
  `WebContext`, `MobileContext`, and host-contract support for both surfaces

No current project is forced to split `ui` into `web` and `mobile`.

## Open Questions

- How much of the web/mobile context should remain illustrative versus
  normative in future multi-language references?
- Should future APP tooling validate host resolution of `web -> ui` and
  `mobile -> ui` as part of runtime conformance checks?
