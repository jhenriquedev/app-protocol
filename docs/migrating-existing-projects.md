# Migrate an Existing Project to APP

This guide explains how to adopt APP incrementally inside an existing codebase.

## Core rule

Do not force a big-bang migration unless the project explicitly wants one.

APP supports bounded, incremental adoption.

## What incremental adoption means

You may:

- introduce APP only in a subset of the repository
- create new APP Cases for new capabilities
- refactor one capability slice at a time
- keep legacy code running while APP-managed areas grow

## Recommended migration sequence

### 1. Inspect the current topology

Identify:

- existing capability boundaries
- current host/runtime entrypoints
- shared libraries already reused across the codebase
- risky coupling points

### 2. Choose the first capability slice

Good first candidates:

- a new feature
- a bounded refactor
- a capability with clear ownership

Avoid starting with the most entangled subsystem in the repository.

### 3. Create an APP-managed area

Introduce:

- `cases/` for the migrated capability slice
- `apps/<app>/registry.ts` for the host that will expose it
- `packages/` only if shared project code needs host-mediated exposure

The APP-managed area should be explicit and reviewable.

### 4. Wrap shared dependencies intentionally

If migrated Cases need shared project code:

- place project-level shared code in `packages/`
- expose it through `_packages`
- consume it via `ctx.packages`

Do not re-create hidden service-locator behavior through direct imports.

### 5. Keep legacy boundaries visible

During transition:

- do not silently mix APP grammar into arbitrary legacy folders
- document where APP-managed and legacy areas meet
- keep new APP code internally consistent even if the repo as a whole is still mixed

### 6. Grow capability by capability

After the first slice:

- add new APP Cases for adjacent capabilities
- move shared host wiring into registries
- promote only stable protocol-level contracts into `core/shared/`

## What not to do

- do not rewrite the entire repo before proving one APP slice works
- do not move everything into `core/`
- do not use `packages/` as a dumping ground for unrelated legacy helpers
- do not claim full APP conformance when only a bounded area is APP-managed

## Success criteria

An incremental migration is going well when:

- the APP-managed area is structurally explicit
- new Cases are capability-cohesive
- hosts expose only what they need
- project sharing happens through `packages/` instead of hidden cross-imports
- the migration can stop at any point without leaving the repo in a half-broken state

## Relationship to the spec

Baseline APP allows partial adoption and bounded migration.

What matters is that:

- the APP-managed area follows APP grammar
- the host app remains the composition root
- conformance claims stay honest about scope

## Read next

- [`create-app-project.md`](./create-app-project.md)
- [`add-host-app.md`](./add-host-app.md)
- [`using-packages.md`](./using-packages.md)
- [`../spec.md`](../spec.md)
