# Data Package

This package owns the local persistence strategy for the Angular + Node example.

Included contents:

- `tasks.json` as the durable task store
- file read and write helpers
- generic JSON store factory used by the backend host

Rules:

- Cases do not read files directly
- the backend host exposes this package through `_packages`
- persistence details stay outside `core/` and outside the Cases
