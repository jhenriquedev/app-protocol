# APP v1.1.0 — packages/data/
# Data persistence package.

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from packages.data.json_file_store import JsonFileStore, create_json_file_store


@dataclass
class DataPackage:
    """Data package exposing file paths and store factory."""

    default_files: dict[str, str]

    def create_json_file_store(
        self, file_path: str, fallback_data: Any
    ) -> JsonFileStore[Any]:
        """Create a JsonFileStore for the given path."""
        return create_json_file_store(file_path, fallback_data)


def create_data_package(base_directory: str | None = None) -> DataPackage:
    """
    Create a DataPackage with default file paths.

    If no base_directory is provided, uses the current working directory.
    """
    base = base_directory or os.getcwd()
    tasks_path = os.path.join(base, "tasks.json")

    return DataPackage(default_files={"tasks": tasks_path})


__all__ = [
    "DataPackage",
    "JsonFileStore",
    "create_data_package",
    "create_json_file_store",
]
