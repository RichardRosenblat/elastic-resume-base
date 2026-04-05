"""Pydantic models for the File Generator service API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    """Request payload for the resume file generation endpoint.

    Attributes:
        language: BCP-47 language tag for the output document (e.g. ``"en"``,
            ``"pt-BR"``).  When the language differs from the stored resume
            language, the service will apply Google Cloud Translation before
            rendering.
        format: Desired output file format.  Currently only ``"docx"`` is
            supported.
        output_formats: Additional formats to include in the response (optional).
    """

    language: str = Field(
        ...,
        min_length=2,
        max_length=10,
        description="BCP-47 language tag for the output document.",
        examples=["en", "pt-BR"],
    )
    format: str = Field(
        default="docx",
        description="Desired output file format.",
        examples=["docx"],
    )
    output_formats: list[str] | None = Field(
        default=None,
        alias="outputFormats",
        description="Additional output formats.",
    )

    model_config = {"populate_by_name": True}


class GenerateResponse(BaseModel):
    """Response returned by the resume file generation endpoint.

    Attributes:
        job_id: A UUID identifying this generation job.
        status: Generation status — always ``"completed"`` for synchronous
            generation.
        file_content: Base64-encoded content of the generated ``.docx`` file.
        mime_type: MIME type of the generated file.
        filename: Suggested download filename.
    """

    job_id: str = Field(..., alias="jobId", description="Generation job identifier.")
    status: str = Field(..., description="Generation status.")
    file_content: str = Field(
        ...,
        alias="fileContent",
        description="Base64-encoded generated document content.",
    )
    mime_type: str = Field(
        default=(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        alias="mimeType",
        description="MIME type of the generated file.",
    )
    filename: str = Field(
        default="resume.docx",
        description="Suggested download filename.",
    )

    model_config = {"populate_by_name": True}
