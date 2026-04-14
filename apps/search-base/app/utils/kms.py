"""Cloud KMS utility for decrypting PII fields from Firestore.

When ``local_fernet_key`` is configured, ciphertext field values are decrypted
using a local Fernet symmetric key — intended for local development and testing
only.  When ``decrypt_kms_key_name`` is configured, Cloud KMS is used instead.
When neither is set, values are returned as-is (no decryption).

The encrypted values were stored in Firestore by the AI Worker service.
"""

from __future__ import annotations

import base64
import logging

from app.utils.exceptions import KmsDecryptionError

logger = logging.getLogger(__name__)

#: PII field names that may be encrypted in Firestore.
PII_FIELDS = ["name", "email", "phone", "address", "cpf", "rg"]


def decrypt_field(ciphertext_b64: str, decrypt_kms_key_name: str, local_key: str = "") -> str:
    """Decrypt an encrypted string using a local Fernet key or Cloud KMS.

    Priority:
        1. *local_key* set → Fernet symmetric decryption (local development).
        2. *decrypt_kms_key_name* set → Cloud KMS decryption (production).
        3. Neither set → return *ciphertext_b64* unchanged (no decryption).

    Args:
        ciphertext_b64: The encrypted value (Fernet token or base64 KMS ciphertext).
        decrypt_kms_key_name: Fully-qualified KMS key resource name, or empty string.
        local_key: Fernet key for local decryption.  Takes priority over
            *decrypt_kms_key_name* when non-empty.  Local development only.

    Returns:
        Plain-text string, or the original value when neither key is configured.

    Raises:
        KmsDecryptionError: If the decryption operation fails.
    """
    if local_key:
        try:
            from cryptography.fernet import Fernet  # type: ignore[import-untyped]

            fernet = Fernet(local_key.encode())
            plaintext: str = fernet.decrypt(ciphertext_b64.encode("utf-8")).decode("utf-8")
            logger.debug("Local Fernet decryption successful")
            return plaintext
        except Exception as exc:
            logger.error("Local Fernet decryption failed: %s", exc)
            raise KmsDecryptionError(f"Local Fernet decryption failed: {exc}") from exc

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
        plaintext_kms: str = response.plaintext.decode("utf-8")
        logger.debug("KMS decryption successful")
        return plaintext_kms
    except Exception as exc:
        logger.error("KMS decryption failed: %s", exc)
        raise KmsDecryptionError(f"KMS decryption failed: {exc}") from exc


def decrypt_pii_fields(
    data: dict[str, object],
    pii_keys: list[str],
    decrypt_kms_key_name: str,
    local_key: str = "",
) -> dict[str, object]:
    """Decrypt PII fields in a data dictionary.

    Iterates over *pii_keys* and, for each key present in *data* whose value
    is a non-empty string, decrypts the value and replaces it with the
    plain-text string.  Non-string values (e.g. nested dicts, lists, None)
    are left unchanged.

    Args:
        data: The data dictionary containing encrypted PII fields.
        pii_keys: List of top-level key names whose values should be decrypted.
        decrypt_kms_key_name: Fully-qualified KMS key resource name.  Pass an empty
            string to skip KMS decryption.
        local_key: Fernet key for local decryption.  Takes priority over
            *decrypt_kms_key_name* when non-empty.

    Returns:
        A new dictionary with PII fields decrypted (shallow copy of the top
        level only).  Returns the original dict reference when no key is
        configured.

    Raises:
        KmsDecryptionError: If any individual field decryption fails.
    """
    if not local_key and not decrypt_kms_key_name:
        return data

    result = dict(data)
    for key in pii_keys:
        value = result.get(key)
        if isinstance(value, str) and value:
            result[key] = decrypt_field(value, decrypt_kms_key_name, local_key)
    return result
