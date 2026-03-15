# RFC Process

Use an RFC when a proposal changes APP semantics, structure, schema, or governance.

Good candidates for RFCs:

- adding or removing surfaces
- changing dependency rules
- formalizing `agentic.case.ts`
- changing release or conformance policy
- renaming core concepts

## Process

1. Open an issue for the problem or proposal.
2. Copy [`0000-template.md`](./0000-template.md).
3. Give it the next available number.
4. Describe the problem, proposal, tradeoffs, and migration impact.
5. Open a pull request for discussion.
6. Once accepted, update `spec.md` and supporting docs.
7. If the change is accepted and release-worthy, publish a new snapshot in `versions/`.
