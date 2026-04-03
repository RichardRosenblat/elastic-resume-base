"""Unit tests for get_google_auth_client (v2 — ADC-based)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from bugle_py.auth import DRIVE_READONLY_SCOPES, SHEETS_READONLY_SCOPES, get_google_auth_client


class TestGetGoogleAuthClient:
    """Tests for :func:`bugle_py.auth.get_google_auth_client`."""

    def test_uses_adc_by_default(self) -> None:
        """When no credentials are provided, ADC is used via google.auth.default."""
        mock_creds = MagicMock()
        with patch("bugle_py.auth.google.auth.default", return_value=(mock_creds, "project")) as mock_default:
            result = get_google_auth_client()

        mock_default.assert_called_once_with(scopes=list(DRIVE_READONLY_SCOPES))
        assert result is mock_creds

    def test_uses_adc_with_custom_scopes(self) -> None:
        """ADC is called with the provided scopes."""
        mock_creds = MagicMock()
        with patch("bugle_py.auth.google.auth.default", return_value=(mock_creds, "project")) as mock_default:
            result = get_google_auth_client(SHEETS_READONLY_SCOPES)

        mock_default.assert_called_once_with(scopes=list(SHEETS_READONLY_SCOPES))
        assert result is mock_creds

    def test_returns_explicit_credentials_without_calling_adc(self) -> None:
        """When explicit credentials are provided, ADC is not called."""
        explicit_creds = MagicMock()
        with patch("bugle_py.auth.google.auth.default") as mock_default:
            result = get_google_auth_client(credentials=explicit_creds)

        mock_default.assert_not_called()
        assert result is explicit_creds

    def test_explicit_credentials_ignore_scopes_parameter(self) -> None:
        """When explicit credentials are provided, the scopes parameter is ignored."""
        explicit_creds = MagicMock()
        with patch("bugle_py.auth.google.auth.default") as mock_default:
            result = get_google_auth_client(scopes=SHEETS_READONLY_SCOPES, credentials=explicit_creds)

        mock_default.assert_not_called()
        assert result is explicit_creds

    def test_adc_error_propagates(self) -> None:
        """If ADC fails, the error is propagated to the caller."""
        import google.auth.exceptions

        with patch(
            "bugle_py.auth.google.auth.default",
            side_effect=google.auth.exceptions.DefaultCredentialsError("no credentials"),
        ):
            with pytest.raises(google.auth.exceptions.DefaultCredentialsError):
                get_google_auth_client()
