# ==========================================================================
# APP v1.1.3
# __main__.py
# --------------------------------------------------------------------------
# Test runner that collects and executes all inline test() methods
# from surfaces and host validate_runtime() methods.
#
# Usage:
#   cd examples/python
#   python __main__.py
# ==========================================================================

from __future__ import annotations

import sys
import traceback
from typing import Any


def _run_test(label: str, fn: Any) -> bool:
    """Run a single test function and report result."""
    try:
        fn()
        print(f"  ok   {label}")
        return True
    except Exception as e:
        print(f"  FAIL {label}: {e}")
        traceback.print_exc(file=sys.stdout)
        return False


def main() -> int:
    """Run all tests and return exit code."""
    print("APP Python Example — Test Runner\n")
    passed = 0
    failed = 0

    # ------------------------------------------------------------------
    # Domain surfaces
    # ------------------------------------------------------------------
    print("Domain surfaces:")
    from cases.tasks.task_create.task_create_domain_case import TaskCreateDomain
    from cases.tasks.task_list.task_list_domain_case import TaskListDomain
    from cases.tasks.task_move.task_move_domain_case import TaskMoveDomain

    for cls in [TaskCreateDomain, TaskListDomain, TaskMoveDomain]:
        instance = cls()
        ok = _run_test(f"{cls.__name__}.test()", instance.test)
        passed += ok
        failed += not ok

    # ------------------------------------------------------------------
    # API surfaces
    # ------------------------------------------------------------------
    print("\nAPI surfaces:")
    import uuid
    import tempfile
    import os

    from core.api_case import ApiContext
    from packages.data import create_json_file_store

    tmp_dir = tempfile.mkdtemp(prefix="app_test_")
    store = create_json_file_store(os.path.join(tmp_dir, "tasks.json"), fallback_data=[])

    class _TestLogger:
        def debug(self, message: str, meta: dict[str, Any] | None = None) -> None: pass
        def info(self, message: str, meta: dict[str, Any] | None = None) -> None: pass
        def warn(self, message: str, meta: dict[str, Any] | None = None) -> None: pass
        def error(self, message: str, meta: dict[str, Any] | None = None) -> None: pass

    def make_api_ctx() -> ApiContext:
        return ApiContext(
            correlation_id=str(uuid.uuid4()),
            execution_id=str(uuid.uuid4()),
            logger=_TestLogger(),
            extra={"task_store": store},
        )

    from cases.tasks.task_create.task_create_api_case import TaskCreateApi
    from cases.tasks.task_list.task_list_api_case import TaskListApi
    from cases.tasks.task_move.task_move_api_case import TaskMoveApi

    for cls in [TaskCreateApi, TaskListApi, TaskMoveApi]:  # type: ignore[assignment]
        ctx = make_api_ctx()
        instance = cls(ctx)
        ok = _run_test(f"{cls.__name__}.test()", instance.test)
        passed += ok
        failed += not ok

    # Reset store between surface tests
    store.reset()

    # ------------------------------------------------------------------
    # UI surfaces (structural tests — no display required)
    # ------------------------------------------------------------------
    print("\nUI surfaces:")
    from core.ui_case import UiContext
    from cases.tasks.task_create.task_create_ui_case import TaskCreateUi
    from cases.tasks.task_list.task_list_ui_case import TaskListUi
    from cases.tasks.task_move.task_move_ui_case import TaskMoveUi

    def make_ui_ctx(extra: dict[str, Any] | None = None) -> UiContext:
        return UiContext(
            correlation_id=str(uuid.uuid4()),
            execution_id=str(uuid.uuid4()),
            logger=_TestLogger(),
            extra=extra or {},
        )

    for ui_cls in [TaskCreateUi, TaskListUi, TaskMoveUi]:  # type: ignore[assignment]
        ctx = make_ui_ctx()
        instance = ui_cls(ctx)
        ok = _run_test(f"{ui_cls.__name__}.test()", instance.test)
        passed += ok
        failed += not ok

    # ------------------------------------------------------------------
    # Agentic surfaces
    # ------------------------------------------------------------------
    print("\nAgentic surfaces:")
    from core.agentic_case import AgenticContext
    from cases.tasks.task_create.task_create_agentic_case import TaskCreateAgentic
    from cases.tasks.task_list.task_list_agentic_case import TaskListAgentic
    from cases.tasks.task_move.task_move_agentic_case import TaskMoveAgentic

    def make_agentic_ctx() -> AgenticContext:
        # Build a cases map with api instances for tool delegation
        api_ctx = make_api_ctx()
        cases_map = {
            "tasks": {
                "task_create": {"api": TaskCreateApi(api_ctx)},
                "task_list": {"api": TaskListApi(api_ctx)},
                "task_move": {"api": TaskMoveApi(api_ctx)},
            }
        }
        return AgenticContext(
            correlation_id=str(uuid.uuid4()),
            execution_id=str(uuid.uuid4()),
            logger=_TestLogger(),
            cases=cases_map,
        )

    for cls in [TaskCreateAgentic, TaskListAgentic, TaskMoveAgentic]:  # type: ignore[assignment]
        ctx = make_agentic_ctx()
        instance = cls(ctx)
        ok = _run_test(f"{cls.__name__}.test()", instance.test)
        passed += ok
        failed += not ok

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------
    import shutil
    shutil.rmtree(tmp_dir, ignore_errors=True)

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    total = passed + failed
    print(f"\n{'=' * 40}")
    print(f"Results: {passed}/{total} passed", end="")
    if failed:
        print(f", {failed} FAILED")
    else:
        print(" — all ok")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
