# APP v1.1.1 — core/shared/
# Re-exports for shared contracts.

from core.shared.app_base_context import AppBaseContext, AppLogger
from core.shared.app_host_contracts import (
    AgenticCaseRef,
    AgenticCatalogEntry,
    AgenticRegistry,
    AppCaseSurfaces,
    AppRegistry,
)
from core.shared.app_infra_contracts import (
    AppCache,
    AppEventPublisher,
    AppHttpClient,
    AppStorageClient,
)
from core.shared.app_mcp_contracts import (
    AppMcpCallResult,
    AppMcpHttpExchange,
    AppMcpHttpResponse,
    AppMcpInitializeParams,
    AppMcpInitializeResult,
    AppMcpProtocolError,
    AppMcpRequestContext,
    AppMcpResourceDescriptor,
    AppMcpServer,
    AppMcpServerInfo,
    AppMcpToolDescriptor,
    BaseAppMcpAdapter,
    BaseAppMcpHttpAdapter,
    BaseAppMcpProcessAdapter,
)
from core.shared.app_structural_contracts import (
    AppCaseError,
    AppError,
    AppPaginatedResult,
    AppPaginationParams,
    AppResult,
    StreamFailureEnvelope,
    to_app_case_error,
)

__all__ = [
    "AppBaseContext",
    "AppLogger",
    "AppCache",
    "AppCaseError",
    "AppCaseSurfaces",
    "AppError",
    "AppEventPublisher",
    "AppHttpClient",
    "AppMcpCallResult",
    "AppMcpHttpExchange",
    "AppMcpHttpResponse",
    "AppMcpInitializeParams",
    "AppMcpInitializeResult",
    "AppMcpProtocolError",
    "AppMcpRequestContext",
    "AppMcpResourceDescriptor",
    "AppMcpServer",
    "AppMcpServerInfo",
    "AppMcpToolDescriptor",
    "AppPaginatedResult",
    "AppPaginationParams",
    "AppRegistry",
    "AppResult",
    "AppStorageClient",
    "AgenticCaseRef",
    "AgenticCatalogEntry",
    "AgenticRegistry",
    "BaseAppMcpAdapter",
    "BaseAppMcpHttpAdapter",
    "BaseAppMcpProcessAdapter",
    "StreamFailureEnvelope",
    "to_app_case_error",
]
