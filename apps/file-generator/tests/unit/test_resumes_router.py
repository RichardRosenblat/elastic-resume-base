"""Unit tests for the resumes router (POST /resumes/{resume_id}/generate)."""

from __future__ import annotations

import base64
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

from app.utils.exceptions import (
    ResumeNotFoundError,
    TemplateNotFoundError,
    TemplateRenderError,
    TranslationError,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _generate_payload(language: str = "en", format: str = "docx") -> dict[str, Any]:
    return {"language": language, "format": format}


def _make_generate_result(
    job_id: str = "gen-test-123",
    content: bytes = b"docx-bytes",
    mime: str = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
) -> tuple[str, str, str]:
    return job_id, base64.b64encode(content).decode(), mime


# ---------------------------------------------------------------------------
# POST /resumes/{resume_id}/generate — success
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_returns_200_on_success(app_client: AsyncClient) -> None:
    """POST /resumes/{id}/generate returns 200 with generated file content."""
    job_id, content_b64, mime = _make_generate_result()

    mock_service = MagicMock()
    mock_service.generate.return_value = (job_id, content_b64, mime)

    with (
        patch("app.routers.resumes.initialize_persistence"),
        patch("app.routers.resumes.FirestoreResumeStore"),
        patch("app.routers.resumes._get_file_generator_service", return_value=mock_service),
    ):
        async with app_client as client:
            resp = await client.post(
                "/resumes/abc-123/generate",
                json=_generate_payload(),
            )

    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["jobId"].startswith("gen-")
    assert body["data"]["status"] == "completed"
    assert "fileContent" in body["data"]


@pytest.mark.asyncio
async def test_generate_includes_filename(app_client: AsyncClient) -> None:
    """Response includes a filename field derived from the resume ID."""
    job_id, content_b64, mime = _make_generate_result()
    mock_service = MagicMock()
    mock_service.generate.return_value = (job_id, content_b64, mime)

    with patch("app.routers.resumes._get_file_generator_service", return_value=mock_service):
        async with app_client as client:
            resp = await client.post(
                "/resumes/my-resume-id/generate",
                json=_generate_payload(),
            )

    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["filename"] == "resume-my-resume-id.docx"


# ---------------------------------------------------------------------------
# POST /resumes/{resume_id}/generate — error cases
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_returns_404_when_resume_not_found(app_client: AsyncClient) -> None:
    """POST /resumes/{id}/generate returns 404 when resume does not exist."""
    mock_service = MagicMock()
    mock_service.generate.side_effect = ResumeNotFoundError("missing-id")

    with patch("app.routers.resumes._get_file_generator_service", return_value=mock_service):
        async with app_client as client:
            resp = await client.post(
                "/resumes/missing-id/generate",
                json=_generate_payload(),
            )

    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_generate_returns_503_when_template_unavailable(app_client: AsyncClient) -> None:
    """POST /resumes/{id}/generate returns 503 when the template is unavailable."""
    mock_service = MagicMock()
    mock_service.generate.side_effect = TemplateNotFoundError("No template configured")

    with patch("app.routers.resumes._get_file_generator_service", return_value=mock_service):
        async with app_client as client:
            resp = await client.post(
                "/resumes/r-1/generate",
                json=_generate_payload(),
            )

    assert resp.status_code == 503
    body = resp.json()
    assert body["error"]["code"] == "SERVICE_UNAVAILABLE"


@pytest.mark.asyncio
async def test_generate_returns_500_on_render_error(app_client: AsyncClient) -> None:
    """POST /resumes/{id}/generate returns 500 on template render failure."""
    mock_service = MagicMock()
    mock_service.generate.side_effect = TemplateRenderError("Jinja2 error")

    with patch("app.routers.resumes._get_file_generator_service", return_value=mock_service):
        async with app_client as client:
            resp = await client.post(
                "/resumes/r-1/generate",
                json=_generate_payload(),
            )

    assert resp.status_code == 500
    body = resp.json()
    assert body["error"]["code"] == "INTERNAL_ERROR"


@pytest.mark.asyncio
async def test_generate_returns_500_on_translation_error(app_client: AsyncClient) -> None:
    """POST /resumes/{id}/generate returns 500 on translation failure."""
    mock_service = MagicMock()
    mock_service.generate.side_effect = TranslationError("API call failed")

    with patch("app.routers.resumes._get_file_generator_service", return_value=mock_service):
        async with app_client as client:
            resp = await client.post(
                "/resumes/r-1/generate",
                json={"language": "pt", "format": "docx"},
            )

    assert resp.status_code == 500
    body = resp.json()
    assert body["error"]["code"] == "INTERNAL_ERROR"


@pytest.mark.asyncio
async def test_generate_returns_500_on_unexpected_error(app_client: AsyncClient) -> None:
    """POST /resumes/{id}/generate returns 500 on unexpected errors."""
    mock_service = MagicMock()
    mock_service.generate.side_effect = RuntimeError("Unexpected crash")

    with patch("app.routers.resumes._get_file_generator_service", return_value=mock_service):
        async with app_client as client:
            resp = await client.post(
                "/resumes/r-1/generate",
                json=_generate_payload(),
            )

    assert resp.status_code == 500
    body = resp.json()
    assert body["error"]["code"] == "INTERNAL_ERROR"


# ---------------------------------------------------------------------------
# Health endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_health_live(app_client: AsyncClient) -> None:
    """GET /health/live returns 200."""
    async with app_client as client:
        resp = await client.get("/health/live")
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "ok"


@pytest.mark.asyncio
async def test_health_ready(app_client: AsyncClient) -> None:
    """GET /health/ready returns 200."""
    async with app_client as client:
        resp = await client.get("/health/ready")
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "ok"
