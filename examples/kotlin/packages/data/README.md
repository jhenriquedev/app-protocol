# Data Package

This package owns the local persistence strategy for the Kotlin example.

Included contents target:

- `tasks.json` as the durable task store
- file read and write helpers
- a generic JSON store factory used by backend and agent hosts

Rules:

- Cases do not read files directly
- hosts expose this package through `_packages`
- persistence details stay outside `core/` and outside the Cases
