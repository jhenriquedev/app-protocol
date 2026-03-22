# ==========================================================================
# APP v1.1.4
# apps/agent/mcp_server.py
# --------------------------------------------------------------------------
# MCP stdio entry point.
#
# Redirects all print/logging to stderr to keep stdout clean for
# JSON-RPC MCP protocol messages.
#
# Usage:
#   python -m apps.agent.mcp_server
#
# Environment variables:
#   APP_PYTHON_DATA_DIR — data directory for JSON persistence
# ==========================================================================

from __future__ import annotations

import os
import sys

# Redirect stdout-based logging to stderr before any imports that might print.
_original_stdout = sys.stdout
sys.stdout = sys.stderr


def main() -> None:
    """Start the MCP stdio server."""
    # Restore stdout for MCP protocol output.
    sys.stdout = _original_stdout

    data_dir = os.environ.get("APP_PYTHON_DATA_DIR")

    from apps.agent.app import bootstrap
    from apps.agent.registry import AgentConfig

    config = AgentConfig(data_directory=data_dir)
    host = bootstrap(config)
    host["publish_mcp"]()


if __name__ == "__main__":
    main()
