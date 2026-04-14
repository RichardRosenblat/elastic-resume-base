"""Cloud KMS utility for encrypting raw resume text before Firestore persistence.

When ``local_fernet_key`` is configured, the plain-text resume content is
encrypted using a local Fernet symmetric key — intended for local development
and testing only.  When ``encrypt_kms_key_name`` is configured, Cloud KMS is
used instead.  When neither is set, the value is stored as plain text.

The encrypted raw text is decrypted by downstream services (e.g. AI Worker)
before processing.
"""

from __future__ import annotations

import base64
import logging

from app.utils.exceptions import KmsEncryptionError

logger = logging.getLogger(__name__)


def encrypt_field(plaintext: str, encrypt_kms_key_name: str, local_key: str = "") -> str:
    """Encrypt a plain-text string using a local Fernet key or Cloud KMS.

    Priority:
        1. *local_key* set → Fernet symmetric encryption (local development).
        2. *encrypt_kms_key_name* set → Cloud KMS encryption (production).
        3. Neither set → return *plaintext* unchanged (no encryption).

    Args:
        plaintext: The plain-text string to encrypt.
        encrypt_kms_key_name: Fully-qualified KMS key resource name, or empty
            string to skip KMS encryption.
        local_key: Fernet key for local encryption.  Takes priority over
            *encrypt_kms_key_name* when non-empty.  Local development only.

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
