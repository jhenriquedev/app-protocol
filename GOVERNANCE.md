# Governance

APP should evolve with the discipline of a specification, not only as a set of notes.

## Roles

### Maintainers

Maintainers are responsible for:

- curating the roadmap
- reviewing and merging changes
- resolving contradictory proposals
- deciding when a change is release-worthy

### Editors

Editors may be appointed by maintainers to improve wording, consistency, and structure without changing the intended meaning.

## Decision Types

### Editorial

Changes that do not alter protocol meaning.

Approval bar:

- maintainer review

### Substantive

Changes that affect protocol behavior, constraints, schemas, or terminology.

Approval bar:

- issue or RFC discussion
- maintainer acceptance
- working draft update

### Release

A release snapshots the accepted state of the working draft into `versions/`.

Approval bar:

- accepted substantive content
- changelog update
- internal consistency review

## Preferred Evolution Model

1. Discuss the problem.
2. Write the smallest coherent proposal.
3. Update the working draft.
4. Add or revise examples and supporting docs.
5. Snapshot a released version only when the change set is stable.

## Versioning Guidance

Until APP stabilizes, use lightweight `0.x.y` versioning for the written spec.

Suggested meaning:

- `x`: substantial conceptual milestone
- `y`: compatible clarification or bounded extension

Formal versioning rules can be tightened once conformance tooling exists.
