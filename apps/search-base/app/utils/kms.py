"""Cloud KMS utility for decrypting PII fields from Firestore.

When ``decrypt_kms_key_name`` is configured in settings, base64-encoded
ciphertext field values are decrypted using the Google Cloud KMS API and
returned as plain text.  When no key is configured (local development),
values are returned as-is.

The encrypted values were stored in Firestore by the AI Worker service.
"""

from __future__ import annotations

import base64
import logging

from app.utils.exceptions import KmsDecryptionError

logger = logging.getLogger(__name__)

#: PII field names that may be encrypted in Firestore.
PII_FIELDS = ["name", "email", "phone", "address", "cpf", "rg"]


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


def decrypt_pii_fields(
    data: dict[str, object],
    pii_keys: list[str],
    decrypt_kms_key_name: str,
) -> dict[str, object]:
    """Decrypt PII fields in a data dictionary using Cloud KMS.

    Iterates over *pii_keys* and, for each key present in *data* whose value
    is a non-empty string, decrypts the base64-encoded ciphertext and replaces
    it with the plain-text value.  Non-string values (e.g. nested dicts, lists,
    None) are left unchanged.

    Args:
        data: The data dictionary containing encrypted PII fields.
        pii_keys: List of top-level key names whose values should be decrypted.
        decrypt_kms_key_name: Fully-qualified KMS key resource name.  Pass an empty
            string to skip decryption.

    Returns:
        A new dictionary with PII fields decrypted (shallow copy of the top
        level only).  Returns the original dict reference when no KMS key is
        configured.

    Raises:
        KmsDecryptionError: If any individual field decryption fails.
    """
    if not decrypt_kms_key_name:
        return data

    result = dict(data)
    for key in pii_keys:
        value = result.get(key)
        if isinstance(value, str) and value:
            result[key] = decrypt_field(value, decrypt_kms_key_name)
    return result
