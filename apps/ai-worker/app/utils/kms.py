"""Cloud KMS utility for encrypting PII fields before Firestore persistence
and decrypting raw resume text written by the Ingestor service.

When ``encrypt_kms_key_name`` is configured in settings, plain-text field values are
encrypted using the Google Cloud KMS API and stored as base64-encoded
ciphertext.  When no key is configured (local development), values are returned
as-is.

The encrypted values are stored in Firestore and decrypted by the File
Generator service before template rendering.
"""

from __future__ import annotations

import base64
import logging

from app.utils.exceptions import KmsDecryptionError, KmsEncryptionError

logger = logging.getLogger(__name__)

#: PII field names extracted by the AI Worker that should be encrypted.
PII_FIELDS = ["name", "email", "phone", "address", "cpf", "rg"]


def encrypt_field(plaintext: str, encrypt_kms_key_name: str) -> str:
    """Encrypt a plain-text string using Cloud KMS.

    When *encrypt_kms_key_name* is empty the function returns *plaintext* unchanged —
    this allows local development without a real KMS key.

    Args:
        plaintext: The plain-text string to encrypt.
        encrypt_kms_key_name: Fully-qualified KMS key resource name, or empty string
            to skip encryption.

    Returns:
        Base64-encoded ciphertext string, or the original value when KMS is
        not configured.

    Raises:
        KmsEncryptionError: If the KMS API call fails.
    """
    if not encrypt_kms_key_name:
        logger.debug("KMS key not configured — returning field value as-is")
        return plaintext

    try:
        from google.cloud import kms  # type: ignore[import-untyped]

        client = kms.KeyManagementServiceClient()
        plaintext_bytes = plaintext.encode("utf-8")
        response = client.encrypt(
            request={"name": encrypt_kms_key_name, "plaintext": plaintext_bytes}
        )
        ciphertext_b64: str = base64.b64encode(response.ciphertext).decode("utf-8")
        logger.debug("KMS encryption successful")
        return ciphertext_b64
    except Exception as exc:
        logger.error("KMS encryption failed: %s", exc)
        raise KmsEncryptionError(f"KMS encryption failed: {exc}") from exc


def encrypt_pii_fields(
    data: dict[str, object],
    pii_keys: list[str],
    encrypt_kms_key_name: str,
) -> dict[str, object]:
    """Encrypt PII fields in a data dictionary using Cloud KMS.

    Iterates over *pii_keys* and, for each key present in *data* whose value
    is a non-empty string, replaces the plain-text value with the base64-encoded
    ciphertext.  Non-string values (e.g. nested dicts, lists, None) are left
    unchanged.

    Args:
        data: The data dictionary containing PII fields to encrypt.
        pii_keys: List of top-level key names whose values should be encrypted.
        encrypt_kms_key_name: Fully-qualified KMS key resource name.  Pass an empty
            string to skip encryption.

    Returns:
        A new dictionary with PII fields encrypted (shallow copy of the top
        level only).  Returns the original dict reference when no KMS key is
        configured.

    Raises:
        KmsEncryptionError: If any individual field encryption fails.
    """
    if not encrypt_kms_key_name:
        return data

    result = dict(data)
    for key in pii_keys:
        value = result.get(key)
        if isinstance(value, str) and value:
            result[key] = encrypt_field(value, encrypt_kms_key_name)
    return result


def decrypt_field(ciphertext_b64: str, decrypt_kms_key_name: str) -> str:
    """Decrypt a base64-encoded ciphertext string using Cloud KMS.

    When *decrypt_kms_key_name* is empty the function returns *ciphertext_b64*
    unchanged — this allows local development without a real KMS key.

    Args:
        ciphertext_b64: Base64-encoded ciphertext string to decrypt.
        decrypt_kms_key_name: Fully-qualified KMS key resource name, or empty
            string to skip decryption.

    Returns:
        Plain-text string, or the original value when KMS is not configured.

    Raises:
        KmsDecryptionError: If the KMS API call fails.
    """
    if not decrypt_kms_key_name:
        logger.debug("KMS key not configured — returning field value as-is")
        return ciphertext_b64

    try:
        from google.cloud import kms  # type: ignore[import-untyped]

        client = kms.KeyManagementServiceClient()
        ciphertext_bytes = base64.b64decode(ciphertext_b64)
        response = client.decrypt(
            request={"name": decrypt_kms_key_name, "ciphertext": ciphertext_bytes}
        )
        plaintext: str = response.plaintext.decode("utf-8")
        logger.debug("KMS decryption successful")
        return plaintext
    except Exception as exc:
        logger.error("KMS decryption failed: %s", exc)
        raise KmsDecryptionError(f"KMS decryption failed: {exc}") from exc
