"""Unit tests for the Search Base KMS decryption utility."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from app.utils.kms import decrypt_field, decrypt_pii_fields, PII_FIELDS
from app.utils.exceptions import KmsDecryptionError


# ---------------------------------------------------------------------------
# decrypt_field — no key configured
# ---------------------------------------------------------------------------


def test_decrypt_field_returns_value_unchanged_when_no_keys() -> None:
    """decrypt_field returns the value unchanged when neither key is configured."""
    result = decrypt_field("some-ciphertext", "")
    assert result == "some-ciphertext"


# ---------------------------------------------------------------------------
# decrypt_field — local Fernet key
# ---------------------------------------------------------------------------


def test_decrypt_field_uses_fernet_when_local_key_set() -> None:
    """decrypt_field uses Fernet decryption when local_key is provided."""
    from cryptography.fernet import Fernet

    key = Fernet.generate_key().decode()
    fernet = Fernet(key.encode())
    token = fernet.encrypt(b"hello world").decode()

    result = decrypt_field(token, "", local_key=key)
    assert result == "hello world"


def test_decrypt_field_local_key_takes_priority_over_kms() -> None:
    """When local_key is set, Fernet is used regardless of decrypt_kms_key_name."""
    from cryptography.fernet import Fernet

    key = Fernet.generate_key().decode()
    fernet = Fernet(key.encode())
    token = fernet.encrypt(b"decrypted text").decode()

    result = decrypt_field(token, "projects/p/.../cryptoKeys/k", local_key=key)
    assert result == "decrypted text"


def test_decrypt_field_raises_on_invalid_fernet_key() -> None:
    """decrypt_field raises KmsDecryptionError when local_key is invalid."""
    from cryptography.fernet import Fernet

    key = Fernet.generate_key().decode()
    fernet = Fernet(key.encode())
    token = fernet.encrypt(b"data").decode()

    with pytest.raises(KmsDecryptionError, match="Local Fernet decryption failed"):
        decrypt_field(token, "", local_key="not-a-valid-fernet-key")


# ---------------------------------------------------------------------------
# decrypt_pii_fields — no key configured
# ---------------------------------------------------------------------------


def test_decrypt_pii_fields_returns_same_dict_when_no_keys() -> None:
    """decrypt_pii_fields returns the original dict when no keys are configured."""
    data: dict[str, Any] = {"name": "encrypted:xxx", "skills": ["Python"]}
    result = decrypt_pii_fields(data, ["name"], "")
    assert result is data


# ---------------------------------------------------------------------------
# decrypt_pii_fields — local Fernet key
# ---------------------------------------------------------------------------


def test_decrypt_pii_fields_uses_fernet_when_local_key_set() -> None:
    """decrypt_pii_fields uses Fernet when local_key is provided."""
    from cryptography.fernet import Fernet

    key = Fernet.generate_key().decode()
    fernet = Fernet(key.encode())

    data: dict[str, Any] = {
        "name": fernet.encrypt(b"Alice Smith").decode(),
        "skills": ["Python"],
    }

    result = decrypt_pii_fields(data, ["name"], "", local_key=key)
    assert result["name"] == "Alice Smith"
    assert result["skills"] == ["Python"]
    assert data["name"] != "Alice Smith"  # original unchanged


def test_decrypt_pii_fields_skips_non_string_values() -> None:
    """decrypt_pii_fields only decrypts string values."""
    data: dict[str, Any] = {"name": "enc:abc", "scores": [1, 2, 3]}

    with patch("app.utils.kms.decrypt_field", return_value="John") as mock_decrypt:
        result = decrypt_pii_fields(data, ["name", "scores"], "projects/p/...")

    assert mock_decrypt.call_count == 1
    assert result["scores"] == [1, 2, 3]


def test_decrypt_pii_fields_covers_all_default_pii_fields() -> None:
    """PII_FIELDS covers the expected sensitive fields."""
    expected = {"name", "email", "phone", "address", "cpf", "rg"}
    assert expected.issubset(set(PII_FIELDS))
