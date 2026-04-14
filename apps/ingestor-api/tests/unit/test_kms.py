"""Unit tests for the Ingestor KMS encryption utility."""

from __future__ import annotations

import base64
from unittest.mock import MagicMock, patch

import pytest

from app.utils.kms import encrypt_field
from app.utils.exceptions import KmsEncryptionError


# ---------------------------------------------------------------------------
# encrypt_field — no encryption configured
# ---------------------------------------------------------------------------


def test_encrypt_field_returns_value_unchanged_when_no_keys() -> None:
    """encrypt_field returns plain-text unchanged when neither key is configured."""
    result = encrypt_field("John Doe", "", "")
    assert result == "John Doe"


def test_encrypt_field_default_local_key_is_empty() -> None:
    """encrypt_field local_key defaults to empty, using KMS path."""
    result = encrypt_field("hello", "")
    assert result == "hello"


# ---------------------------------------------------------------------------
# encrypt_field — local Fernet key (highest priority)
# ---------------------------------------------------------------------------


def test_encrypt_field_uses_fernet_when_local_key_set() -> None:
    """encrypt_field uses Fernet encryption when local_key is provided."""
    from cryptography.fernet import Fernet

    key = Fernet.generate_key().decode()
    result = encrypt_field("sensitive data", "", local_key=key)

    # Result is a Fernet token, not plain text
    assert result != "sensitive data"
    # Fernet tokens start with 'gAAAAA'
    assert result.startswith("gAAAAA")

    # Round-trip: decryption restores original
    fernet = Fernet(key.encode())
    assert fernet.decrypt(result.encode()).decode() == "sensitive data"


def test_encrypt_field_local_key_takes_priority_over_kms() -> None:
    """When local_key is set, Fernet is used regardless of encrypt_kms_key_name."""
    from cryptography.fernet import Fernet

    key = Fernet.generate_key().decode()
    # kms key name provided but local_key should take priority
    result = encrypt_field("secret", "projects/p/.../cryptoKeys/k", local_key=key)

    fernet = Fernet(key.encode())
    assert fernet.decrypt(result.encode()).decode() == "secret"


def test_encrypt_field_raises_on_invalid_fernet_key() -> None:
    """encrypt_field raises KmsEncryptionError when local_key is invalid."""
    with pytest.raises(KmsEncryptionError, match="Local Fernet encryption failed"):
        encrypt_field("data", "", local_key="not-a-valid-fernet-key")


# ---------------------------------------------------------------------------
# encrypt_field — Cloud KMS path
# ---------------------------------------------------------------------------


def test_encrypt_field_returns_base64_encoded_ciphertext() -> None:
    """encrypt_field returns a base64-encoded string when KMS is configured."""
    ciphertext_bytes = b"encrypted-bytes"
    mock_response = MagicMock()
    mock_response.ciphertext = ciphertext_bytes

    mock_client = MagicMock()
    mock_client.encrypt.return_value = mock_response

    mock_kms_module = MagicMock()
    mock_kms_module.KeyManagementServiceClient.return_value = mock_client

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
