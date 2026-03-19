# US: user_validate

## Capability

As a caller, I want to validate user profile input before downstream actions so I can receive deterministic validation feedback without mutating state.

## Context

- This Case is atomic.
- It belongs to the `users` domain.
- It is used directly from UI flows and as a dependency of `user_register`.
- The canonical execution path is `user_validate.api`.

## Input Requirements

- `email`: required string
- `name`: required string
- `age`: optional number

## Output Requirements

The Case returns:

- `valid`: boolean
- `errors`: string[]

Expected output rules:

- `valid` is `true` only when every semantic check passes
- `errors` is always present, even when empty

## Validation Rules

- `email` is required and must be a string
- `name` is required and must be a string
- semantic validation checks email format
- semantic validation checks name length
- `age`, when provided, must stay between `0` and `150`

## Business Invariants

- validation does not persist state
- validation does not require auth or tenant context in v1
- canonical validation feedback comes from the API surface, not from inferred agent logic

## Surfaces Involved

- `user_validate.domain.case.ts`
  - defines schemas, invariants, and examples
- `user_validate.api.case.ts`
  - exposes `POST /users/validate`
  - returns the canonical validation result
- `user_validate.ui.case.ts`
  - drives a self-contained validation form
  - calls the backend API via `ctx.api`
- `user_validate.agentic.case.ts`
  - exposes the Case as a read-only tool for `apps/agent`
  - delegates execution to `user_validate.api` through `ctx.cases`

## Composition

- no cross-case composition in this Case
- `user_register` may compose this Case through `ctx.cases`

## Integrations

### Host integrations

- `apps/backend`
  - route: `POST /users/validate`
- `apps/portal`
  - entry point: validation form submit
- `apps/agent`
  - publishes the same capability through HTTP and MCP

## Events / recovery / policy

- no `stream` surface in v1
- `user_validate.agentic` is exposed as tool `user_validate`
- MCP publication is enabled
- execution mode: `direct-execution`
- confirmation is not required

## Validation Scenarios

### Domain

1. Given a valid email, name, and optional age, the domain accepts the input shape.
2. Given missing `email` or `name`, the domain rejects the input.

### API

1. Given valid input, the API returns `valid: true` with an empty `errors` array.
2. Given invalid semantic input, the API returns `valid: false` with canonical error messages.

### UI

1. Given valid form input, the UI renders success feedback after the API call.
2. Given invalid form input, the UI keeps the user on the form and surfaces the error feedback.

### Agentic

1. The agentic surface exposes discovery, context, prompt, tool, MCP, RAG, and policy metadata.
2. Tool execution delegates to `user_validate.api` through `ctx.cases`.
3. Structured API failures propagate as `AppCaseError`.

## Status

- specified
- implemented and validated
