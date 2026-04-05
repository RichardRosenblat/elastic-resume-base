"""Cloud KMS utility for decrypting PII fields before template rendering.

When ``kms_key_name`` is configured in settings, ciphertext field values are
decrypted using the Google Cloud KMS API.  When no key is configured (local
development), values are returned as-is.
"""

from __future__ import annotations

import base64
import logging

from app.utils.exceptions import KmsDecryptionError

logger = logging.getLogger(__name__)


def decrypt_field(ciphertext_b64: str, kms_key_name: str) -> str:
    """Decrypt a base64-encoded ciphertext string using Cloud KMS.

    When *kms_key_name* is empty the function treats *ciphertext_b64* as
    plain text and returns it unchanged — this allows local development without
    a real KMS key.

    Args:
        ciphertext_b64: The base64-encoded ciphertext (or plain text in dev).
        kms_key_name: Fully-qualified KMS key resource name, or empty string
            to skip decryption.

    Returns:
        The decrypted plain-text string.

    Raises:
        KmsDecryptionError: If the KMS API call fails or returns an error.
    """
    if not kms_key_name:
        logger.debug("KMS key not configured — returning field value as-is")
        return ciphertext_b64

    try:
        from google.cloud import kms  # type: ignore[import-untyped]

        client = kms.KeyManagementServiceClient()
        ciphertext = base64.b64decode(ciphertext_b64)
        response = client.decrypt(
            request={"name": kms_key_name, "ciphertext": ciphertext}
        )
        plaintext: str = response.plaintext.decode("utf-8").rstrip("\x00")
        logger.debug("KMS decryption successful")
        return plaintext
    except Exception as exc:
        logger.error("KMS decryption failed: %s", exc)
        raise KmsDecryptionError(f"KMS decryption failed: {exc}") from exc


def decrypt_pii_fields(
    data: dict[str, object],
    pii_keys: list[str],
    kms_key_name: str,
) -> dict[str, object]:
    """Decrypt PII fields in a data dictionary using Cloud KMS.

    Iterates over *pii_keys* and, for each key present in *data* whose value
    is a non-empty string, replaces the encrypted value with the decrypted
    plain-text.  Non-string values (e.g. nested dicts, lists) are left
    unchanged.

    Args:
        data: The data dictionary containing potentially encrypted PII fields.
        pii_keys: List of top-level key names whose values should be decrypted.
        kms_key_name: Fully-qualified KMS key resource name.  Pass an empty
            string to skip decryption.

    Returns:
        A new dictionary with PII fields decrypted in place (shallow copy of
        the top level only).

    Raises:
        KmsDecryptionError: If any individual field decryption fails.
    """
    if not kms_key_name:
        return data

    result = dict(data)
    for key in pii_keys:
        value = result.get(key)
        if isinstance(value, str) and value:
            result[key] = decrypt_field(value, kms_key_name)
    return result
