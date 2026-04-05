"""Unit tests for FileGeneratorService."""

from __future__ import annotations

import base64
import io
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from app.services.file_generator_service import FileGeneratorService
from app.utils.exceptions import (
    ResumeNotFoundError,
    TemplateNotFoundError,
    TemplateRenderError,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_resume(
    resume_id: str = "abc-123",
    raw_text: str = "John Doe, Python developer",
    metadata: dict[str, Any] | None = None,
) -> MagicMock:
    """Build a mock ResumeDocument."""
    doc = MagicMock()
    doc.id = resume_id
    doc.raw_text = raw_text
    doc.metadata = metadata or {}
    doc.status = "PROCESSED"
    return doc


def _make_service(
    resume_store: Any = None,
    translation_service: Any = None,
    drive_file_id: str = "",
    local_template: str = "",
    kms_key: str = "",
) -> FileGeneratorService:
    """Build a FileGeneratorService with mock defaults."""
    return FileGeneratorService(
        resume_store=resume_store or MagicMock(),
        translation_service=translation_service,
        drive_template_file_id=drive_file_id,
        local_template_path=local_template,
        kms_key_name=kms_key,
    )


def _minimal_docx_bytes() -> bytes:
    """Return minimal valid .docx bytes (empty zip) for use in mocks."""
    # A real docx is a zip file; we return a placeholder that docxtpl can accept
    # when mocked, but in tests we mock docxtpl so the exact content doesn't matter.
    return b"PK\x03\x04fake-docx-content"


# ---------------------------------------------------------------------------
# _fetch_resume_data
# ---------------------------------------------------------------------------


def test_fetch_resume_data_returns_metadata() -> None:
    """_fetch_resume_data extracts metadata from the resume document."""
    store = MagicMock()
    resume = _make_resume(
        resume_id="r-1",
        metadata={"name": "Jane Doe", "skills": ["Python"]},
    )
    store.get_resume.return_value = resume

    svc = _make_service(resume_store=store)
    data = svc._fetch_resume_data("r-1")

    assert data["name"] == "Jane Doe"
    assert data["skills"] == ["Python"]
    assert data["resumeId"] == "r-1"
    store.get_resume.assert_called_once_with("r-1")


def test_fetch_resume_data_extracts_nested_structured_data() -> None:
    """_fetch_resume_data handles structuredData nested under metadata."""
    store = MagicMock()
    resume = _make_resume(
        resume_id="r-2",
        metadata={"structuredData": {"name": "John Smith", "experience": []}},
    )
    store.get_resume.return_value = resume

    svc = _make_service(resume_store=store)
    data = svc._fetch_resume_data("r-2")

    assert data["name"] == "John Smith"
    assert data["resumeId"] == "r-2"


def test_fetch_resume_data_raises_not_found_on_error() -> None:
    """_fetch_resume_data raises ResumeNotFoundError when the store raises."""
    store = MagicMock()
    store.get_resume.side_effect = Exception("not found")

    svc = _make_service(resume_store=store)
    with pytest.raises(ResumeNotFoundError):
        svc._fetch_resume_data("missing-id")


# ---------------------------------------------------------------------------
# _fetch_template
# ---------------------------------------------------------------------------


def test_fetch_template_from_local_path(tmp_path: Any) -> None:
    """_fetch_template reads bytes from a local file when local_template_path is set."""
    template_file = tmp_path / "template.docx"
    template_file.write_bytes(b"fake-template-bytes")

    svc = _make_service(local_template=str(template_file))
    result = svc._fetch_template()

    assert result == b"fake-template-bytes"


def test_fetch_template_from_local_path_missing(tmp_path: Any) -> None:
    """_fetch_template raises TemplateNotFoundError for a missing local path."""
    svc = _make_service(local_template=str(tmp_path / "nonexistent.docx"))
    with pytest.raises(TemplateNotFoundError, match="Failed to read local template"):
        svc._fetch_template()


def test_fetch_template_raises_when_no_source_configured() -> None:
    """_fetch_template raises TemplateNotFoundError when no source is configured."""
    svc = _make_service()
    with pytest.raises(TemplateNotFoundError, match="No template source configured"):
        svc._fetch_template()


def test_fetch_template_from_drive_calls_bugle(tmp_path: Any) -> None:
    """_fetch_template_from_drive calls Bugle DriveService.download_file."""
    expected_bytes = b"drive-docx-bytes"

    mock_drive_instance = MagicMock()
    mock_drive_instance.download_file.return_value = (
        expected_bytes,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    mock_drive_cls = MagicMock(return_value=mock_drive_instance)
    mock_bugle = MagicMock(DriveService=mock_drive_cls)

    svc = _make_service(drive_file_id="drive-file-123")
    with patch.dict("sys.modules", {"bugle_py": mock_bugle}):
        result = svc._fetch_template_from_drive("drive-file-123")

    assert result == expected_bytes
    mock_drive_instance.download_file.assert_called_once_with("drive-file-123")


def test_fetch_template_from_drive_raises_on_error() -> None:
    """_fetch_template_from_drive raises TemplateNotFoundError on Drive failure."""
    svc = _make_service(drive_file_id="bad-id")
    with patch.dict(
        "sys.modules",
        {
            "bugle_py": MagicMock(
                DriveService=MagicMock(
                    return_value=MagicMock(
                        download_file=MagicMock(side_effect=Exception("Drive error"))
                    )
                )
            )
        },
    ):
        with pytest.raises(TemplateNotFoundError, match="Failed to fetch template"):
            svc._fetch_template_from_drive("bad-id")


# ---------------------------------------------------------------------------
# _render_template
# ---------------------------------------------------------------------------


def test_render_template_returns_bytes(tmp_path: Any) -> None:
    """_render_template returns non-empty bytes on success."""
    rendered_bytes = b"rendered-docx-content"
    mock_tpl = MagicMock()
    mock_tpl_instance = MagicMock()

    def fake_save(buf: Any) -> None:
        buf.write(rendered_bytes)

    mock_tpl_instance.save = fake_save
    mock_tpl.return_value = mock_tpl_instance

    svc = _make_service()
    with patch.dict("sys.modules", {"docxtpl": MagicMock(DocxTemplate=mock_tpl)}):
        result = svc._render_template(b"template", {"name": "John"}, "r-1")

    assert result == rendered_bytes
    mock_tpl_instance.render.assert_called_once_with({"name": "John"})


def test_render_template_raises_on_error() -> None:
    """_render_template raises TemplateRenderError when docxtpl fails."""
    mock_tpl = MagicMock(side_effect=Exception("Jinja2 error"))

    svc = _make_service()
    with patch.dict("sys.modules", {"docxtpl": MagicMock(DocxTemplate=mock_tpl)}):
        with pytest.raises(TemplateRenderError, match="Template rendering failed"):
            svc._render_template(b"bad-template", {}, "r-1")


# ---------------------------------------------------------------------------
# generate — integration of pipeline steps
# ---------------------------------------------------------------------------


def test_generate_returns_job_id_and_base64(tmp_path: Any) -> None:
    """generate returns (job_id, base64_content, mime_type) on success."""
    template_file = tmp_path / "template.docx"
    template_file.write_bytes(b"template-content")

    store = MagicMock()
    store.get_resume.return_value = _make_resume(
        metadata={"name": "Alice", "skills": ["Go"]}
    )

    rendered_bytes = b"rendered-document-bytes"
    mock_docx_tpl = MagicMock()
    mock_docx_instance = MagicMock()

    def fake_save(buf: Any) -> None:
        buf.write(rendered_bytes)

    mock_docx_instance.save = fake_save
    mock_docx_tpl.return_value = mock_docx_instance

    svc = _make_service(resume_store=store, local_template=str(template_file))

    with patch.dict("sys.modules", {"docxtpl": MagicMock(DocxTemplate=mock_docx_tpl)}):
        job_id, content_b64, mime_type = svc.generate("abc-123", language="en")

    assert job_id.startswith("gen-")
    assert base64.b64decode(content_b64) == rendered_bytes
    assert "wordprocessingml" in mime_type


def test_generate_calls_translation_service(tmp_path: Any) -> None:
    """generate applies translation when a translation_service is provided."""
    template_file = tmp_path / "template.docx"
    template_file.write_bytes(b"template")

    store = MagicMock()
    store.get_resume.return_value = _make_resume(metadata={"summary": "Software engineer"})

    translation_svc = MagicMock()
    translation_svc.translate_resume_data.return_value = {"summary": "Engenheiro de software"}

    mock_docx_tpl = MagicMock()
    mock_docx_instance = MagicMock()
    mock_docx_instance.save = lambda buf: buf.write(b"rendered")
    mock_docx_tpl.return_value = mock_docx_instance

    svc = _make_service(
        resume_store=store,
        translation_service=translation_svc,
        local_template=str(template_file),
    )

    with patch.dict("sys.modules", {"docxtpl": MagicMock(DocxTemplate=mock_docx_tpl)}):
        svc.generate("r-1", language="pt")

    translation_svc.translate_resume_data.assert_called_once()
    call_args = translation_svc.translate_resume_data.call_args
    assert call_args.kwargs["target_language"] == "pt" or call_args.args[1] == "pt"


def test_generate_raises_not_found() -> None:
    """generate raises ResumeNotFoundError when resume does not exist."""
    store = MagicMock()
    store.get_resume.side_effect = Exception("not found")

    svc = _make_service(resume_store=store, local_template="/tmp/fake.docx")
    with pytest.raises(ResumeNotFoundError):
        svc.generate("missing-id", language="en")


# ---------------------------------------------------------------------------
# _decrypt_pii
# ---------------------------------------------------------------------------


def test_decrypt_pii_skipped_when_no_kms_key() -> None:
    """_decrypt_pii returns data unchanged when kms_key_name is empty."""
    svc = _make_service(kms_key="")
    data = {"name": "enc:abc", "skills": ["Python"]}
    result = svc._decrypt_pii(data)
    assert result == data


def test_decrypt_pii_calls_kms_when_key_configured() -> None:
    """_decrypt_pii calls decrypt_pii_fields when kms_key_name is set."""
    svc = _make_service(kms_key="projects/p/locations/global/keyRings/r/cryptoKeys/k")
    data = {"name": "ciphertext", "email": "enc:email"}

    with patch(
        "app.services.file_generator_service.decrypt_pii_fields",
        return_value={"name": "John Doe", "email": "john@example.com"},
    ) as mock_kms:
        result = svc._decrypt_pii(data)

    mock_kms.assert_called_once()
    assert result["name"] == "John Doe"
