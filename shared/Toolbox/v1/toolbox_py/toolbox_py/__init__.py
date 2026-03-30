"""Toolbox — cross-cutting utilities for Elastic Resume Base Python services.

Mirrors the TypeScript ``@elastic-resume-base/toolbox`` package so that all
Python services share the same logging format and error vocabulary as the
Node.js services.

Quick start::

    from toolbox_py import setup_logging, get_logger

    setup_logging(level="INFO")
    logger = get_logger(__name__)
    logger.info("Service started")

Middleware::

    from toolbox_py import CorrelationIdMiddleware

    # In FastAPI application setup:
    app.add_middleware(CorrelationIdMiddleware)

Context accessors (usable anywhere in a request context)::

    from toolbox_py import get_correlation_id, get_trace_id, get_span_id

    correlation_id = get_correlation_id()

Error classes::

    from toolbox_py import NotFoundError, ValidationError

    raise NotFoundError("Resume abc-123 not found")
"""

from toolbox_py.config import load_config_yaml
from toolbox_py.api_types import (
    AddPreApprovedRequest,
    AuthorizeRequest,
    AuthorizeResponse,
    CreateUserRequest,
    DocumentReadOptions,
    DocumentReadRequest,
    DocumentReadResponse,
    GenerateRequest,
    GenerateResponse,
    IDocumentReaderClient,
    IDownloaderClient,
    IFileGeneratorClient,
    ISearchClient,
    IUsersApiClient,
    IngestRequest,
    IngestResponse,
    ListUsersResponse,
    PreApprovedFilters,
    PreApprovedSortField,
    PreApprovedUser,
    ResumeFormat,
    SearchRequest,
    SearchResponse,
    SearchResult,
    SortDirection,
    UpdatePreApprovedRequest,
    UpdateUserRequest,
    UserFilters,
    UserRecord,
    UserSortField,
)
from toolbox_py.errors import (
    AppError,
    ConflictError,
    DownstreamError,
    ForbiddenError,
    NotFoundError,
    RateLimitError,
    UnauthorizedError,
    UnavailableError,
    ValidationError,
    is_app_error,
)
from toolbox_py.logger import get_logger, setup_logging
from toolbox_py.middleware import (
    CorrelationIdMiddleware,
    get_correlation_id,
    get_span_id,
    get_trace_id,
)

__all__ = [
    # Config loading
    "load_config_yaml",
    # Logging
    "setup_logging",
    "get_logger",
    # Middleware
    "CorrelationIdMiddleware",
    "get_correlation_id",
    "get_trace_id",
    "get_span_id",
    # Error classes
    "AppError",
    "NotFoundError",
    "UnauthorizedError",
    "ValidationError",
    "ConflictError",
    "ForbiddenError",
    "DownstreamError",
    "UnavailableError",
    "RateLimitError",
    "is_app_error",
    # API types — Users API
    "UserRecord",
    "PreApprovedUser",
    "AuthorizeRequest",
    "AuthorizeResponse",
    "CreateUserRequest",
    "UpdateUserRequest",
    "AddPreApprovedRequest",
    "UpdatePreApprovedRequest",
    "ListUsersResponse",
    "SortDirection",
    "UserSortField",
    "PreApprovedSortField",
    "UserFilters",
    "PreApprovedFilters",
    # API types — Downloader service
    "IngestRequest",
    "IngestResponse",
    # API types — Search service
    "SearchRequest",
    "SearchResult",
    "SearchResponse",
    # API types — File generator service
    "ResumeFormat",
    "GenerateRequest",
    "GenerateResponse",
    # API types — Document reader service
    "DocumentReadOptions",
    "DocumentReadRequest",
    "DocumentReadResponse",
    # Service client Protocols
    "IUsersApiClient",
    "ISearchClient",
    "IDocumentReaderClient",
    "IDownloaderClient",
    "IFileGeneratorClient",
]
