# APP Philosophy

## AI-First Programming

The **AI-First Programming Protocol (APP)** is based on a simple observation:
modern software is no longer written and maintained only by humans.
AI systems are increasingly participating in development, maintenance, and operation of software systems.

Traditional architectures were designed for human cognition.
APP proposes a structure that works for **both humans and AI agents**.

APP is not only a code organization pattern.
It is a **programming philosophy** for building systems that are:

- understandable by humans
- navigable by AI
- operable by agents
- evolvable over time

## Core Idea

APP organizes software around **self-contained capabilities** called **Cases**.

A Case represents a **single capability of the system**, expressed through a predictable structure that minimizes ambiguity.

Instead of scattering logic across multiple layers and folders, APP places the complete context of a capability inside a **Case folder**.

This enables:

- clear reasoning about behavior
- low context cost for AI
- faster onboarding for developers
- safer modification of existing systems

## Capability-Oriented Design

In APP, software is modeled as a **set of capabilities**, not as layers.

Traditional architectures often start with technical layers:

```text
controllers
services
repositories
models
```

APP instead starts with **capabilities**:

```text
validate user
create invoice
calculate credit score
send notification
```

Each capability becomes a **Case**.

A Case contains everything necessary to implement and operate that capability.

## Self-Contained Units

A fundamental principle of APP is that **a Case must be self-contained**.

A Case may depend on shared infrastructure from `core`, but it should not depend on other Cases for its primary behavior.

This provides several benefits:

- clear boundaries
- easier reasoning for humans
- predictable behavior for AI agents
- safer refactoring

Self-contained Cases reduce the cognitive load required to understand a system.

## Predictable Structure

APP defines a small set of **surfaces** that represent how a capability exists in the system.

Typical surfaces include:

- `domain`: semantic meaning and validation rules
- `api`: synchronous backend execution
- `ui`: user interface interaction
- `stream`: event-driven behavior
- `agentic`: AI interaction protocol

This predictable structure allows developers and AI agents to quickly locate the relevant part of a capability.

Consistency is more important than flexibility in this model.

## Low Context Cost

Large language models operate with limited context windows.

Architectures that scatter logic across many files and layers create a high **context cost**.

APP minimizes this cost by grouping related behavior inside a Case.

A typical capability should be understandable by reading a **small number of files**.

This property makes APP particularly suitable for **AI-assisted development**.

## Agent-Operable Systems

APP introduces the idea that software should not only be executable by machines and understandable by humans, but also **operable by agents**.

An agent-operable system exposes:

- discoverable capabilities
- explicit context requirements
- clear execution contracts
- guardrails and policies

The `agentic.case.ts` surface defines how a Case can be used by AI systems.

This makes it possible for agents to:

- discover capabilities
- reason about them
- invoke them safely
- compose them into workflows

## Humans and AI as Peers

APP assumes a future where humans and AI collaborate continuously.

Humans:

- design systems
- review decisions
- define policies
- guide evolution

AI agents:

- explore codebases
- generate implementations
- propose changes
- automate routine work

APP provides a structure where both actors can interact with the system in a predictable way.

## Incremental Adoption

APP does not require rewriting existing systems.

It can be adopted gradually:

1. New capabilities can be implemented as Cases.
2. Legacy systems can be integrated through adapters.
3. Agentic surfaces can be added progressively.

This allows organizations to experiment with APP without large migrations.

## Pragmatism Over Purity

APP is designed to be practical.

It does not attempt to enforce a rigid theoretical model.
Instead, it focuses on:

- clarity
- consistency
- evolvability
- real-world usability

If a rule makes the system harder to work with, it should be reconsidered.

The protocol should evolve with experience.

## The Long-Term Vision

The long-term vision of APP is to enable **software ecosystems that are naturally navigable by AI**.

In such systems:

- capabilities are explicit
- semantics are structured
- context is discoverable
- execution is predictable

APP aims to provide the architectural foundation for this new generation of software systems.

In short:

> APP is a programming protocol for building software that both humans and AI can understand, navigate, and evolve together.
