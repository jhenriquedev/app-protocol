# US: task_list

## Capability

Load the current work items for the studio board.

## Context

The portal and agent hosts both need a canonical board read path that does not
mutate state.

## Input Requirements

- no required input in v1

## Output Requirements

- return all persisted items
- keep item ordering stable for presentation

## Validation Rules

- output items must use known statuses

## Business Invariants

- board reads do not mutate persistence
- returned items always contain timestamps and ids

## Surfaces Involved

- `domain`
- `api`
- `ui`
- `agentic`

## Composition

Atomic Case. No cross-case orchestration is required.

## Events / recovery / policy

- no stream surface in v1
- read-only direct execution in agentic hosts

## Validation Scenarios

- list an empty board
- list a board with items in multiple columns

## Open Questions

- none

## Status

Approved for implementation.
