# ==========================================================================
# APP v1.1.3
# apps/portal/registry.py
# --------------------------------------------------------------------------
# Portal host registry.
#
# Selects only UI surfaces and the design_system package.
# HTTP client adapter wraps urllib.request for backend API calls.
# ==========================================================================

from __future__ import annotations

import json
import urllib.request
import urllib.error
from dataclasses import dataclass
from typing import Any

from packages.design_system import DesignSystem

# Case imports — available once cases/ is implemented.
from cases.tasks.task_create.task_create_ui_case import TaskCreateUi
from cases.tasks.task_list.task_list_ui_case import TaskListUi
from cases.tasks.task_move.task_move_ui_case import TaskMoveUi


# ==========================================================================
# FetchHttpAdapter
# --------------------------------------------------------------------------
# Wraps urllib.request to satisfy the AppHttpClient protocol.
# Unwraps {success, data} envelope and raises on failure.
# ==========================================================================

class FetchHttpAdapter:
    """HTTP client adapter using urllib.request."""

    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    def request(self, config: Any) -> Any:
        """
        Send an HTTP request.

        Config shape: {"method": str, "path": str, "body": Any}
        Returns the unwrapped response data on success.
        Raises on failure.
        """
        method: str = config.get("method", "GET").upper()
        path: str = config.get("path", "/")
        body: Any = config.get("body")

        url = f"{self._base_url}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None

        req = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={"Content-Type": "application/json"},
        )

        try:
            with urllib.request.urlopen(req) as resp:
                response_body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            response_body = json.loads(e.read().decode("utf-8"))

        # Unwrap envelope
        if isinstance(response_body, dict):
            if response_body.get("success") is False:
                error = response_body.get("error", {})
                raise RuntimeError(
                    f"API error: {error.get('code', 'UNKNOWN')} — {error.get('message', '')}"
                )
            if "data" in response_body:
                return response_body["data"]

        return response_body


# ==========================================================================
# Registry
# ==========================================================================

@dataclass
class PortalConfig:
    """Configuration for the portal host."""
    api_base_url: str = "http://localhost:3000"


def create_registry(config: PortalConfig) -> dict[str, Any]:
    """
    Create the portal registry with _cases, _providers, and _packages.
    """
    http_client = FetchHttpAdapter(config.api_base_url)

    return {
        "_cases": {
            "tasks": {
                "task_create": {"ui": TaskCreateUi},
                "task_list": {"ui": TaskListUi},
                "task_move": {"ui": TaskMoveUi},
            },
        },
        "_providers": {
            "http_client": http_client,
        },
        "_packages": {
            "design_system": DesignSystem,
        },
    }
