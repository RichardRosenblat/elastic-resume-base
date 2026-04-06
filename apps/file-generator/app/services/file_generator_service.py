"""Core file generation pipeline for the File Generator service.

Orchestrates the full resume document generation flow:

1. Fetch structured resume data from Firestore via the Synapse resume store.
2. Decrypt PII fields using Cloud KMS (if configured).
3. Optionally translate structured data via Google Cloud Translation API
   (results cached in Firestore).
4. Fetch the ``.docx`` Jinja2 template from Google Drive using Bugle
   (or fall back to a local file in development).
5. Render the template with the structured resume data using ``docxtpl``.
6. Return the rendered document bytes as base64.
"""

from __future__ import annotations

import base64
import io
import logging
import uuid
from typing import Any

from app.utils.exceptions import (
    ResumeNotFoundError,
    TemplateNotFoundError,
    TemplateRenderError,
)
from app.utils.kms import decrypt_pii_fields

logger = logging.getLogger(__name__)

#: MIME type for .docx files.
DOCX_MIME_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)

#: PII field names that may be encrypted with Cloud KMS.
PII_FIELDS = ["name", "email", "phone", "address", "cpf", "rg"]


class FileGeneratorService:
    """Generates resume ``.docx`` documents from Firestore data and a Drive template.

    Args:
        resume_store: Synapse resume store for reading structured resume data.
        translation_service: Optional translation service.  When provided,
            translation is applied before rendering.
        drive_template_file_id: Google Drive file ID for the ``.docx`` template.
        local_template_path: Local path to a ``.docx`` template file (used when
            *drive_template_file_id* is empty, for local development).
        decrypt_kms_key_name: Cloud KMS key name for decrypting PII fields.  Pass an
            empty string to skip decryption.

    Example::

        service = FileGeneratorService(
            resume_store=FirestoreResumeStore(),
            drive_template_file_id="1BxiMVs0XRA5nFMd...",
            decrypt_kms_key_name="projects/my-proj/locations/global/...",
        )
        job_id, file_b64, mime = service.generate("resume-abc-123", language="en")
    """

    def __init__(
        self,
        resume_store: Any,
        translation_service: Any | None = None,
        drive_template_file_id: str = "",
        local_template_path: str = "",
        decrypt_kms_key_name: str = "",
    ) -> None:
        """Initialise the FileGeneratorService.

        Args:
            resume_store: Synapse resume store instance.
            translation_service: Optional translation service instance.
            drive_template_file_id: Google Drive file ID for the template.
            local_template_path: Local path to a template file (dev fallback).
            decrypt_kms_key_name: Cloud KMS key name (empty to skip decryption).
        """
        self._store = resume_store
        self._translation_service = translation_service
        self._drive_template_file_id = drive_template_file_id
        self._local_template_path = local_template_path
        self._kms_key_name = decrypt_kms_key_name

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def generate(
        self,
        resume_id: str,
        language: str = "en",
        format: str = "docx",
    ) -> tuple[str, str, str]:
        """Generate a resume document for *resume_id*.

        Steps:
            1. Fetch structured resume data from Firestore.
            2. Decrypt PII fields with Cloud KMS (if configured).
            3. Optionally translate data to *language*.
            4. Fetch ``.docx`` template from Google Drive (or local fallback).
            5. Render template with docxtpl.
            6. Return job ID, base64-encoded content, and MIME type.

        Args:
            resume_id: Firestore document ID of the resume to generate.
            language: BCP-47 language tag for the output document.
            format: Desired output format (currently only ``"docx"``).

        Returns:
            A tuple of ``(job_id, file_content_b64, mime_type)``.

        Raises:
            ResumeNotFoundError: If the resume does not exist in Firestore.
            TemplateNotFoundError: If the template cannot be retrieved.
            TemplateRenderError: If docxtpl rendering fails.
        """
        logger.info(
            "Starting file generation",
            extra={"resume_id": resume_id, "language": language, "format": format},
        )

        # Step 1 — fetch resume data.
        resume_data = self._fetch_resume_data(resume_id)

        # Step 2 — decrypt PII fields.
        resume_data = self._decrypt_pii(resume_data)

        # Step 3 — optionally translate.
        if self._translation_service is not None:
            logger.info(
                "Applying translation",
                extra={"resume_id": resume_id, "language": language},
            )
            resume_data = self._translation_service.translate_resume_data(
                resume_data, target_language=language
            )

        # Step 4 — fetch template bytes.
        template_bytes = self._fetch_template()

        # Step 5 — render template.
        rendered_bytes = self._render_template(template_bytes, resume_data, resume_id)

        # Step 6 — base64-encode and return.
        job_id = f"gen-{uuid.uuid4()}"
        file_content_b64 = base64.b64encode(rendered_bytes).decode("utf-8")

        logger.info(
            "File generation completed",
            extra={
                "resume_id": resume_id,
                "job_id": job_id,
                "size_bytes": len(rendered_bytes),
            },
        )
        return job_id, file_content_b64, DOCX_MIME_TYPE

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _fetch_resume_data(self, resume_id: str) -> dict[str, Any]:
        """Retrieve structured resume data from Firestore.

        The AI Worker stores structured fields inside the ``metadata``
        sub-document of the resume record.  This method extracts that dict
        and supplements it with the resume ID.

        Args:
            resume_id: Firestore document ID.

        Returns:
            Structured resume data dictionary.

        Raises:
            ResumeNotFoundError: If the document does not exist.
        """
        try:
            from synapse_py import SynapseNotFoundError  # type: ignore[import-untyped]

            resume = self._store.get_resume(resume_id)
        except Exception as exc:
            # Import may fail in test environment; check message too.
            if "not found" in str(exc).lower() or "SynapseNotFoundError" in type(exc).__name__:
                raise ResumeNotFoundError(resume_id) from exc
            raise ResumeNotFoundError(resume_id) from exc

        # The AI Worker stores structured fields under metadata.structuredData
        # or directly under metadata.
        metadata: dict[str, Any] = dict(resume.metadata) if resume.metadata else {}
        structured: dict[str, Any] = dict(
            metadata.get("structuredData") or metadata.get("structured_data") or metadata
        )

        # Always include the resume ID and raw text as fallback context.
        structured.setdefault("resumeId", resume_id)
        structured.setdefault("rawText", resume.raw_text)

        logger.debug(
            "Resume data fetched",
            extra={"resume_id": resume_id, "fields": list(structured.keys())},
        )
        return structured

    def _decrypt_pii(self, data: dict[str, Any]) -> dict[str, Any]:
        """Decrypt PII fields in *data* using Cloud KMS.

        Args:
            data: Structured resume data dictionary.

        Returns:
            Dictionary with PII fields decrypted (or unchanged when KMS is
            not configured).
        """
        if not self._kms_key_name:
            return data

        return decrypt_pii_fields(data, PII_FIELDS, self._kms_key_name)  # type: ignore[return-value]

    def _fetch_template(self) -> bytes:
        """Retrieve the ``.docx`` template file.

        Tries Google Drive first (when ``drive_template_file_id`` is set),
        then falls back to the local template path.

        Returns:
            Raw bytes of the ``.docx`` template.

        Raises:
            TemplateNotFoundError: If neither source yields a template.
        """
        if self._drive_template_file_id:
            return self._fetch_template_from_drive(self._drive_template_file_id)

        if self._local_template_path:
            return self._fetch_template_from_local(self._local_template_path)

        raise TemplateNotFoundError(
            "No template source configured. "
            "Set DRIVE_TEMPLATE_FILE_ID or LOCAL_TEMPLATE_PATH."
        )

    def _fetch_template_from_drive(self, file_id: str) -> bytes:
        """Download the template from Google Drive using Bugle DriveService.

        Args:
            file_id: Google Drive file ID of the template.

        Returns:
            Raw bytes of the downloaded file.

        Raises:
            TemplateNotFoundError: If the Drive download fails.
        """
        try:
            from bugle_py import DriveService  # type: ignore[import-untyped]

            drive = DriveService()
            content, _mime = drive.download_file(file_id)
            logger.debug(
                "Template fetched from Drive",
                extra={"file_id": file_id, "size_bytes": len(content)},
            )
            return content
        except Exception as exc:
            logger.error("Failed to fetch template from Drive: %s", exc)
            raise TemplateNotFoundError(
                f"Failed to fetch template from Google Drive: {exc}"
            ) from exc

    def _fetch_template_from_local(self, path: str) -> bytes:
        """Read the template from a local file path.

        Args:
            path: File system path to the ``.docx`` template.

        Returns:
            Raw bytes of the template file.

        Raises:
            TemplateNotFoundError: If the file cannot be read.
        """
        try:
            with open(path, "rb") as fh:
                content = fh.read()
            logger.debug(
                "Template loaded from local path",
                extra={"path": path, "size_bytes": len(content)},
            )
            return content
        except OSError as exc:
            raise TemplateNotFoundError(
                f"Failed to read local template file '{path}': {exc}"
            ) from exc

    def _render_template(
        self,
        template_bytes: bytes,
        context: dict[str, Any],
        resume_id: str,
    ) -> bytes:
        """Render a docxtpl Jinja2 template with *context*.

        Args:
            template_bytes: Raw ``.docx`` template bytes.
            context: Template context dictionary (structured resume data).
            resume_id: Resume ID (used for logging only).

        Returns:
            Raw bytes of the rendered ``.docx`` document.

        Raises:
            TemplateRenderError: If docxtpl rendering raises an exception.
        """
        try:
            from docxtpl import DocxTemplate  # type: ignore[import-untyped]

            buf_in = io.BytesIO(template_bytes)
            tpl = DocxTemplate(buf_in)
            tpl.render(context)

            buf_out = io.BytesIO()
            tpl.save(buf_out)
            rendered = buf_out.getvalue()

            logger.debug(
                "Template rendered",
                extra={"resume_id": resume_id, "size_bytes": len(rendered)},
            )
            return rendered
        except Exception as exc:
            logger.error(
                "Template rendering failed: %s", exc, extra={"resume_id": resume_id}
            )
            raise TemplateRenderError(f"Template rendering failed: {exc}") from exc
