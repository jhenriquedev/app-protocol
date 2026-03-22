# ==========================================================================
# APP v1.1.4
# apps/agent/server.py
# --------------------------------------------------------------------------
# Agent host entry point (HTTP server).
#
# Usage:
#   python -m apps.agent.server
#
# Environment variables:
#   PORT or AGENT_PORT    — HTTP port (default: 3001)
#   APP_PYTHON_DATA_DIR   — data directory for JSON persistence
# ==========================================================================

from __future__ import annotations

import os

from apps.agent.app import bootstrap
from apps.agent.registry import AgentConfig


def main() -> None:
    """Start the agent server."""
    port = int(os.environ.get("PORT", os.environ.get("AGENT_PORT", "3001")))
    data_dir = os.environ.get("APP_PYTHON_DATA_DIR")

    config = AgentConfig(port=port, data_directory=data_dir)
    host = bootstrap(config)
    host["start_agent"]()


if __name__ == "__main__":
    main()
