"""Unit tests for the SheetsService."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.services.sheets_service import SheetsService


def _make_service(rows: list[list[str]]) -> SheetsService:
    """Build a SheetsService backed by a mock that returns ``rows``."""
    mock_client = MagicMock()
    (
        mock_client.spreadsheets()
        .values()
        .get()
        .execute.return_value
    ) = {"values": rows}
    return SheetsService(sheets_client=mock_client)


class TestSheetsServiceGetResumeRows:
    """Tests for SheetsService.get_resume_rows."""

    def test_returns_empty_list_when_no_data(self) -> None:
        """Returns an empty list when the sheet has no values."""
        mock_client = MagicMock()
        mock_client.spreadsheets().values().get().execute.return_value = {}
        svc = SheetsService(sheets_client=mock_client)
        result = svc.get_resume_rows(sheet_id="sheet-1")
        assert result == []

    def test_returns_empty_list_when_only_header_row(self) -> None:
        """Returns an empty list when only the header row is present."""
        svc = _make_service([["fileId", "candidateName"]])
        result = svc.get_resume_rows(sheet_id="sheet-1")
        assert result == []

    def test_maps_header_to_row_values(self) -> None:
        """Returns dicts keyed by the header row."""
        svc = _make_service(
            [
                ["fileId", "candidateName"],
                ["file-abc", "Alice"],
            ]
        )
        result = svc.get_resume_rows(sheet_id="sheet-1")
        assert result == [{"fileId": "file-abc", "candidateName": "Alice"}]

    def test_returns_multiple_rows(self) -> None:
        """All data rows are returned."""
        svc = _make_service(
            [
                ["fileId"],
                ["file-1"],
                ["file-2"],
                ["file-3"],
            ]
        )
        result = svc.get_resume_rows(sheet_id="sheet-1")
        assert len(result) == 3

    def test_skips_blank_rows(self) -> None:
        """Rows consisting entirely of empty strings are skipped."""
        svc = _make_service(
            [
                ["fileId", "candidateName"],
                ["", ""],  # blank row
                ["file-1", "Bob"],
            ]
        )
        result = svc.get_resume_rows(sheet_id="sheet-1")
        assert len(result) == 1
        assert result[0]["fileId"] == "file-1"

    def test_passes_sheet_id_and_range_to_api(self) -> None:
        """The sheet_id and range are forwarded to the Sheets API."""
        mock_client = MagicMock()
        mock_client.spreadsheets().values().get().execute.return_value = {}
        svc = SheetsService(sheets_client=mock_client)
        svc.get_resume_rows(sheet_id="my-sheet", sheet_range="Data!A:Z")
        mock_client.spreadsheets().values().get.assert_called_with(
            spreadsheetId="my-sheet", range="Data!A:Z"
        )
