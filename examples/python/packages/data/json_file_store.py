# ==========================================================================
# APP v1.1.5
# packages/data/json_file_store.py
# --------------------------------------------------------------------------
# Thread-safe, file-locked JSON store for local persistence.
#
# Features:
# - In-process serialization via threading.Lock
# - File-based lock via fcntl.flock for cross-process safety
# - Atomic writes via temp file + os.rename
# - Stale lock cleanup (30s timeout)
# - read(), write(), reset(), update() operations
#
# This is a shared package — exposed to Cases via ctx.packages,
# never imported directly by Cases.
# ==========================================================================

from __future__ import annotations

import fcntl
import json
import os
import tempfile
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Generic, TypeVar

T = TypeVar("T")

_LOCK_TIMEOUT_S = 5.0
_LOCK_RETRY_MS = 25
_STALE_LOCK_S = 30.0


@dataclass
class JsonFileStoreOptions(Generic[T]):
    """Options for creating a JsonFileStore."""
    file_path: str
    fallback_data: T


class JsonFileStore(Generic[T]):
    """
    Thread-safe, file-locked JSON file store.

    Provides serialized access to a JSON file with:
    - in-process threading.Lock for same-process concurrency
    - fcntl.flock for cross-process concurrency
    - atomic writes via temp file + os.rename
    """

    def __init__(self, options: JsonFileStoreOptions[T]) -> None:
        self._file_path = options.file_path
        self._fallback_data = options.fallback_data
        self._lock = threading.Lock()
        self._ensure_file_exists()

    @property
    def file_path(self) -> str:
        """Return the path to the underlying JSON file."""
        return self._file_path

    def read(self) -> T:
        """Read and return the current data from the file."""
        with self._lock:
            return self._locked_read()

    def write(self, data: T) -> None:
        """Overwrite the file with new data."""
        with self._lock:
            self._locked_write(data)

    def reset(self) -> None:
        """Reset the file to its fallback data."""
        with self._lock:
            self._locked_write(self._fallback_data)

    def update(self, updater: Callable[[T], T]) -> T:
        """
        Atomically read, transform, and write data.

        The updater function receives the current data and must return
        the new data. The entire operation is serialized.
        """
        with self._lock:
            current = self._locked_read()
            updated = updater(current)
            self._locked_write(updated)
            return updated

    # ==================================================================
    # Internal file operations (must be called under self._lock)
    # ==================================================================

    def _locked_read(self) -> T:
        """Read the file contents. Caller must hold self._lock."""
        lock_fd = self._acquire_file_lock()
        try:
            with open(self._file_path, "r", encoding="utf-8") as f:
                content = f.read()
            if not content.strip():
                return self._fallback_data
            return json.loads(content)  # type: ignore[no-any-return]
        except (json.JSONDecodeError, FileNotFoundError):
            return self._fallback_data
        finally:
            self._release_file_lock(lock_fd)

    def _locked_write(self, data: T) -> None:
        """Write data atomically. Caller must hold self._lock."""
        lock_fd = self._acquire_file_lock()
        try:
            dir_name = os.path.dirname(self._file_path) or "."
            fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                os.rename(tmp_path, self._file_path)
            except BaseException:
                # Clean up temp file on failure.
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                raise
        finally:
            self._release_file_lock(lock_fd)

    # ==================================================================
    # File locking via fcntl.flock
    # ==================================================================

    def _acquire_file_lock(self) -> int:
        """
        Acquire an exclusive file lock with timeout and stale lock cleanup.

        Returns the lock file descriptor.
        """
        lock_path = self._file_path + ".lock"
        deadline = time.monotonic() + _LOCK_TIMEOUT_S

        while True:
            try:
                # Try to clean up stale locks.
                self._cleanup_stale_lock(lock_path)

                fd = os.open(lock_path, os.O_CREAT | os.O_WRONLY)
                try:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    return fd
                except (OSError, BlockingIOError):
                    os.close(fd)
            except OSError:
                pass

            if time.monotonic() >= deadline:
                raise TimeoutError(
                    f"JsonFileStore: could not acquire lock for {self._file_path} "
                    f"within {_LOCK_TIMEOUT_S}s"
                )

            time.sleep(_LOCK_RETRY_MS / 1000.0)

    def _release_file_lock(self, fd: int) -> None:
        """Release the file lock and close the descriptor."""
        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        finally:
            try:
                os.close(fd)
            except OSError:
                pass

    def _cleanup_stale_lock(self, lock_path: str) -> None:
        """Remove a lock file if it is older than the stale threshold."""
        try:
            stat = os.stat(lock_path)
            age = time.time() - stat.st_mtime
            if age > _STALE_LOCK_S:
                os.unlink(lock_path)
        except OSError:
            pass

    # ==================================================================
    # Initialization
    # ==================================================================

    def _ensure_file_exists(self) -> None:
        """Create the file with fallback data if it does not exist."""
        dir_name = os.path.dirname(self._file_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)

        if not os.path.exists(self._file_path):
            with open(self._file_path, "w", encoding="utf-8") as f:
                json.dump(self._fallback_data, f, indent=2, ensure_ascii=False)


def create_json_file_store(file_path: str, fallback_data: T) -> JsonFileStore[T]:
    """Factory function to create a JsonFileStore."""
    return JsonFileStore(JsonFileStoreOptions(file_path=file_path, fallback_data=fallback_data))
