# ==========================================================================
# APP v1.1.4
# apps/backend/app.py
# --------------------------------------------------------------------------
# Backend host bootstrap.
#
# Responsibilities:
# - create the registry
# - materialize ctx.cases from the registry
# - create ApiContext per execution
# - collect routes from API surfaces
# - resolve incoming requests to the correct handler
# - serve HTTP via stdlib http.server
# ==========================================================================

from __future__ import annotations

import json
import re
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

from core.api_case import ApiContext, ApiResponse
from core.shared.app_base_context import AppLogger
from core.shared.app_structural_contracts import AppCaseError

from apps.backend.registry import BackendConfig, create_registry


# ==========================================================================
# Console logger
# ==========================================================================

class _ConsoleLogger:
    """Simple console logger implementing AppLogger."""

    def __init__(self, prefix: str = "[backend]") -> None:
        self._prefix = prefix

    def debug(self, message: str, meta: dict[str, Any] | None = None) -> None:
        pass  # Suppress debug in production-like output.

    def info(self, message: str, meta: dict[str, Any] | None = None) -> None:
        if meta:
            print(f"{self._prefix} {message}", meta)
        else:
            print(f"{self._prefix} {message}")

    def warn(self, message: str, meta: dict[str, Any] | None = None) -> None:
        if meta:
            print(f"{self._prefix} WARN: {message}", meta)
        else:
            print(f"{self._prefix} WARN: {message}")

    def error(self, message: str, meta: dict[str, Any] | None = None) -> None:
        if meta:
            print(f"{self._prefix} ERROR: {message}", meta)
        else:
            print(f"{self._prefix} ERROR: {message}")


# ==========================================================================
# Route definition
# ==========================================================================

@dataclass
class _Route:
    method: str
    pattern: str  # e.g. "/tasks/:taskId/status"
    regex: re.Pattern[str]
    param_names: list[str]
    handler_fn: Any  # Callable


from dataclasses import dataclass


def _compile_route(method: str, pattern: str, handler_fn: Any) -> _Route:
    """Compile a route pattern into a regex with named groups."""
    param_names: list[str] = []
    regex_str = "^"
    for segment in pattern.strip("/").split("/"):
        regex_str += "/"
        if segment.startswith(":"):
            name = segment[1:]
            param_names.append(name)
            regex_str += f"(?P<{name}>[^/]+)"
        else:
            regex_str += re.escape(segment)
    regex_str += "$"
    return _Route(
        method=method.upper(),
        pattern=pattern,
        regex=re.compile(regex_str),
        param_names=param_names,
        handler_fn=handler_fn,
    )


# ==========================================================================
# Bootstrap
# ==========================================================================

def bootstrap(config: BackendConfig | None = None) -> dict[str, Any]:
    """
    Bootstrap the backend host.

    Returns a dict with all host functions:
    - registry, create_api_context, materialize_cases
    - resolve_route, handle_request, start_backend
    """
    cfg = config or BackendConfig()
    registry = create_registry(cfg)
    logger = _ConsoleLogger()

    # ------------------------------------------------------------------
    # Context materialization
    # ------------------------------------------------------------------

    def create_api_context(
        parent: dict[str, Any] | None = None,
    ) -> ApiContext:
        """Create a fresh ApiContext for a single request."""
        correlation_id = (parent or {}).get("correlation_id", str(uuid.uuid4()))
        return ApiContext(
            correlation_id=correlation_id,
            execution_id=str(uuid.uuid4()),
            logger=logger,
            cases=materialize_cases(),
            packages=registry.get("_packages", {}),
            extra={"task_store": registry["_providers"]["task_store"]},
        )

    def materialize_cases(
        ctx_override: ApiContext | None = None,
    ) -> dict[str, Any]:
        """Instantiate API surfaces from the registry."""
        cases_map: dict[str, Any] = {}
        for domain_name, domain_cases in registry["_cases"].items():
            domain_map: dict[str, Any] = {}
            for case_name, surfaces in domain_cases.items():
                case_map: dict[str, Any] = {}
                api_cls = surfaces.get("api")
                if api_cls is not None:
                    # Lazy: create a new context per Case instantiation.
                    ctx = ctx_override or create_api_context()
                    case_map["api"] = api_cls(ctx)
                domain_map[case_name] = case_map
            cases_map[domain_name] = domain_map
        return cases_map

    # ------------------------------------------------------------------
    # Route collection
    # ------------------------------------------------------------------

    def collect_routes() -> list[_Route]:
        """Collect routes from all API surfaces."""
        routes: list[_Route] = []
        ctx = create_api_context()
        for _domain_name, domain_cases in registry["_cases"].items():
            for _case_name, surfaces in domain_cases.items():
                api_cls = surfaces.get("api")
                if api_cls is None:
                    continue
                instance = api_cls(ctx)
                route_def = instance.router()
                if route_def is not None and isinstance(route_def, dict):
                    handler_fn = route_def.get("handler", instance.handler)
                    routes.append(
                        _compile_route(
                            route_def["method"],
                            route_def["path"],
                            handler_fn,
                        )
                    )
        return routes

    routes = collect_routes()

    def resolve_route(
        method: str, path: str
    ) -> tuple[_Route, dict[str, str]] | None:
        """Match a method+path to a route and extract params."""
        for route in routes:
            if route.method != method.upper():
                continue
            m = route.regex.match(path)
            if m is not None:
                return route, m.groupdict()
        return None

    # ------------------------------------------------------------------
    # Request handling
    # ------------------------------------------------------------------

    def handle_request(
        method: str,
        path: str,
        body: str | None,
        headers: dict[str, str],
    ) -> tuple[int, dict[str, Any]]:
        """
        Handle an incoming HTTP request.

        Returns (status_code, response_body_dict).
        """
        # CORS preflight
        if method.upper() == "OPTIONS":
            return 204, {}

        # Health check
        if path == "/health":
            return 200, {"status": "ok"}

        # Manifest
        if path == "/manifest":
            case_names: list[str] = []
            for _dn, dc in registry["_cases"].items():
                case_names.extend(dc.keys())
            pkg_names = list(registry.get("_packages", {}).keys())
            return 200, {
                "app": "backend",
                "cases": case_names,
                "packages": pkg_names,
            }

        # Route dispatch
        match = resolve_route(method.upper(), path)
        if match is None:
            return 404, {
                "success": False,
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"No route for {method.upper()} {path}",
                },
            }

        route, params = match

        # Parse body
        input_data: Any = {}
        if body and body.strip():
            try:
                input_data = json.loads(body)
            except json.JSONDecodeError:
                return 400, {
                    "success": False,
                    "error": {
                        "code": "INVALID_JSON",
                        "message": "Request body is not valid JSON",
                    },
                }

        # Merge path params into input
        if params:
            if isinstance(input_data, dict):
                input_data = {**input_data, **params}
            else:
                input_data = params

        # Execute handler via the pre-built route.
        try:
            result = route.handler_fn(input_data)

            if isinstance(result, ApiResponse):
                status = result.status_code or (200 if result.success else 400)
                return status, result.to_dict()

            # If handler returns a raw dict, wrap it.
            if isinstance(result, dict):
                return 200, result
            return 200, {"success": True, "data": result}

        except AppCaseError as err:
            return 400, {
                "success": False,
                "error": err.to_app_error().to_dict(),
            }
        except Exception as err:
            logger.error(f"Unhandled error: {err}")
            return 500, {
                "success": False,
                "error": {
                    "code": "INTERNAL",
                    "message": "Internal server error",
                },
            }

    # ------------------------------------------------------------------
    # HTTP server
    # ------------------------------------------------------------------

    def start_backend(port_override: int | None = None) -> HTTPServer:
        """Start the backend HTTP server."""
        port = port_override or cfg.port

        host_ref = {"handle_request": handle_request}

        class Handler(BaseHTTPRequestHandler):
            def do_OPTIONS(self) -> None:
                self._handle("OPTIONS")

            def do_GET(self) -> None:
                self._handle("GET")

            def do_POST(self) -> None:
                self._handle("POST")

            def do_PATCH(self) -> None:
                self._handle("PATCH")

            def do_PUT(self) -> None:
                self._handle("PUT")

            def do_DELETE(self) -> None:
                self._handle("DELETE")

            def _handle(self, method: str) -> None:
                # Read body
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else None

                # Collect headers
                hdrs = {k.lower(): v for k, v in self.headers.items()}

                status, response = host_ref["handle_request"](
                    method, self.path, body, hdrs
                )

                # CORS headers
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Confirmation")
                if status == 204:
                    self.end_headers()
                    return
                self.end_headers()

                response_body = json.dumps(response, ensure_ascii=False)
                self.wfile.write(response_body.encode("utf-8"))

            def log_message(self, format: str, *args: Any) -> None:
                # Suppress default access log.
                pass

        server = HTTPServer(("", port), Handler)
        actual_port = server.server_address[1]
        logger.info("Backend scaffold started", {
            "port": actual_port,
            "packages": list(registry.get("_packages", {}).keys()),
        })
        server.serve_forever()
        return server

    # ------------------------------------------------------------------
    # Exported host interface
    # ------------------------------------------------------------------

    return {
        "registry": registry,
        "create_api_context": create_api_context,
        "materialize_cases": materialize_cases,
        "resolve_route": resolve_route,
        "handle_request": handle_request,
        "start_backend": start_backend,
        "routes": routes,
    }
