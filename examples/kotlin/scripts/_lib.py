#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

EXAMPLE_ROOT = Path(__file__).resolve().parent.parent
GRADLEW = EXAMPLE_ROOT / "gradlew"
JAVA_MAIN_BACKEND = "app.protocol.examples.kotlin.apps.backend.ServerKt"
JAVA_MAIN_AGENT = "app.protocol.examples.kotlin.apps.agent.ServerKt"
JAVA_MAIN_AGENT_MCP = "app.protocol.examples.kotlin.apps.agent.Mcp_serverKt"

_CLASSPATH: str | None = None


def project_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    env = dict(os.environ)
    if extra:
        env.update(extra)
    return env


def jvm_classpath() -> str:
    global _CLASSPATH
    if _CLASSPATH is not None:
        return _CLASSPATH
    result = subprocess.run(
        [str(GRADLEW), "--no-daemon", "-q", "printJvmRuntimeClasspath"],
        cwd=EXAMPLE_ROOT,
        check=True,
        text=True,
        capture_output=True,
        env=project_env(),
    )
    _CLASSPATH = result.stdout.strip()
    if not _CLASSPATH:
        raise RuntimeError("empty JVM classpath from Gradle")
    return _CLASSPATH


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def start_java(
    main_class: str,
    *,
    env: dict[str, str] | None = None,
    stdin_pipe: bool = False,
    capture_output: bool = False,
) -> subprocess.Popen[str]:
    kwargs: dict[str, Any] = {
        "cwd": EXAMPLE_ROOT,
        "env": project_env(env),
        "text": True,
    }
    if stdin_pipe:
        kwargs["stdin"] = subprocess.PIPE
    else:
        kwargs["stdin"] = subprocess.DEVNULL
    if capture_output:
        kwargs["stdout"] = subprocess.PIPE
        kwargs["stderr"] = subprocess.PIPE
    else:
        log_file = tempfile.NamedTemporaryFile(prefix="app-kotlin-", suffix=".log", delete=False)
        kwargs["stdout"] = log_file
        kwargs["stderr"] = subprocess.STDOUT
    return subprocess.Popen(
        ["java", "-cp", jvm_classpath(), main_class],
        **kwargs,
    )


def wait_for_http(url: str, *, timeout_seconds: float = 20.0) -> None:
    deadline = time.time() + timeout_seconds
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.5) as response:
                if response.status < 500:
                    return
        except Exception as error:  # noqa: BLE001
            last_error = error
            time.sleep(0.2)
    raise RuntimeError(f"timed out waiting for {url}: {last_error}")


def request_json(
    method: str,
    url: str,
    *,
    body: Any | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, Any]:
    if body is None:
        payload = None
    elif isinstance(body, bytes):
        payload = body
    elif isinstance(body, str):
        payload = body.encode("utf-8")
    else:
        payload = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, method=method.upper(), data=payload)
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    if payload is not None and "content-type" not in {key.lower() for key, _ in request.header_items()}:
        request.add_header("content-type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8")
        return error.code, json.loads(raw) if raw else None


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def assert_equal(actual: Any, expected: Any, message: str) -> None:
    if actual != expected:
        raise AssertionError(f"{message}: expected {expected!r}, got {actual!r}")


def terminate_process(process: subprocess.Popen[str] | None) -> None:
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def print_ok(label: str) -> None:
    print(f"{label}: ok")


def run_smoke(main) -> None:
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(f"{Path(sys.argv[0]).stem}: {error}", file=sys.stderr)
        raise
