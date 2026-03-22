# ==========================================================================
# APP v1.1.5
# core/shared/app_mcp_contracts.py
# --------------------------------------------------------------------------
# Protocol-level MCP contracts for APP agent hosts.
#
# These contracts define the structural boundary between an agent host
# runtime and one or more concrete MCP transport adapters. They
# intentionally stay transport-agnostic:
# - the host owns catalog, policy, and canonical execution delegation
# - the provider owns framing, lifecycle wiring, and transport mechanics
#
# Concrete MCP implementations belong in registry._providers.
# When a host exposes multiple transports, it should bind them explicitly
# as named providers such as _providers["mcp_adapters"]["stdio"] and
# _providers["mcp_adapters"]["http"].
# ==========================================================================

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, TypedDict


# ==========================================================================
# MCP data types
# ==========================================================================

class AppMcpClientInfo(TypedDict):
    """MCP client identification."""
    name: str
    version: str


class AppMcpServerInfo(TypedDict, total=False):
    """MCP server identification."""
    name: str  # type: ignore[reportGeneralTypeIssues]
    version: str  # type: ignore[reportGeneralTypeIssues]
    protocol_version: str  # type: ignore[reportGeneralTypeIssues]
    instructions: str


class AppMcpInitializeParams(TypedDict, total=False):
    """Parameters for MCP initialize request."""
    protocol_version: str  # type: ignore[reportGeneralTypeIssues]
    capabilities: dict[str, Any]
    client_info: AppMcpClientInfo


class AppMcpInitializeResult(TypedDict):
    """Result of MCP initialize request."""
    protocol_version: str
    capabilities: dict[str, Any]
    server_info: dict[str, str]
    instructions: str


class AppMcpTextContent(TypedDict):
    """MCP text content block."""
    type: str  # "text"
    text: str


class AppMcpToolDescriptor(TypedDict, total=False):
    """MCP tool descriptor for tools/list response."""
    name: str  # type: ignore[reportGeneralTypeIssues]
    title: str
    description: str
    input_schema: dict[str, Any]  # type: ignore[reportGeneralTypeIssues]
    output_schema: dict[str, Any]
    annotations: dict[str, Any]


class AppMcpResourceDescriptor(TypedDict, total=False):
    """MCP resource descriptor for resources/list response."""
    uri: str  # type: ignore[reportGeneralTypeIssues]
    name: str  # type: ignore[reportGeneralTypeIssues]
    title: str
    description: str
    mime_type: str
    annotations: dict[str, Any]


class AppMcpTextResourceContent(TypedDict, total=False):
    """MCP text resource content for resources/read response."""
    uri: str  # type: ignore[reportGeneralTypeIssues]
    mime_type: str
    text: str  # type: ignore[reportGeneralTypeIssues]


class AppMcpCallResult(TypedDict, total=False):
    """Result of MCP tools/call."""
    content: list[AppMcpTextContent]  # type: ignore[reportGeneralTypeIssues]
    structured_content: Any
    is_error: bool


class AppMcpReadResourceResult(TypedDict):
    """Result of MCP resources/read."""
    contents: list[AppMcpTextResourceContent]


class AppMcpRequestContext(TypedDict, total=False):
    """Context passed to MCP server methods."""
    transport: str
    request_id: str | int | None
    session_id: str
    correlation_id: str
    client_info: AppMcpClientInfo
    protocol_version: str


# ==========================================================================
# AppMcpServer
# --------------------------------------------------------------------------
# Server interface that adapters call into. The host implements this.
# ==========================================================================

class AppMcpServer(ABC):
    """Abstract MCP server interface. Implemented by the agent host."""

    @abstractmethod
    def server_info(self) -> AppMcpServerInfo:
        """Return server identification metadata."""
        ...

    @abstractmethod
    def initialize(
        self,
        params: AppMcpInitializeParams | None = None,
        parent: AppMcpRequestContext | None = None,
    ) -> AppMcpInitializeResult:
        """Handle MCP initialize request."""
        ...

    @abstractmethod
    def list_tools(
        self, parent: AppMcpRequestContext | None = None
    ) -> list[AppMcpToolDescriptor]:
        """Handle MCP tools/list request."""
        ...

    @abstractmethod
    def list_resources(
        self, parent: AppMcpRequestContext | None = None
    ) -> list[AppMcpResourceDescriptor]:
        """Handle MCP resources/list request."""
        ...

    @abstractmethod
    def read_resource(
        self,
        uri: str,
        parent: AppMcpRequestContext | None = None,
    ) -> AppMcpReadResourceResult:
        """Handle MCP resources/read request."""
        ...

    @abstractmethod
    def call_tool(
        self,
        name: str,
        args: Any,
        parent: AppMcpRequestContext | None = None,
    ) -> AppMcpCallResult:
        """Handle MCP tools/call request."""
        ...


# ==========================================================================
# Base MCP adapters
# --------------------------------------------------------------------------
# Abstract adapters that concrete transport implementations extend.
#
# - BaseAppMcpProcessAdapter: for process-based transports (stdio)
# - BaseAppMcpHttpAdapter: for HTTP-based transports (streamable-http)
# ==========================================================================

class BaseAppMcpAdapter(ABC):
    """Base class for MCP transport adapters."""

    @property
    @abstractmethod
    def transport(self) -> str:
        """Transport identifier (e.g. 'stdio', 'streamable-http')."""
        ...


class BaseAppMcpProcessAdapter(BaseAppMcpAdapter):
    """Base class for process-based MCP adapters (e.g. stdio)."""

    @abstractmethod
    def serve(self, server: AppMcpServer) -> None:
        """Start serving MCP requests from the process transport."""
        ...


@dataclass
class AppMcpHttpExchange:
    """Represents an incoming HTTP exchange for MCP."""
    method: str
    path: str
    headers: dict[str, str | None]
    body_text: str | None = None


@dataclass
class AppMcpHttpResponse:
    """HTTP response from an MCP adapter."""
    status_code: int
    headers: dict[str, str] = field(default_factory=dict)
    body_text: str | None = None


class BaseAppMcpHttpAdapter(BaseAppMcpAdapter):
    """Base class for HTTP-based MCP adapters (e.g. streamable-http)."""

    @property
    @abstractmethod
    def endpoint_path(self) -> str:
        """The HTTP endpoint path this adapter handles (e.g. '/mcp')."""
        ...

    @abstractmethod
    def handle(
        self,
        exchange: AppMcpHttpExchange,
        server: AppMcpServer,
    ) -> AppMcpHttpResponse | None:
        """Handle an incoming HTTP exchange. Returns response or None."""
        ...


# ==========================================================================
# AppMcpProtocolError
# --------------------------------------------------------------------------
# Error class for MCP protocol-level errors (invalid version, etc.).
# ==========================================================================

class AppMcpProtocolError(Exception):
    """MCP protocol-level error with numeric code."""

    def __init__(self, code: int, message: str, data: Any = None) -> None:
        super().__init__(message)
        self.code = code
        self.data = data
