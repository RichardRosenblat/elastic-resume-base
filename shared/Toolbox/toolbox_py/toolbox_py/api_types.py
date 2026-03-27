"""Centralized API request and response type definitions for Elastic Resume Base.

These types mirror the TypeScript definitions in
``shared/Toolbox/toolbox_ts/src/api-types.ts`` and define the canonical
contracts used across all "toolbox" APIs and the Python services that consume
them.

``TypedDict`` is used for plain JSON-shaped data structures (request/response
bodies), and ``Protocol`` is used for structural interfaces that concrete
implementations must satisfy.

All Python services should import from ``toolbox_py`` rather than defining
local copies of these types.
"""

from __future__ import annotations

from typing import Any, Literal, Protocol, runtime_checkable

# ---------------------------------------------------------------------------
# Re-export TypedDict for convenience
# ---------------------------------------------------------------------------

from typing import TypedDict  # noqa: E402  (available since Python 3.8)

__all__ = [
    # Users API
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
    # Downloader service
    "IngestRequest",
    "IngestResponse",
    # Search service
    "SearchRequest",
    "SearchResult",
    "SearchResponse",
    # File generator service
    "ResumeFormat",
    "GenerateRequest",
    "GenerateResponse",
    # Document reader service
    "DocumentReadRequest",
    "DocumentReadOptions",
    "DocumentReadResponse",
    # Protocols
    "IUsersApiClient",
    "ISearchClient",
    "IDocumentReaderClient",
    "IDownloaderClient",
    "IFileGeneratorClient",
]

# ---------------------------------------------------------------------------
# Primitive type aliases
# ---------------------------------------------------------------------------

SortDirection = Literal["asc", "desc"]
"""Sort order — either ascending or descending."""

UserSortField = Literal["uid", "email", "role", "enable"]
"""Valid field names for sorting user records."""

PreApprovedSortField = Literal["email", "role"]
"""Valid field names for sorting pre-approved user records."""

ResumeFormat = Literal["pdf", "docx", "html"]
"""Supported resume output formats."""

# ---------------------------------------------------------------------------
# Users API
# ---------------------------------------------------------------------------


class UserRecord(TypedDict):
    """A user record managed by the users service."""

    uid: str
    email: str
    role: str
    enable: bool


class PreApprovedUser(TypedDict):
    """A pre-approved user record managed by the users service."""

    email: str
    role: str


class AuthorizeRequest(TypedDict):
    """Request payload for the authorize endpoint."""

    uid: str
    email: str


class AuthorizeResponse(TypedDict):
    """Response from the authorize endpoint."""

    role: str
    enable: bool


class CreateUserRequest(TypedDict):
    """Request payload for creating a new user."""

    uid: str
    email: str
    role: str
    enable: bool


class UpdateUserRequest(TypedDict, total=False):
    """Request payload for updating an existing user (role and/or enable status).

    All fields are optional — only the provided keys are updated.
    """

    email: str
    role: str
    enable: bool


class AddPreApprovedRequest(TypedDict):
    """Request payload for adding a new pre-approved user."""

    email: str
    role: str


class UpdatePreApprovedRequest(TypedDict, total=False):
    """Request payload for updating a pre-approved user.

    All fields are optional — only the provided keys are updated.
    """

    role: str


class ListUsersResponse(TypedDict, total=False):
    """Paginated list users response."""

    users: list[UserRecord]
    pageToken: str


class UserFilters(TypedDict, total=False):
    """Filters for querying users."""

    email: str
    role: str
    enable: bool
    orderBy: UserSortField
    orderDirection: SortDirection


class PreApprovedFilters(TypedDict, total=False):
    """Filters for querying pre-approved users."""

    role: str
    orderBy: PreApprovedSortField
    orderDirection: SortDirection


# ---------------------------------------------------------------------------
# Downloader service API
# ---------------------------------------------------------------------------


class IngestRequest(TypedDict, total=False):
    """Request payload for triggering a resume ingest."""

    sheetId: str
    batchId: str
    metadata: dict[str, Any]


class IngestResponse(TypedDict):
    """Response from the ingest endpoint."""

    jobId: str
    status: str
    acceptedAt: str


# ---------------------------------------------------------------------------
# Search service API
# ---------------------------------------------------------------------------


class SearchRequest(TypedDict, total=False):
    """Request payload for a semantic search."""

    query: str  # required but TypedDict with total=False allows progressive build
    filters: dict[str, Any]
    limit: int
    offset: int


class SearchResult(TypedDict):
    """A single search result item."""

    id: str
    score: float
    data: dict[str, Any]


class SearchResponse(TypedDict):
    """Response from the search endpoint."""

    results: list[SearchResult]
    total: int
    query: str


# ---------------------------------------------------------------------------
# File generator service API
# ---------------------------------------------------------------------------


class GenerateRequest(TypedDict, total=False):
    """Request payload for generating a resume file."""

    language: str  # required
    format: ResumeFormat  # required
    outputFormats: list[ResumeFormat]


class GenerateResponse(TypedDict, total=False):
    """Response from the generate endpoint."""

    jobId: str
    status: str
    downloadUrl: str
    driveLink: str


# ---------------------------------------------------------------------------
# Document reader service API
# ---------------------------------------------------------------------------


class DocumentReadOptions(TypedDict, total=False):
    """Options for the document read endpoint."""

    extractTables: bool
    language: str


class DocumentReadRequest(TypedDict, total=False):
    """Request payload for reading a document."""

    fileReference: str  # required
    options: DocumentReadOptions


class DocumentReadResponse(TypedDict, total=False):
    """Response from the document read endpoint."""

    text: str
    metadata: dict[str, Any]


# ---------------------------------------------------------------------------
# Service client Protocols
#
# These structural interfaces allow services to depend on abstractions rather
# than concrete HTTP client implementations.  They mirror the service-client
# interfaces used in the TypeScript services.
# ---------------------------------------------------------------------------


@runtime_checkable
class IUsersApiClient(Protocol):
    """Structural interface for a client of the Users API."""

    def get_user(self, uid: str) -> UserRecord:
        """Retrieve a user record by UID."""
        ...

    def list_users(self, filters: UserFilters | None = None) -> ListUsersResponse:
        """Return a (optionally filtered) page of user records."""
        ...

    def create_user(self, payload: CreateUserRequest) -> UserRecord:
        """Create a new user record."""
        ...

    def update_user(self, uid: str, payload: UpdateUserRequest) -> UserRecord:
        """Update an existing user record."""
        ...

    def delete_user(self, uid: str) -> None:
        """Delete a user record."""
        ...

    def authorize(self, payload: AuthorizeRequest) -> AuthorizeResponse:
        """Authorize a user by UID and email, returning their role and status."""
        ...


@runtime_checkable
class ISearchClient(Protocol):
    """Structural interface for a client of the Search service."""

    def search(self, payload: SearchRequest) -> SearchResponse:
        """Perform a semantic search and return matching results."""
        ...


@runtime_checkable
class IDocumentReaderClient(Protocol):
    """Structural interface for a client of the Document Reader service."""

    def read_document(self, payload: DocumentReadRequest) -> DocumentReadResponse:
        """Extract text and metadata from a document."""
        ...


@runtime_checkable
class IDownloaderClient(Protocol):
    """Structural interface for a client of the Downloader service."""

    def ingest(self, payload: IngestRequest) -> IngestResponse:
        """Trigger a resume ingest job."""
        ...


@runtime_checkable
class IFileGeneratorClient(Protocol):
    """Structural interface for a client of the File Generator service."""

    def generate(self, payload: GenerateRequest) -> GenerateResponse:
        """Trigger a resume file generation job."""
        ...
