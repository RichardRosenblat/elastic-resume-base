"""Pydantic request / response models for the Ingestor Service."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, model_validator


class IngestRequest(BaseModel):
    """Request body for ``POST /ingest``.

    At least one of ``sheet_id`` or ``batch_id`` must be supplied.

    Attributes:
        sheet_id: Google Sheets file ID to ingest resumes from.
        batch_id: Identifier of a pre-defined ingestion batch.
        metadata: Arbitrary key/value pairs to attach to the ingest job.
    """

    sheet_id: str | None = None
    batch_id: str | None = None
    metadata: dict[str, Any] | None = None

    @model_validator(mode="after")
    def require_sheet_or_batch(self) -> "IngestRequest":
        """Ensure at least one of sheet_id or batch_id is provided."""
        if not self.sheet_id and not self.batch_id:
            raise ValueError("Either sheet_id or batch_id must be provided")
        return self

    model_config = {"populate_by_name": True}


class IngestResponse(BaseModel):
    """Response body for ``POST /ingest``.

    Fields are serialised using camelCase aliases so that the response matches
    the TypeScript ``IngestResponse`` interface consumed by the BFF Gateway.

    Attributes:
        job_id: Unique identifier for the submitted ingest job.
        status: Current status of the ingest job (always ``"accepted"``).
        accepted_at: ISO-8601 timestamp when the job was accepted.
    """

    job_id: str = Field(serialization_alias="jobId")
    status: str
    accepted_at: str = Field(serialization_alias="acceptedAt")

    model_config = {"populate_by_name": True}

    def to_response_dict(self) -> dict[str, Any]:
        """Serialise to a camelCase dict suitable for the API response."""
        return self.model_dump(by_alias=True)
