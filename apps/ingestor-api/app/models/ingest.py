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

    Either ``sheet_id`` or ``sheet_url`` must be provided.

    Attributes:
        sheet_id: Google Sheets file ID.  One of ``sheet_id`` or
            ``sheet_url`` must be supplied.
        sheet_url: Full URL of the Google Sheets file.  The service extracts
            the sheet ID from the URL automatically.  One of ``sheet_id`` or
            ``sheet_url`` must be supplied.
        link_column: Name of the column header in the spreadsheet that contains
            Google Drive links to resume files.  Defaults to ``"resume_link"``.
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
    link_column: str | None = Field(
        default=None,
        description=(
            "Column header in the spreadsheet that contains Drive links.  "
            "Defaults to the service-level 'sheets_link_column' setting."
        ),
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional extra metadata attached to every ingested resume document.",
    )

    @model_validator(mode="after")
    def require_sheet_id_or_url(self) -> "IngestRequest":
        """Validate that at least one of sheet_id or sheet_url is provided.

        Returns:
            The validated model instance.

        Raises:
            ValueError: If neither ``sheet_id`` nor ``sheet_url`` is provided.
        """
        if not self.sheet_id and not self.sheet_url:
            raise ValueError("Either 'sheet_id' or 'sheet_url' must be provided.")
        return self


class IngestResponse(BaseModel):
    """Response body for the ``POST /api/v1/ingest`` endpoint.

    Attributes:
        ingested: Number of resumes successfully ingested.
        errors: List of row-level errors encountered during ingestion.
    """

    ingested: int = Field(..., description="Number of resumes successfully ingested.")
    errors: list[IngestRowError] = Field(
        default_factory=list,
        description="Row-level errors encountered during ingestion.",
    )
