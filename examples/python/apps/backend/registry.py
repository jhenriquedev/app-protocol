# ==========================================================================
# APP v1.1.6
# apps/backend/registry.py
# --------------------------------------------------------------------------
# Backend host registry.
#
# Selects only the Cases, providers, and packages that the backend needs.
# Exposes API surfaces for task_create, task_list, task_move.
# ==========================================================================

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from packages.data import create_data_package, create_json_file_store

# Case imports — these will be available once cases/ is implemented.
from cases.tasks.task_create.task_create_api_case import TaskCreateApi
from cases.tasks.task_list.task_list_api_case import TaskListApi
from cases.tasks.task_move.task_move_api_case import TaskMoveApi


@dataclass
class BackendConfig:
    """Configuration for the backend host."""
    port: int = 3000
    data_directory: str | None = None


def create_registry(config: BackendConfig) -> dict[str, Any]:
    """
    Create the backend registry with _cases, _providers, and _packages.

    The registry selects only the Cases and packages the backend needs.
    """
    data_pkg = create_data_package(config.data_directory)
    task_store = create_json_file_store(
        data_pkg.default_files["tasks"], fallback_data=[]
    )

    return {
        "_cases": {
            "tasks": {
                "task_create": {"api": TaskCreateApi},
                "task_list": {"api": TaskListApi},
                "task_move": {"api": TaskMoveApi},
            },
        },
        "_providers": {
            "port": config.port,
            "task_store": task_store,
        },
        "_packages": {
            "data": data_pkg,
        },
    }
