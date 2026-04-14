"""Cloud KMS utility for encrypting PII fields before Firestore persistence
and decrypting raw resume text written by the Ingestor service.

When ``local_fernet_key`` is configured, plain-text field values are encrypted
using a local Fernet symmetric key — intended for local development and testing
only.  When ``encrypt_kms_key_name`` is configured, Cloud KMS is used instead.
When neither is set, values are returned as-is (no encryption).

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


def encrypt_field(plaintext: str, encrypt_kms_key_name: str, local_key: str = "") -> str:
    """Encrypt a plain-text string using a local Fernet key or Cloud KMS.

    Priority:
        1. *local_key* set → Fernet symmetric encryption (local development).
        2. *encrypt_kms_key_name* set → Cloud KMS encryption (production).
        3. Neither set → return *plaintext* unchanged (no encryption).

    Args:
        plaintext: The plain-text string to encrypt.
        encrypt_kms_key_name: Fully-qualified KMS key resource name, or empty string.
        local_key: Fernet key for local encryption.  Takes priority over
            *encrypt_kms_key_name* when non-empty.

    Returns:
        Encrypted string (Fernet token or base64-encoded KMS ciphertext), or
        the original value when encryption is not configured.

    Raises:
        KmsEncryptionError: If the encryption operation fails.
    """
    if local_key:
        try:
            from cryptography.fernet import Fernet  # type: ignore[import-untyped]

            fernet = Fernet(local_key.encode())
            token: str = fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")
            logger.debug("Local Fernet encryption successful")
            return token
        except Exception as exc:
            logger.error("Local Fernet encryption failed: %s", exc)
            raise KmsEncryptionError(f"Local Fernet encryption failed: {exc}") from exc

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
    local_key: str = "",
) -> dict[str, object]:
    """Encrypt PII fields in a data dictionary.

    Iterates over *pii_keys* and, for each key present in *data* whose value
    is a non-empty string, replaces the plain-text value with the encrypted
    value.  Non-string values (e.g. nested dicts, lists, None) are left
    unchanged.

    Args:
        data: The data dictionary containing PII fields to encrypt.
        pii_keys: List of top-level key names whose values should be encrypted.
        encrypt_kms_key_name: Fully-qualified KMS key resource name.  Pass an empty
            string to skip KMS encryption.
        local_key: Fernet key for local encryption.  Takes priority over
            *encrypt_kms_key_name* when non-empty.

    Returns:
        A new dictionary with PII fields encrypted (shallow copy of the top
        level only).  Returns the original dict reference when no encryption
        is configured.

    Raises:
        KmsEncryptionError: If any individual field encryption fails.
    """
    if not local_key and not encrypt_kms_key_name:
        return data

    result = dict(data)
    for key in pii_keys:
        value = result.get(key)
        if isinstance(value, str) and value:
            result[key] = encrypt_field(value, encrypt_kms_key_name, local_key)
    return result


def decrypt_field(ciphertext_b64: str, decrypt_kms_key_name: str, local_key: str = "") -> str:
    """Decrypt an encrypted string using a local Fernet key or Cloud KMS.

    Priority:
        1. *local_key* set → Fernet symmetric decryption (local development).
        2. *decrypt_kms_key_name* set → Cloud KMS decryption (production).
        3. Neither set → return *ciphertext_b64* unchanged (no decryption).

    Args:
        ciphertext_b64: The encrypted value (Fernet token or base64 KMS ciphertext).
        decrypt_kms_key_name: Fully-qualified KMS key resource name, or empty
            string to skip KMS decryption.
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
