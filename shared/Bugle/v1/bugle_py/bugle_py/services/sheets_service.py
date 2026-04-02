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
        column_header: str | None = None,
        sheet_name: str | None = None,
        *,
        column_index: int | None = None,
        has_header_row: bool = True,
        extract_hyperlinks: bool = False,
    ) -> list[tuple[int, str]]:
        """Return all non-empty values from a specified column.

        When ``has_header_row`` is ``True`` (the default), the first row is
        treated as a header.  Pass ``column_header`` to find the column by its
        header label, or ``column_index`` (1-based) to select it by position.

        When ``has_header_row`` is ``False``, pass ``column_index`` (1-based)
        to select the column.  All rows are treated as data rows.

        When ``extract_hyperlinks`` is ``True``, the method uses the
        ``spreadsheets.get`` API (instead of ``values.get``) so it can detect
        hyperlinks embedded in cells (e.g. badge-style links that display
        user-friendly text but carry a Drive URL).  For each data cell the
        embedded hyperlink URL is returned when present; otherwise the
        formatted cell text is used.

        Args:
            spreadsheet_id: The Google Sheets file ID.
            column_header: The header label of the column to read.  Used when
                ``has_header_row`` is ``True``.  Mutually exclusive with
                ``column_index`` for header-based lookup.
            sheet_name: Optional sheet (tab) name.  Defaults to the first
                sheet when ``None``.
            column_index: 1-based column number.  Required when
                ``has_header_row`` is ``False``; can also be used instead of
                ``column_header`` when ``has_header_row`` is ``True``.
            has_header_row: Whether the first row contains column headers.
                Defaults to ``True``.
            extract_hyperlinks: When ``True``, embedded cell hyperlinks are
                extracted and preferred over plain text values.  This enables
                reading Drive links from badge-style cells.  Defaults to
                ``False``.

        Returns:
            A list of ``(row_number, value)`` tuples for each non-empty cell
            in the target column.  Row numbers are 1-based.  When
            ``has_header_row`` is ``True`` the header row is excluded
            (data starts at row 2).

        Raises:
            ValueError: If the sheet is empty, the column cannot be located,
                or required arguments are missing.
            Exception: If the Sheets API call fails.
        """
        if extract_hyperlinks:
            return self._get_column_values_with_hyperlinks(
                spreadsheet_id=spreadsheet_id,
                column_header=column_header,
                sheet_name=sheet_name,
                column_index=column_index,
                has_header_row=has_header_row,
            )

        rows = self.get_all_rows(spreadsheet_id, sheet_name)
        if not rows:
            raise ValueError(f"Sheet '{spreadsheet_id}' appears to be empty.")

        col_idx = self._resolve_column_index(
            rows=rows,
            column_header=column_header,
            column_index=column_index,
            has_header_row=has_header_row,
            spreadsheet_id=spreadsheet_id,
        )

        if has_header_row:
            data_rows = rows[1:]
            start_row = 2
        else:
            data_rows = rows
            start_row = 1

        result: list[tuple[int, str]] = []
        for row_offset, row in enumerate(data_rows):
            row_number = start_row + row_offset
            if col_idx < len(row) and row[col_idx].strip():
                result.append((row_number, row[col_idx].strip()))

        logger.debug(
            "Extracted column values",
            extra={
                "spreadsheet_id": spreadsheet_id,
                "column_header": column_header,
                "column_index": column_index,
                "value_count": len(result),
            },
        )
        return result

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _resolve_column_index(
        self,
        rows: list[list[str]],
        column_header: str | None,
        column_index: int | None,
        has_header_row: bool,
        spreadsheet_id: str,
    ) -> int:
        """Return the 0-based column index to read.

        Args:
            rows: All rows from the sheet (first row is header when applicable).
            column_header: Header label to search for.
            column_index: 1-based column position (used as fallback or primary
                when ``has_header_row`` is ``False``).
            has_header_row: Whether the first row is a header.
            spreadsheet_id: Spreadsheet ID (used in error messages).

        Returns:
            0-based column index.

        Raises:
            ValueError: If the column cannot be resolved.
        """
        if not has_header_row:
            if column_index is None:
                raise ValueError(
                    "'column_index' is required when 'has_header_row' is False."
                )
            return column_index - 1

        # has_header_row=True
        if column_header is not None:
            header_row = [cell.strip().lower() for cell in rows[0]]
            target = column_header.strip().lower()
            if target not in header_row:
                raise ValueError(
                    f"Column '{column_header}' not found in sheet '{spreadsheet_id}'. "
                    f"Available columns: {rows[0]}"
                )
            return header_row.index(target)

        if column_index is not None:
            return column_index - 1

        raise ValueError(
            "Either 'column_header' or 'column_index' must be provided."
        )

    def _get_column_values_with_hyperlinks(
        self,
        spreadsheet_id: str,
        column_header: str | None,
        sheet_name: str | None,
        column_index: int | None,
        has_header_row: bool,
    ) -> list[tuple[int, str]]:
        """Fetch column values using the ``spreadsheets.get`` API.

        This variant retrieves both the formatted cell text and any embedded
        hyperlink for each cell.  When a hyperlink is present it is preferred
        over the plain text, enabling reading of badge-style cells that display
        human-friendly text but embed a Drive URL.

        The header row (when present) is always matched by its formatted text
        value, never by its hyperlink.

        Args:
            spreadsheet_id: The Google Sheets file ID.
            column_header: Header label identifying the target column (used
                when ``has_header_row`` is ``True``).
            sheet_name: Optional sheet (tab) name.
            column_index: 1-based column position (used when
                ``has_header_row`` is ``False``, or as fallback when
                ``column_header`` is ``None``).
            has_header_row: Whether the first row is a header.

        Returns:
            A list of ``(row_number, url_or_text)`` tuples.

        Raises:
            ValueError: If the sheet is empty or the column cannot be located.
            Exception: If the Sheets API call fails.
        """
        range_notation = f"'{sheet_name}'!A:ZZ" if sheet_name else "A:ZZ"

        logger.debug(
            "Fetching column values with hyperlinks from Google Sheet",
            extra={"spreadsheet_id": spreadsheet_id, "range": range_notation},
        )

        response: dict[str, Any] = (
            self._service.spreadsheets()
            .get(
                spreadsheetId=spreadsheet_id,
                ranges=[range_notation],
                includeGridData=True,
                fields=(
                    "sheets/data/rowData/values/hyperlink,"
                    "sheets/data/rowData/values/formattedValue"
                ),
            )
            .execute()
        )

        sheets_list: list[dict[str, Any]] = response.get("sheets", [])
        if not sheets_list:
            raise ValueError(f"Sheet '{spreadsheet_id}' appears to be empty.")

        grid_data = sheets_list[0].get("data", [{}])[0]
        row_data: list[dict[str, Any]] = grid_data.get("rowData", [])

        if not row_data:
            raise ValueError(f"Sheet '{spreadsheet_id}' appears to be empty.")

        # Build plain-text rows (header matching always uses plain text).
        text_rows: list[list[str]] = [
            [cell.get("formattedValue", "") for cell in row.get("values", [])]
            for row in row_data
        ]

        col_idx = self._resolve_column_index(
            rows=text_rows,
            column_header=column_header,
            column_index=column_index,
            has_header_row=has_header_row,
            spreadsheet_id=spreadsheet_id,
        )

        if has_header_row:
            data_rows = row_data[1:]
            start_row = 2
        else:
            data_rows = row_data
            start_row = 1

        result: list[tuple[int, str]] = []
        for row_offset, row in enumerate(data_rows):
            row_number = start_row + row_offset
            cells = row.get("values", [])
            if col_idx >= len(cells):
                continue
            cell = cells[col_idx]
            # Prefer embedded hyperlink URL; fall back to formatted text.
            value = (cell.get("hyperlink") or cell.get("formattedValue") or "").strip()
            if value:
                result.append((row_number, value))

        logger.debug(
            "Extracted column values with hyperlinks",
            extra={
                "spreadsheet_id": spreadsheet_id,
                "column_header": column_header,
                "column_index": column_index,
                "value_count": len(result),
            },
        )
        return result
