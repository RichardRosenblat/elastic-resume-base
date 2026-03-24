"""Google Sheets integration — fetches resume metadata rows from a spreadsheet."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# The expected column header names in the Google Sheet.
# The sheet must have a header row; column order does not matter.
_COL_FILE_ID = "fileId"
_COL_CANDIDATE_NAME = "candidateName"
_COL_POSITION = "position"


class SheetsService:
    """Reads resume metadata from a Google Sheets spreadsheet.

    The sheet must contain a header row with at least a ``fileId`` column that
    holds the corresponding Google Drive file ID for each resume.

    Example:
        >>> from googleapiclient.discovery import build  # type: ignore[import-untyped]
        >>> service_obj = build("sheets", "v4", credentials=creds)
        >>> sheets = SheetsService(sheets_client=service_obj)
        >>> rows = sheets.get_resume_rows(sheet_id="1BxiMVs0...", sheet_range="Sheet1!A:Z")
    """

    def __init__(self, sheets_client: Any) -> None:
        """Initialise the service.

        Args:
            sheets_client: A ``googleapiclient.discovery.Resource`` object for
                the Sheets API v4 (``build("sheets", "v4", ...)``) or a mock
                with the same interface.
        """
        self._client = sheets_client

    def get_resume_rows(
        self, sheet_id: str, sheet_range: str = "Sheet1!A:Z"
    ) -> list[dict[str, str]]:
        """Fetch all resume rows from a spreadsheet.

        The first row of the range is treated as a header row.  Each subsequent
        row is returned as a dict keyed by header name.

        Args:
            sheet_id: The Google Sheets file ID (the long alphanumeric string
                in the Sheet URL).
            sheet_range: A1 notation range to read.  Defaults to
                ``"Sheet1!A:Z"`` (all columns in the first sheet).

        Returns:
            A list of dicts, one per data row.  Each dict maps header names to
            cell values.  Empty rows are skipped.

        Raises:
            googleapiclient.errors.HttpError: If the Sheets API returns an
                error (e.g. the file does not exist or credentials lack access).
        """
        logger.debug(
            "Fetching rows from sheet '%s', range '%s'.",
            sheet_id,
            sheet_range,
        )
        result = (
            self._client.spreadsheets()
            .values()
            .get(spreadsheetId=sheet_id, range=sheet_range)
            .execute()
        )
        values: list[list[str]] = result.get("values", [])
        if not values:
            logger.info("Sheet '%s' contains no data.", sheet_id)
            return []

        headers = values[0]
        rows: list[dict[str, str]] = []
        for raw_row in values[1:]:
            if not any(cell.strip() for cell in raw_row):
                continue  # skip blank rows
            row_dict = dict(zip(headers, raw_row))
            rows.append(row_dict)

        logger.debug(
            "Fetched %d data rows from sheet '%s'.",
            len(rows),
            sheet_id,
        )
        return rows
