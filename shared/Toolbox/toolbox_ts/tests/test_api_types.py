"""Unit tests for toolbox_py.api_types module.

Validates that all TypedDict structures and Protocol interfaces are importable,
structurally sound, and consistent with the canonical TS definitions in
``shared/Toolbox/toolbox_ts/src/api-types.ts``.
"""

from __future__ import annotations

from typing import get_type_hints

import pytest
from toolbox_py import (
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
    PreApprovedUser,
    ResumeFormat,
    SearchRequest,
    SearchResponse,
    SearchResult,
    UpdatePreApprovedRequest,
    UpdateUserRequest,
    UserFilters,
    UserRecord,
)


# ---------------------------------------------------------------------------
# TypedDict structure tests
# ---------------------------------------------------------------------------


class TestUserRecord:
    def test_required_keys(self) -> None:
        record: UserRecord = {"uid": "u1", "email": "a@b.com", "role": "admin", "enable": True}
        assert record["uid"] == "u1"
        assert record["email"] == "a@b.com"
        assert record["role"] == "admin"
        assert record["enable"] is True

    def test_has_all_required_fields(self) -> None:
        hints = get_type_hints(UserRecord)
        assert set(hints.keys()) == {"uid", "email", "role", "enable"}


class TestPreApprovedUser:
    def test_required_keys(self) -> None:
        user: PreApprovedUser = {"email": "x@y.com", "role": "user"}
        assert user["email"] == "x@y.com"
        assert user["role"] == "user"

    def test_has_all_required_fields(self) -> None:
        hints = get_type_hints(PreApprovedUser)
        assert set(hints.keys()) == {"email", "role"}


class TestAuthorizeRequest:
    def test_required_keys(self) -> None:
        req: AuthorizeRequest = {"uid": "u1", "email": "a@b.com"}
        assert req["uid"] == "u1"
        assert req["email"] == "a@b.com"


class TestAuthorizeResponse:
    def test_required_keys(self) -> None:
        resp: AuthorizeResponse = {"role": "admin", "enable": True}
        assert resp["role"] == "admin"
        assert resp["enable"] is True


class TestCreateUserRequest:
    def test_required_keys(self) -> None:
        req: CreateUserRequest = {"uid": "u1", "email": "a@b.com", "role": "user", "enable": True}
        assert req["uid"] == "u1"

    def test_has_all_required_fields(self) -> None:
        hints = get_type_hints(CreateUserRequest)
        assert set(hints.keys()) == {"uid", "email", "role", "enable"}


class TestUpdateUserRequest:
    def test_all_fields_optional(self) -> None:
        # An empty dict is valid because total=False
        req: UpdateUserRequest = {}
        assert req == {}

    def test_partial_update(self) -> None:
        req: UpdateUserRequest = {"role": "editor"}
        assert req["role"] == "editor"


class TestAddPreApprovedRequest:
    def test_required_keys(self) -> None:
        req: AddPreApprovedRequest = {"email": "a@b.com", "role": "user"}
        assert req["email"] == "a@b.com"
        assert req["role"] == "user"


class TestUpdatePreApprovedRequest:
    def test_all_fields_optional(self) -> None:
        req: UpdatePreApprovedRequest = {}
        assert req == {}


class TestListUsersResponse:
    def test_with_users(self) -> None:
        user: UserRecord = {"uid": "u1", "email": "a@b.com", "role": "admin", "enable": True}
        resp: ListUsersResponse = {"users": [user]}
        assert len(resp["users"]) == 1

    def test_with_page_token(self) -> None:
        user: UserRecord = {"uid": "u1", "email": "a@b.com", "role": "admin", "enable": True}
        resp: ListUsersResponse = {"users": [user], "pageToken": "next_page"}
        assert resp["pageToken"] == "next_page"


class TestUserFilters:
    def test_empty_filters_valid(self) -> None:
        filters: UserFilters = {}
        assert filters == {}

    def test_partial_filters(self) -> None:
        filters: UserFilters = {"role": "admin", "enable": True}
        assert filters["role"] == "admin"


class TestPreApprovedFilters:
    def test_empty_filters_valid(self) -> None:
        filters: PreApprovedFilters = {}
        assert filters == {}


# ---------------------------------------------------------------------------
# Downloader service
# ---------------------------------------------------------------------------


class TestIngestRequest:
    def test_empty_valid(self) -> None:
        req: IngestRequest = {}
        assert req == {}

    def test_with_sheet_id(self) -> None:
        req: IngestRequest = {"sheetId": "sheet-123"}
        assert req["sheetId"] == "sheet-123"


class TestIngestResponse:
    def test_required_keys(self) -> None:
        resp: IngestResponse = {"jobId": "j1", "status": "accepted", "acceptedAt": "2024-01-01T00:00:00Z"}
        assert resp["jobId"] == "j1"
        assert resp["status"] == "accepted"
        assert resp["acceptedAt"] == "2024-01-01T00:00:00Z"

    def test_has_all_required_fields(self) -> None:
        hints = get_type_hints(IngestResponse)
        assert set(hints.keys()) == {"jobId", "status", "acceptedAt"}


# ---------------------------------------------------------------------------
# Search service
# ---------------------------------------------------------------------------


class TestSearchResult:
    def test_required_keys(self) -> None:
        result: SearchResult = {"id": "r1", "score": 0.95, "data": {"name": "Alice"}}
        assert result["id"] == "r1"
        assert result["score"] == pytest.approx(0.95)

    def test_has_all_required_fields(self) -> None:
        hints = get_type_hints(SearchResult)
        assert set(hints.keys()) == {"id", "score", "data"}


class TestSearchResponse:
    def test_required_keys(self) -> None:
        result: SearchResult = {"id": "r1", "score": 0.95, "data": {}}
        resp: SearchResponse = {"results": [result], "total": 1, "query": "engineer"}
        assert resp["total"] == 1
        assert resp["query"] == "engineer"

    def test_has_all_required_fields(self) -> None:
        hints = get_type_hints(SearchResponse)
        assert set(hints.keys()) == {"results", "total", "query"}


class TestSearchRequest:
    def test_empty_valid(self) -> None:
        req: SearchRequest = {}
        assert req == {}

    def test_with_query(self) -> None:
        req: SearchRequest = {"query": "senior developer", "limit": 10}
        assert req["query"] == "senior developer"
        assert req["limit"] == 10


# ---------------------------------------------------------------------------
# File generator service
# ---------------------------------------------------------------------------


class TestGenerateRequest:
    def test_with_language_and_format(self) -> None:
        req: GenerateRequest = {"language": "en", "format": "pdf"}
        assert req["language"] == "en"
        assert req["format"] == "pdf"

    def test_with_output_formats(self) -> None:
        req: GenerateRequest = {"language": "pt", "format": "docx", "outputFormats": ["pdf", "html"]}
        assert req["outputFormats"] == ["pdf", "html"]


class TestGenerateResponse:
    def test_minimal(self) -> None:
        resp: GenerateResponse = {"jobId": "g1", "status": "queued"}
        assert resp["jobId"] == "g1"

    def test_with_urls(self) -> None:
        resp: GenerateResponse = {
            "jobId": "g1",
            "status": "done",
            "downloadUrl": "https://example.com/file.pdf",
            "driveLink": "https://drive.google.com/...",
        }
        assert resp["downloadUrl"].startswith("https://")


# ---------------------------------------------------------------------------
# Document reader service
# ---------------------------------------------------------------------------


class TestDocumentReadOptions:
    def test_empty_valid(self) -> None:
        opts: DocumentReadOptions = {}
        assert opts == {}

    def test_with_options(self) -> None:
        opts: DocumentReadOptions = {"extractTables": True, "language": "pt"}
        assert opts["extractTables"] is True


class TestDocumentReadRequest:
    def test_with_file_reference(self) -> None:
        req: DocumentReadRequest = {"fileReference": "gs://bucket/file.pdf"}
        assert req["fileReference"] == "gs://bucket/file.pdf"

    def test_with_options(self) -> None:
        req: DocumentReadRequest = {
            "fileReference": "gs://bucket/file.pdf",
            "options": {"language": "en"},
        }
        assert req["options"]["language"] == "en"


class TestDocumentReadResponse:
    def test_with_text(self) -> None:
        resp: DocumentReadResponse = {"text": "Hello World"}
        assert resp["text"] == "Hello World"

    def test_with_metadata(self) -> None:
        resp: DocumentReadResponse = {"text": "Hello", "metadata": {"pages": 2}}
        assert resp["metadata"]["pages"] == 2


# ---------------------------------------------------------------------------
# ResumeFormat literal type
# ---------------------------------------------------------------------------


class TestResumeFormat:
    @pytest.mark.parametrize("fmt", ["pdf", "docx", "html"])
    def test_valid_formats(self, fmt: ResumeFormat) -> None:
        # Each valid format value is just a string at runtime
        assert isinstance(fmt, str)


# ---------------------------------------------------------------------------
# Protocol structural checks
# ---------------------------------------------------------------------------


class TestProtocols:
    """Verify that Protocols are runtime-checkable and structurally defined."""

    def test_iusers_api_client_is_protocol(self) -> None:
        assert hasattr(IUsersApiClient, "__protocol_attrs__") or hasattr(
            IUsersApiClient, "_is_protocol"
        )

    def test_isearch_client_is_protocol(self) -> None:
        assert hasattr(ISearchClient, "__protocol_attrs__") or hasattr(
            ISearchClient, "_is_protocol"
        )

    def test_idocument_reader_client_is_protocol(self) -> None:
        assert hasattr(IDocumentReaderClient, "__protocol_attrs__") or hasattr(
            IDocumentReaderClient, "_is_protocol"
        )

    def test_idownloader_client_is_protocol(self) -> None:
        assert hasattr(IDownloaderClient, "__protocol_attrs__") or hasattr(
            IDownloaderClient, "_is_protocol"
        )

    def test_ifile_generator_client_is_protocol(self) -> None:
        assert hasattr(IFileGeneratorClient, "__protocol_attrs__") or hasattr(
            IFileGeneratorClient, "_is_protocol"
        )

    def test_concrete_users_client_satisfies_protocol(self) -> None:
        """A class implementing all IUsersApiClient methods satisfies the Protocol."""

        class ConcreteUsersClient:
            def get_user(self, uid: str) -> UserRecord:
                return {"uid": uid, "email": "a@b.com", "role": "user", "enable": True}

            def list_users(self, filters: UserFilters | None = None) -> ListUsersResponse:
                return {"users": []}

            def create_user(self, payload: CreateUserRequest) -> UserRecord:
                return {"uid": "new", "email": payload["email"], "role": payload["role"], "enable": payload["enable"]}

            def update_user(self, uid: str, payload: UpdateUserRequest) -> UserRecord:
                return {"uid": uid, "email": "a@b.com", "role": "user", "enable": True}

            def delete_user(self, uid: str) -> None:
                pass

            def authorize(self, payload: AuthorizeRequest) -> AuthorizeResponse:
                return {"role": "user", "enable": True}

        assert isinstance(ConcreteUsersClient(), IUsersApiClient)

    def test_concrete_search_client_satisfies_protocol(self) -> None:
        """A class implementing search satisfies ISearchClient."""

        class ConcreteSearchClient:
            def search(self, payload: SearchRequest) -> SearchResponse:
                return {"results": [], "total": 0, "query": payload.get("query", "")}

        assert isinstance(ConcreteSearchClient(), ISearchClient)
