# ==========================================================================
# APP v1.1.4
# apps/portal/main.py
# --------------------------------------------------------------------------
# Portal host entry point.
#
# Launches the tkinter desktop application.
# Requires the backend to be running for API calls.
#
# Usage:
#   python -m apps.portal.main
#
# Environment variables:
#   API_BASE_URL — backend URL (default: http://localhost:3000)
# ==========================================================================

from __future__ import annotations

import os
import tkinter as tk

from apps.portal.app import bootstrap
from apps.portal.registry import PortalConfig


def main() -> None:
    """Launch the portal tkinter application."""
    api_base_url = os.environ.get("API_BASE_URL", "http://localhost:3000")

    config = PortalConfig(api_base_url=api_base_url)
    host = bootstrap(config)

    root = tk.Tk()
    root.title("APP Task Board — Python Example")
    root.geometry("960x640")
    root.minsize(640, 400)

    host["render_root"](root)

    print("[portal] Portal started", {"api": api_base_url})
    root.mainloop()


if __name__ == "__main__":
    main()
