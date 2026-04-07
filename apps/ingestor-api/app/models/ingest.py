"""Pydantic models for the ingestor service API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, model_validator


class IngestRowError(BaseModel):
    """Describes an error encountered while processing a single spreadsheet row.

    Attributes:
        row: 1-based row number in the source spreadsheet where the error occurred.
        error: Human-readable error description.
    """

    row: int = Field(..., description="1-based row number in the source spreadsheet.")
    error: str = Field(..., description="Human-readable error description.")


class IngestRequest(BaseModel):
    """Request body for the ``POST /api/v1/ingest`` endpoint.

    Either ``sheet_id`` or ``sheet_url`` must be provided.  When
    ``has_header_row`` is ``False``, either ``link_column`` or
    ``link_column_index`` must also be supplied so the service knows which
    column holds the Drive links.

    Attributes:
        sheet_id: Google Sheets file ID.  One of ``sheet_id`` or
            ``sheet_url`` must be supplied.
        sheet_url: Full URL of the Google Sheets file.  The service extracts
            the sheet ID from the URL automatically.  One of ``sheet_id`` or
            ``sheet_url`` must be supplied.
        sheet_name: Name of the sheet tab to read.  Defaults to the first
            (active) sheet when ``None``.
        has_header_row: Whether the first row of the sheet is a header row.
            Defaults to ``True``.  When ``False``, ``link_column_index`` must
            be provided (or ``link_column`` if you want to override the default
            setting with a header-style name that happens to match a column
            number).
        link_column: Name of the column header in the spreadsheet that contains
            Google Drive links to resume files.  Defaults to the service-level
            ``sheets_link_column`` setting.  Only used when ``has_header_row``
            is ``True``.
        link_column_index: 1-based column number that contains the Drive links.
            Required when ``has_header_row`` is ``False``.  Ignored when
            ``has_header_row`` is ``True``.
        metadata: Optional extra metadata attached to every ingested resume
            document in Firestore.
    """

    sheet_id: str | None = Field(
        default=None,
        description="Google Sheets file ID.  One of sheet_id or sheet_url is required.",
    )
    sheet_url: str | None = Field(
        default=None,
        description=(
            "Full URL of the Google Sheets file.  "
            "One of sheet_id or sheet_url is required."
        ),
    )
    sheet_name: str | None = Field(
        default=None,
        description="Sheet tab name to read.  Defaults to the first sheet when omitted.",
    )
    has_header_row: bool = Field(
        default=True,
        description=(
            "Whether the first row is a header row.  "
            "When False, link_column_index must be provided."
        ),
    )
    link_column: str | None = Field(
        default=None,
        description=(
            "Column header in the spreadsheet that contains Drive links.  "
            "Used when has_header_row is True.  "
            "Defaults to the service-level 'sheets_link_column' setting."
        ),
    )
    link_column_index: int | None = Field(
        default=None,
        description=(
            "1-based column number that contains Drive links.  "
            "Required when has_header_row is False."
        ),
        ge=1,
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional extra metadata attached to every ingested resume document.",
    )
    user_id: str | None = Field(
        default=None,
        alias="userId",
        description=(
            "Firebase UID of the user who triggered the ingestion.  "
            "Injected by the Gateway API and included in DLQ messages for "
            "user-oriented failure notifications."
        ),
    )

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_fields(self) -> "IngestRequest":
        """Validate required field combinations.

        Returns:
            The validated model instance.

        Raises:
            ValueError: If neither ``sheet_id`` nor ``sheet_url`` is provided,
                or if ``has_header_row`` is ``False`` without a column identifier.
        """
        if not self.sheet_id and not self.sheet_url:
            raise ValueError("Either 'sheet_id' or 'sheet_url' must be provided.")
        if not self.has_header_row and self.link_column is None and self.link_column_index is None:
            raise ValueError(
                "When 'has_header_row' is False, "
                "either 'link_column_index' or 'link_column' must be provided."
            )
        return self


class FileIngestRequest(BaseModel):
    """Parameters for the ``POST /api/v1/ingest/upload`` endpoint.

    All fields are optional except when ``has_header_row`` is ``False``, in
    which case either ``link_column`` or ``link_column_index`` must be
    supplied.

    Attributes:
        sheet_name: Sheet tab name (for Excel files with multiple sheets).
            Ignored for CSV uploads.
        has_header_row: Whether the first row is a header row.
        link_column: Column header name containing Drive links.  Used when
            ``has_header_row`` is ``True``.
        link_column_index: 1-based column number containing Drive links.
            Required when ``has_header_row`` is ``False``.
        metadata: Optional extra metadata attached to every ingested resume.
    """

    sheet_name: str | None = Field(
        default=None,
        description="Sheet tab name for Excel files.  Defaults to the first sheet.",
    )
    has_header_row: bool = Field(
        default=True,
        description="Whether the first row is a header row.",
    )
    link_column: str | None = Field(
        default=None,
        description="Column header containing Drive links.  Used when has_header_row is True.",
    )
    link_column_index: int | None = Field(
        default=None,
        description="1-based column number containing Drive links.  Required when has_header_row is False.",
        ge=1,
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional extra metadata attached to every ingested resume document.",
    )

    @model_validator(mode="after")
    def validate_link_identification(self) -> "FileIngestRequest":
        """Validate that a column can be identified when there is no header row.

        Returns:
            The validated model instance.

        Raises:
            ValueError: If ``has_header_row`` is ``False`` and no column
                identifier is provided.
        """
        if not self.has_header_row and self.link_column is None and self.link_column_index is None:
            raise ValueError(
                "When 'has_header_row' is False, "
                "either 'link_column_index' or 'link_column' must be provided."
            )
        return self


class IngestDuplicate(BaseModel):
    """Describes a resume that was skipped because it had already been ingested.

    Attributes:
        row: 1-based row number in the source spreadsheet where the duplicate
            was detected.
        existing_resume_id: Firestore document ID of the previously ingested
            resume with the same content.
        message: Human-readable description of the duplicate detection.
    """

    row: int = Field(..., description="1-based row number in the source spreadsheet.")
    existing_resume_id: str = Field(
        ...,
        alias="existingResumeId",
        description="Firestore document ID of the already-ingested duplicate resume.",
    )
    message: str = Field(..., description="Human-readable duplicate detection message.")

    model_config = {"populate_by_name": True}


class IngestResponse(BaseModel):
    """Response body for the ``POST /api/v1/ingest`` endpoint.

    Attributes:
        ingested: Number of resumes successfully ingested.
        errors: List of row-level errors encountered during ingestion.
        duplicates: List of rows that were skipped because a resume with the
            same content was already present in the database.
    """

    ingested: int = Field(..., description="Number of resumes successfully ingested.")
    errors: list[IngestRowError] = Field(
        default_factory=list,
        description="Row-level errors encountered during ingestion.",
    )
    duplicates: list[IngestDuplicate] = Field(
        default_factory=list,
        description="Rows skipped because the resume content already exists in the database.",
    )
