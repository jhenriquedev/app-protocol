# US: task_move

## Capability

Move a persisted work item between studio board columns.

## Context

The studio board uses three statuses: `backlog`, `active`, and `complete`.
Moves must preserve the canonical item identity and timestamps.

## Input Requirements

- `itemId` is required
- `targetStatus` is required

## Output Requirements

- return the updated item after persistence

## Validation Rules

- `itemId` cannot be blank
- `targetStatus` must be one of the three allowed statuses

## Business Invariants

- the item id does not change
- only the status and `updatedAt` change during a move

## Surfaces Involved

- `domain`
- `api`
- `ui`
- `agentic`

## Composition

Atomic Case. The move writes directly through the board store.

## Events / recovery / policy

- no stream surface in v1
- mutating action requires confirmation in agentic hosts

## Validation Scenarios

- move from backlog to active
- move from active to complete
- reject unknown statuses
- fail with structured not-found when the item is missing

## Open Questions

- none

## Status

Approved for implementation.
