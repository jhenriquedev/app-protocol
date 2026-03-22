# ==========================================================================
# APP v1.1.4
# core/ui_case.py
# --------------------------------------------------------------------------
# Base contract for the UI surface in APP.
#
# Represents the interface surface of the capability.
#
# Responsibility:
# - present interface to the user
# - manage local state via viewmodel
# - access data via repository
# - execute local business logic via service
#
# Canonical grammar:
#   view <-> _viewmodel <-> _service <-> _repository
#
# The view is a live, self-contained visual unit: a form, a table with
# filters, a sidebar, an appbar.
#
# Framework lifecycle (render, mount, dismount, etc.) lives inside view
# as an implementation detail — the protocol does not dictate lifecycle hooks.
#
# Framework-agnostic. In this Python example, tkinter is used.
#
# Context:
# - UiContext extends AppBaseContext with frontend infrastructure
# - each project defines the concrete types for renderer, router, store, etc.
# ==========================================================================

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, TypeVar

from core.shared.app_base_context import AppBaseContext
from core.shared.app_infra_contracts import AppHttpClient

TState = TypeVar("TState", bound=dict[str, Any])


# ==========================================================================
# UiContext
# --------------------------------------------------------------------------
# Context specific to the UI surface.
#
# Extends AppBaseContext with frontend infrastructure:
# - renderer: framework renderer (tkinter Tk root, React root, etc.)
# - router: client-side router
# - store: global or shared state
# - api: HTTP client for backend calls
# - packages: library packages from the host
# ==========================================================================

class UiContext(AppBaseContext, total=False):
    """Context for the UI surface."""

    # Framework renderer (e.g. tkinter Tk root, React root).
    renderer: Any

    # Client-side router.
    router: Any

    # Global or shared state store.
    store: Any

    # HTTP client for backend calls.
    api: AppHttpClient

    # Library packages registered by the host.
    packages: dict[str, Any]

    # Free extension space for the host.
    extra: dict[str, Any]


# ==========================================================================
# BaseUiCase
# --------------------------------------------------------------------------
# Base class for UI surfaces.
#
# Canonical grammar:
#   view <-> _viewmodel <-> _service <-> _repository
#
# - view(): public entrypoint — the live visual unit (form, table,
#   sidebar, appbar, widget). Framework lifecycle is an implementation
#   detail internal to view.
#
# - _viewmodel(): transforms state and data into a presentation model
#   for the view to consume.
#
# - _service(): local business logic (state behavior, client-side
#   validations, local data transformations).
#
# - _repository(): data access — API calls, local storage, cache reads.
#
# Note on _composition:
# ui_case.py does not include _composition. Direct cross-case
# orchestration from the UI is discouraged in APP.
# ==========================================================================

class BaseUiCase(ABC):
    """Base class for UI surfaces in APP."""

    def __init__(self, ctx: UiContext, initial_state: dict[str, Any] | None = None) -> None:
        self.ctx = ctx
        self.state: dict[str, Any] = initial_state if initial_state is not None else {}

    # ==================================================================
    # Required methods
    # ==================================================================

    @abstractmethod
    def view(self) -> Any:
        """
        Public entrypoint of the visual unit.

        The view is the live, self-contained visual unit of the Case.
        Examples: registration form, table with filters, sidebar, appbar.

        Can return:
        - tkinter Frame/Widget
        - HTML string
        - Virtual DOM
        - Any format supported by the host/framework

        Framework lifecycle lives inside view as an implementation detail.
        """
        ...

    def test(self) -> None:
        """
        Self-contained UI surface test.

        Canonical signature: test() -> None
        """

    # ==================================================================
    # Canonical internal slots
    # ==================================================================

    def _viewmodel(self, *args: Any, **kwargs: Any) -> Any:
        """
        Viewmodel — transforms state and data into a presentation model.

        Separates data preparation from rendering.
        The view consumes the viewmodel result.
        """
        return None

    def _service(self, *args: Any, **kwargs: Any) -> Any:
        """
        Local business logic.

        State behavior, client-side validations,
        local data transformations, user actions.
        """
        return None

    def _repository(self, *args: Any, **kwargs: Any) -> Any:
        """
        Data access and local persistence.

        API calls, local storage, cache reads,
        and any data integration.

        Rule: _repository does not perform cross-case composition.
        """
        return None

    # ==================================================================
    # Internal utility
    # ==================================================================

    def set_state(self, partial: dict[str, Any]) -> None:
        """Update the internal state with a partial dict."""
        self.state = {**self.state, **partial}
