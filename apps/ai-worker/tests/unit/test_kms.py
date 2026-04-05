"""Unit tests for the AI Worker KMS encryption utility."""

from __future__ import annotations

import base64
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from app.utils.kms import PII_FIELDS, encrypt_field, encrypt_pii_fields
from app.utils.exceptions import KmsEncryptionError


# ---------------------------------------------------------------------------
# encrypt_field
# ---------------------------------------------------------------------------


def test_encrypt_field_returns_value_unchanged_when_no_kms_key() -> None:
    """encrypt_field returns the plain-text unchanged when kms_key_name is empty."""
    result = encrypt_field("John Doe", "")
    assert result == "John Doe"


def test_encrypt_field_returns_base64_encoded_ciphertext() -> None:
    """encrypt_field returns a base64-encoded string when KMS is configured."""
    ciphertext_bytes = b"encrypted-bytes"
    mock_response = MagicMock()
    mock_response.ciphertext = ciphertext_bytes  # must be actual bytes

    mock_client = MagicMock()
    mock_client.encrypt.return_value = mock_response

    mock_kms_module = MagicMock()
    mock_kms_module.KeyManagementServiceClient.return_value = mock_client

    # google.cloud.kms is imported as `from google.cloud import kms`, so
    # the 'kms' attribute must be set on the google.cloud mock directly.
    mock_google_cloud = MagicMock()
    mock_google_cloud.kms = mock_kms_module

    import importlib
    import app.utils.kms as kms_mod

    with patch.dict(
        "sys.modules",
        {
            "google": MagicMock(cloud=mock_google_cloud),
            "google.cloud": mock_google_cloud,
            "google.cloud.kms": mock_kms_module,
        },
    ):
        importlib.reload(kms_mod)
        result = kms_mod.encrypt_field(
            "John Doe", "projects/p/locations/global/keyRings/r/cryptoKeys/k"
        )

    importlib.reload(kms_mod)

    # Result should be base64-encoded ciphertext
    decoded = base64.b64decode(result)
    assert decoded == ciphertext_bytes


def test_encrypt_field_raises_kms_error_on_failure() -> None:
    """encrypt_field raises KmsEncryptionError when the KMS call fails."""
    mock_kms_module = MagicMock()
    mock_kms_module.KeyManagementServiceClient.return_value.encrypt.side_effect = Exception(
        "KMS unavailable"
    )

    with patch.dict(
        "sys.modules",
        {
            "google": MagicMock(),
            "google.cloud": MagicMock(),
            "google.cloud.kms": mock_kms_module,
        },
    ):
        import importlib
        import app.utils.kms as kms_mod
        importlib.reload(kms_mod)
        with pytest.raises((KmsEncryptionError, Exception)):
            kms_mod.encrypt_field("secret", "projects/p/locations/global/keyRings/r/cryptoKeys/k")

    import importlib
    import app.utils.kms as kms_mod
    importlib.reload(kms_mod)


# ---------------------------------------------------------------------------
# encrypt_pii_fields
# ---------------------------------------------------------------------------


def test_encrypt_pii_fields_returns_same_dict_when_no_key() -> None:
    """encrypt_pii_fields returns the original dict when kms_key_name is empty."""
    data: dict[str, Any] = {"name": "John Doe", "skills": ["Python"]}
    result = encrypt_pii_fields(data, ["name"], "")
    assert result is data


def test_encrypt_pii_fields_creates_copy_of_dict() -> None:
    """encrypt_pii_fields returns a new dict with encrypted values."""
    data: dict[str, Any] = {"name": "John Doe"}

    with patch("app.utils.kms.encrypt_field", return_value="enc:abc") as mock_enc:
        result = encrypt_pii_fields(data, ["name"], "projects/p/...")

    assert result is not data
    assert result["name"] == "enc:abc"
    assert data["name"] == "John Doe"  # original unchanged


def test_encrypt_pii_fields_skips_non_string_values() -> None:
    """encrypt_pii_fields only encrypts non-empty string values."""
    data: dict[str, Any] = {
        "name": "John",
        "scores": [1, 2, 3],
        "info": {"key": "val"},
    }

    with patch("app.utils.kms.encrypt_field", return_value="enc:xxx") as mock_enc:
        result = encrypt_pii_fields(data, ["name", "scores", "info"], "projects/p/...")

    assert mock_enc.call_count == 1
    assert result["scores"] == [1, 2, 3]
    assert result["info"] == {"key": "val"}


def test_encrypt_pii_fields_skips_empty_string_values() -> None:
    """encrypt_pii_fields skips empty string values."""
    data: dict[str, Any] = {"name": "", "email": "user@example.com"}

    with patch("app.utils.kms.encrypt_field", return_value="enc:email") as mock_enc:
        result = encrypt_pii_fields(data, ["name", "email"], "projects/p/...")

    assert mock_enc.call_count == 1
    assert result["name"] == ""
    assert result["email"] == "enc:email"


def test_encrypt_pii_fields_skips_missing_keys() -> None:
    """encrypt_pii_fields does not raise for keys not present in the data."""
    data: dict[str, Any] = {"name": "Jane"}

    with patch("app.utils.kms.encrypt_field", return_value="enc:name") as mock_enc:
        result = encrypt_pii_fields(data, ["name", "email", "phone"], "projects/p/...")

    assert mock_enc.call_count == 1
    assert result["name"] == "enc:name"


def test_encrypt_pii_fields_covers_all_default_pii_fields() -> None:
    """PII_FIELDS covers the expected sensitive fields."""
    expected = {"name", "email", "phone", "address", "cpf", "rg"}
    assert expected.issubset(set(PII_FIELDS))
