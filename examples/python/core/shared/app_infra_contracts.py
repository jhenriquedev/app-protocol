# ==========================================================================
# APP v1.1.6
# core/shared/app_infra_contracts.py
# --------------------------------------------------------------------------
# Minimal infrastructure contracts for per-surface contexts.
#
# These protocols define the minimum shape that APP recognizes
# for each infrastructure capability. They exist to:
# - provide type safety beyond Any
# - enable tooling, linting, and conformance checks
# - document the protocol's expectations for each capability
#
# Host projects may extend these protocols with richer contracts.
# APP only defines the minimum convergent operation for each capability.
#
# Eligibility criteria for inclusion:
# 1. The primary operation is convergent across implementations
# 2. The interface describes generic infrastructure, not domain logic
# 3. The capability name has stable, non-ambiguous meaning within APP
#
# Capabilities that do not yet meet all three criteria remain typed
# as Any in their respective surface contexts (e.g. auth, db, queue).
# ==========================================================================

from __future__ import annotations

from typing import Any, Protocol


# ==========================================================================
# AppHttpClient
# --------------------------------------------------------------------------
# Minimal outbound HTTP client contract.
#
# Covers: urllib.request, httpx, requests, aiohttp, and similar clients.
#
# This is explicitly a client (outbound) contract.
# Server/framework concerns are not modeled here.
# ==========================================================================

class AppHttpClient(Protocol):
    """Minimal outbound HTTP client contract."""

    def request(self, config: Any) -> Any:
        """
        Send an HTTP request.

        The config shape is host-defined (e.g. {"url", "method", "headers", "body"}).
        APP does not prescribe a specific request config format.
        """
        ...


# ==========================================================================
# AppStorageClient
# --------------------------------------------------------------------------
# Minimal persistent storage client contract.
#
# Covers: key-value stores, object storage (S3, GCS), and similar.
#
# Semantic distinction from AppCache:
# - AppStorageClient = durable persistence (survives restarts). No TTL.
# - AppCache = ephemeral data with optional TTL.
# ==========================================================================

class AppStorageClient(Protocol):
    """Minimal persistent storage client contract."""

    def get(self, key: str) -> Any:
        """Retrieve a persisted value by key. Returns None if not found."""
        ...

    def set(self, key: str, value: Any) -> None:
        """Persist a value by key (durable write)."""
        ...


# ==========================================================================
# AppCache
# --------------------------------------------------------------------------
# Minimal cache contract with optional TTL.
#
# Covers: Redis, Memcached, in-memory caches.
# TTL is in seconds. If not provided, the implementation decides the default.
# ==========================================================================

class AppCache(Protocol):
    """Minimal cache contract with optional TTL."""

    def get(self, key: str) -> Any:
        """Retrieve a cached value by key. Returns None if not found or expired."""
        ...

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Store a value in cache with optional TTL (in seconds)."""
        ...


# ==========================================================================
# AppEventPublisher
# --------------------------------------------------------------------------
# Minimal event publisher contract.
#
# Covers the publish side of event-driven communication.
# The subscribe/consume side is modeled by the stream surface
# (BaseStreamCase.subscribe()), not by this contract.
# ==========================================================================

class AppEventPublisher(Protocol):
    """Minimal event publisher contract."""

    def publish(self, event: str, payload: Any) -> None:
        """
        Publish an event to the event bus.

        The event string is the event type/topic.
        The payload shape is host-defined.
        """
        ...
