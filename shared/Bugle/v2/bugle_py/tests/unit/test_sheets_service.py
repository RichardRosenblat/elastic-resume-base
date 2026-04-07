"""Unit tests for SheetsService._get_column_values_with_hyperlinks."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock


def _build_sheets_service(api_response: dict[str, Any]) -> Any:
    """Return a :class:`~bugle_py.SheetsService` with a mocked Sheets API."""
    from bugle_py.services.sheets_service import SheetsService

    mock_service = MagicMock()
    (
        mock_service.spreadsheets()
        .get()
        .execute.return_value
    ) = api_response

    svc = SheetsService.__new__(SheetsService)
    svc._service = mock_service
    return svc


def _make_response(rows: list[list[dict[str, Any]]]) -> dict[str, Any]:
    """Wrap *rows* in a minimal Sheets API spreadsheets.get response."""
    return {
        "sheets": [
            {
                "data": [
                    {
                        "rowData": [
                            {"values": row} for row in rows
                        ]
                    }
                ]
            }
        ]
    }


# ---------------------------------------------------------------------------
# Standard hyperlink (right-click → Insert link)
# ---------------------------------------------------------------------------


def test_standard_hyperlink_is_returned() -> None:
    """A cell with a standard hyperlink returns the hyperlink URL."""
    response = _make_response([
        [{"formattedValue": "resume_link"}],
        [{"formattedValue": "My Resume", "hyperlink": "https://drive.google.com/file/d/abc123/view"}],
    ])
    svc = _build_sheets_service(response)
    result = svc._get_column_values_with_hyperlinks(
        spreadsheet_id="sheet1",
        column_header="resume_link",
        sheet_name=None,
        column_index=None,
        has_header_row=True,
    )
    assert result == [(2, "https://drive.google.com/file/d/abc123/view")]


# ---------------------------------------------------------------------------
# Plain text (no hyperlink, no chip)
# ---------------------------------------------------------------------------


def test_plain_text_returned_when_no_hyperlink_or_chip() -> None:
    """A plain-text cell (no link) returns the formattedValue."""
    response = _make_response([
        [{"formattedValue": "resume_link"}],
        [{"formattedValue": "https://drive.google.com/file/d/xyz/view"}],
    ])
    svc = _build_sheets_service(response)
    result = svc._get_column_values_with_hyperlinks(
        spreadsheet_id="sheet1",
        column_header="resume_link",
        sheet_name=None,
        column_index=None,
        has_header_row=True,
    )
    assert result == [(2, "https://drive.google.com/file/d/xyz/view")]


# ---------------------------------------------------------------------------
# Smart Chip / embedded badge (chipRuns)
# ---------------------------------------------------------------------------


def test_smart_chip_url_is_preferred_over_formatted_text() -> None:
    """A cell with a Smart Chip badge returns the chip URI, not the display text."""
    chip_url = "https://drive.google.com/file/d/chip_file_id/view"
    response = _make_response([
        [{"formattedValue": "resume_link"}],
        [
            {
                "formattedValue": "Candidate Resume.pdf",
                "chipRuns": [
                    {
                        "chip": {
                            "richLinkProperties": {
                                "uri": chip_url,
                            }
                        }
                    }
                ],
            }
        ],
    ])
    svc = _build_sheets_service(response)
    result = svc._get_column_values_with_hyperlinks(
        spreadsheet_id="sheet1",
        column_header="resume_link",
        sheet_name=None,
        column_index=None,
        has_header_row=True,
    )
    assert result == [(2, chip_url)]


def test_smart_chip_url_preferred_over_standard_hyperlink() -> None:
    """When both a Smart Chip and a standard hyperlink are present, the chip URI wins."""
    chip_url = "https://drive.google.com/file/d/chip_id/view"
    hyperlink_url = "https://drive.google.com/file/d/hyperlink_id/view"
    response = _make_response([
        [{"formattedValue": "resume_link"}],
        [
            {
                "formattedValue": "Resume",
                "hyperlink": hyperlink_url,
                "chipRuns": [
                    {
                        "chip": {
                            "richLinkProperties": {
                                "uri": chip_url,
                            }
                        }
                    }
                ],
            }
        ],
    ])
    svc = _build_sheets_service(response)
    result = svc._get_column_values_with_hyperlinks(
        spreadsheet_id="sheet1",
        column_header="resume_link",
        sheet_name=None,
        column_index=None,
        has_header_row=True,
    )
    assert result == [(2, chip_url)]


def test_chip_run_without_uri_falls_back_to_hyperlink() -> None:
    """A chipRun with no uri falls back to the standard hyperlink."""
    hyperlink_url = "https://drive.google.com/file/d/hyperlink_id/view"
    response = _make_response([
        [{"formattedValue": "resume_link"}],
        [
            {
                "formattedValue": "Resume",
                "hyperlink": hyperlink_url,
                "chipRuns": [
                    {
                        "chip": {
                            "richLinkProperties": {}
                        }
                    }
                ],
            }
        ],
    ])
    svc = _build_sheets_service(response)
    result = svc._get_column_values_with_hyperlinks(
        spreadsheet_id="sheet1",
        column_header="resume_link",
        sheet_name=None,
        column_index=None,
        has_header_row=True,
    )
    assert result == [(2, hyperlink_url)]


def test_multiple_chip_runs_uses_first_uri() -> None:
    """When multiple chipRuns are present, the first URI is used."""
    first_url = "https://drive.google.com/file/d/first/view"
    second_url = "https://drive.google.com/file/d/second/view"
    response = _make_response([
        [{"formattedValue": "resume_link"}],
        [
            {
                "formattedValue": "Resume",
                "chipRuns": [
                    {"chip": {"richLinkProperties": {"uri": first_url}}},
                    {"chip": {"richLinkProperties": {"uri": second_url}}},
                ],
            }
        ],
    ])
    svc = _build_sheets_service(response)
    result = svc._get_column_values_with_hyperlinks(
        spreadsheet_id="sheet1",
        column_header="resume_link",
        sheet_name=None,
        column_index=None,
        has_header_row=True,
    )
    assert result == [(2, first_url)]


# ---------------------------------------------------------------------------
# Empty / missing cells
# ---------------------------------------------------------------------------


def test_empty_cell_is_excluded() -> None:
    """A cell with no value is excluded from the result."""
    response = _make_response([
        [{"formattedValue": "resume_link"}],
        [{"formattedValue": ""}],
        [{"formattedValue": "https://drive.google.com/file/d/abc/view"}],
    ])
    svc = _build_sheets_service(response)
    result = svc._get_column_values_with_hyperlinks(
        spreadsheet_id="sheet1",
        column_header="resume_link",
        sheet_name=None,
        column_index=None,
        has_header_row=True,
    )
    assert len(result) == 1
    assert result[0][0] == 3  # row 3
