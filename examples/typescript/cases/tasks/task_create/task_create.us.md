# US: task_create

## Capability

Create a new work item for the studio board.

## Context

The task studio starts every new item in the `backlog` column and persists it
to the local JSON board store.

## Input Requirements

- `title` is required
- `description` is optional

## Output Requirements

- return the created item with `id`, `status`, and timestamps

## Validation Rules

- `title` cannot be blank after trimming
- `description`, when present, must be a string

## Business Invariants

- new items always start in `backlog`
- `createdAt` and `updatedAt` are ISO timestamps

## Surfaces Involved

- `domain`
- `api`
- `ui`
- `agentic`

## Composition

Atomic Case. No cross-case orchestration is required.

## Events / recovery / policy

- no stream surface in v1
- low-risk direct execution in agentic hosts

## Validation Scenarios

- create with title only
- create with title and description
- reject blank title

## Open Questions

- none

## Status

Approved for implementation.
