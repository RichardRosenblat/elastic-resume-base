"""Cloud KMS utility for encrypting raw resume text before Firestore persistence.

When ``encrypt_kms_key_name`` is configured in settings, the plain-text resume
content is encrypted using the Google Cloud KMS API and stored as a
base64-encoded ciphertext string.  When no key is configured (local
development), the value is stored as plain text.

The encrypted raw text is decrypted by downstream services (e.g. AI Worker)
before processing.
"""

from __future__ import annotations

import base64
import logging

from app.utils.exceptions import KmsEncryptionError

logger = logging.getLogger(__name__)


def encrypt_field(plaintext: str, encrypt_kms_key_name: str) -> str:
    """Encrypt a plain-text string using Cloud KMS.

    When *encrypt_kms_key_name* is empty the function returns *plaintext*
    unchanged — this allows local development without a real KMS key.

    Args:
        plaintext: The plain-text string to encrypt.
        encrypt_kms_key_name: Fully-qualified KMS key resource name, or empty
            string to skip encryption.

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
