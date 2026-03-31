"""Bugle — shared Google API client library for Elastic Resume Base Python services.

Mirrors the TypeScript ``@elastic-resume-base/bugle`` package so that all
Python services can authenticate with Google APIs and interact with Google
Sheets and Drive using a consistent interface.

Quick start::

    from bugle_py import get_google_auth_client, DRIVE_READONLY_SCOPES

    auth = get_google_auth_client(DRIVE_READONLY_SCOPES)

Services::

    from bugle_py import SheetsService, DriveService

    sheets = SheetsService()
    links = sheets.get_column_values(spreadsheet_id="<ID>", column_header="resume_link")

    drive = DriveService()
    content = drive.download_file(file_id="<FILE_ID>")
"""

from bugle_py.auth import DRIVE_READONLY_SCOPES, SHEETS_READONLY_SCOPES, get_google_auth_client
from bugle_py.services.drive_service import DriveService
from bugle_py.services.sheets_service import SheetsService

__all__ = [
    # Auth
    "get_google_auth_client",
    "DRIVE_READONLY_SCOPES",
    "SHEETS_READONLY_SCOPES",
    # Services
    "SheetsService",
    "DriveService",
]
