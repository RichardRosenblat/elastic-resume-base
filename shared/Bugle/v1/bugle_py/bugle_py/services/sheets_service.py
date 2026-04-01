"""Google Sheets service for reading spreadsheet data."""

from __future__ import annotations

import logging
import re
from typing import Any

from bugle_py.auth import SHEETS_READONLY_SCOPES, get_google_auth_client

logger = logging.getLogger(__name__)

#: Pattern that matches a Google Drive file URL and captures the file ID.
_DRIVE_URL_PATTERN = re.compile(
    r"https://(?:drive|docs)\.google\.com/(?:file/d/|open\?id=|spreadsheets/d/|uc\?(?:export=\w+&)?id=)"
    r"([A-Za-z0-9_\-]{25,})"
)


def extract_drive_id(value: str) -> str | None:
    """Extract a Google Drive file ID from a URL or return ``None``.

    Recognises the common Drive URL formats:
    - ``https://drive.google.com/file/d/<ID>/...``
    - ``https://drive.google.com/open?id=<ID>``
    - ``https://drive.google.com/uc?id=<ID>``
    - ``https://docs.google.com/spreadsheets/d/<ID>/...``

    If *value* already looks like a bare ID (no ``/`` or ``?``) it is returned
    as-is.

    Args:
        value: A Google Drive URL or bare file ID.

    Returns:
        The extracted Drive file ID, or ``None`` if the value cannot be parsed.
    """
    value = value.strip()
    if not value:
        return None

    match = _DRIVE_URL_PATTERN.search(value)
    if match:
        return match.group(1)

    # Treat plain IDs (alphanumeric + dash/underscore, 25+ chars) as valid.
    if re.fullmatch(r"[A-Za-z0-9_\-]{25,}", value):
        return value

    return None


class SheetsService:
    """Service for reading data from Google Sheets.

    Uses the **Google Sheets API v4** to retrieve spreadsheet values.

    Example::

        from bugle_py import SheetsService

        service = SheetsService()
        rows = service.get_all_rows(spreadsheet_id="1BxiMVs0XRA5nFMd...")
        links = service.get_column_values(
            spreadsheet_id="1BxiMVs0XRA5nFMd...", column_header="resume_link"
        )
    """

    def __init__(
        self,
        credentials: object | None = None,
    ) -> None:
        """Initialise the Sheets service.

        Args:
            credentials: Optional pre-configured credentials object.  Defaults
                to a service-account client loaded from the
                ``GOOGLE_SERVICE_ACCOUNT_KEY`` environment variable.
        """
        try:
            from googleapiclient.discovery import build  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ImportError(
                "The 'google-api-python-client' package is required for SheetsService. "
                "Install it with: pip install google-api-python-client"
            ) from exc

        resolved_credentials = credentials or get_google_auth_client(SHEETS_READONLY_SCOPES)
        self._service = build("sheets", "v4", credentials=resolved_credentials)
        logger.debug("SheetsService initialised")

    def get_all_rows(
        self,
        spreadsheet_id: str,
        sheet_name: str | None = None,
    ) -> list[list[str]]:
        """Retrieve all rows from a Google Sheet.

        The first row is assumed to be a header row and is included in the
        returned list (at index 0).

        Args:
            spreadsheet_id: The Google Sheets file ID.
            sheet_name: Optional sheet (tab) name.  Defaults to the first
                sheet when ``None``.

        Returns:
            A list of rows; each row is a list of cell values as strings.
            Empty trailing cells in a row are omitted by the API.

        Raises:
            Exception: If the Sheets API call fails.
        """
        range_notation = sheet_name or "A:ZZ"
        logger.debug(
            "Fetching all rows from Google Sheet",
            extra={"spreadsheet_id": spreadsheet_id, "range": range_notation},
        )
        result: dict[str, Any] = (
            self._service.spreadsheets()
            .values()
            .get(spreadsheetId=spreadsheet_id, range=range_notation)
            .execute()
        )
        rows: list[list[str]] = result.get("values", [])
        logger.debug(
            "Fetched rows from Google Sheet",
            extra={"spreadsheet_id": spreadsheet_id, "row_count": len(rows)},
        )
        return rows

    def get_column_values(
        self,
        spreadsheet_id: str,
        column_header: str,
        sheet_name: str | None = None,
    ) -> list[tuple[int, str]]:
        """Return all non-empty values from the column identified by *column_header*.

        The first row of the sheet is treated as a header row.  The method
        searches the header row for a cell matching *column_header*
        (case-insensitive) and returns the values of that column for all
        subsequent rows, together with their 1-based row numbers.

        Args:
            spreadsheet_id: The Google Sheets file ID.
            column_header: The header label of the column to read.
            sheet_name: Optional sheet (tab) name.  Defaults to the first
                sheet when ``None``.

        Returns:
            A list of ``(row_number, value)`` tuples for each non-empty cell
            in the target column (excluding the header row).  Row numbers are
            1-based (header row = row 1).

        Raises:
            ValueError: If the sheet is empty or the *column_header* is not found.
            Exception: If the Sheets API call fails.
        """
        rows = self.get_all_rows(spreadsheet_id, sheet_name)
        if not rows:
            raise ValueError(f"Sheet '{spreadsheet_id}' appears to be empty.")

        header_row = [cell.strip().lower() for cell in rows[0]]
        target = column_header.strip().lower()
        if target not in header_row:
            raise ValueError(
                f"Column '{column_header}' not found in sheet '{spreadsheet_id}'. "
                f"Available columns: {rows[0]}"
            )
        col_index = header_row.index(target)

        result: list[tuple[int, str]] = []
        for row_index, row in enumerate(rows[1:], start=2):  # data starts at row 2
            if col_index < len(row) and row[col_index].strip():
                result.append((row_index, row[col_index].strip()))

        logger.debug(
            "Extracted column values",
            extra={
                "spreadsheet_id": spreadsheet_id,
                "column": column_header,
                "value_count": len(result),
            },
        )
        return result
