# ==========================================================================
# APP v1.1.4
# apps/backend/server.py
# --------------------------------------------------------------------------
# Backend host entry point.
#
# Reads configuration from environment variables and starts the HTTP server.
#
# Usage:
#   python -m apps.backend.server
#
# Environment variables:
#   PORT or API_PORT  — HTTP port (default: 3000)
#   APP_PYTHON_DATA_DIR — data directory for JSON persistence
# ==========================================================================

from __future__ import annotations

import os

from apps.backend.app import bootstrap
from apps.backend.registry import BackendConfig


def main() -> None:
    """Start the backend server."""
    port = int(os.environ.get("PORT", os.environ.get("API_PORT", "3000")))
    data_dir = os.environ.get("APP_PYTHON_DATA_DIR")

    config = BackendConfig(port=port, data_directory=data_dir)
    host = bootstrap(config)
    host["start_backend"]()


if __name__ == "__main__":
    main()
