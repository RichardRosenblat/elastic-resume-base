"""Firebase Admin SDK initialisation for Synapse.

Mirrors ``shared/Synapse/v1/synapse_ts/src/persistence.ts`` so that Python
services share the same Firestore initialisation conventions.
"""

from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class PersistenceOptions:
    """Options for initialising the Synapse persistence layer.

    Attributes:
        project_id: Firestore / Firebase project identifier.
        service_account_key: Service-account credentials as a raw JSON string
            **or** a Base64-encoded JSON string.  When ``None``, Application
            Default Credentials (ADC) are used — the standard production setup
            for Cloud Run deployments.
    """

    project_id: str
    service_account_key: str | None = None


def initialize_persistence(
    project_id: str,
    service_account_key: str | None = None,
) -> None:
    """Initialise the Firebase Admin SDK — the persistence backend used by Synapse.

    This function is **idempotent**: subsequent calls after the first successful
    initialisation are no-ops.  Call it once at application startup before any
    Synapse store is used.

    Args:
        project_id: The Google Cloud project ID that owns the Firestore database.
        service_account_key: Optional service-account key as a raw or
            Base64-encoded JSON string.  When omitted, Application Default
            Credentials (ADC) are used — the recommended approach for Cloud Run.

    Raises:
        ImportError: If ``firebase-admin`` is not installed.

    Example::

        from synapse_py import initialize_persistence

        initialize_persistence(
            project_id="my-gcp-project",
            service_account_key=os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY"),
        )
    """
    try:
        import firebase_admin  # type: ignore[import-untyped]
        from firebase_admin import credentials as fb_credentials  # type: ignore[import-untyped]
    except ImportError as exc:
        raise ImportError(
            "The 'firebase-admin' package is required for Synapse persistence. "
            "Install it with: pip install 'elastic-resume-base-synapse[firestore]'"
        ) from exc

    if firebase_admin._apps:  # type: ignore[attr-defined]
        logger.debug("Firebase Admin SDK already initialised — skipping.")
        return

    app_options: dict[str, object] = {"projectId": project_id}
    credential: object = firebase_admin.credentials.ApplicationDefault()

    if service_account_key:
        try:
            raw = service_account_key.strip()
            if not raw.startswith("{"):
                raw = base64.b64decode(raw).decode("utf-8")
            key_dict = json.loads(raw)
            credential = fb_credentials.Certificate(key_dict)
        except Exception as exc:
            logger.warning(
                "Failed to parse service_account_key — falling back to ADC: %s", exc
            )

    firebase_admin.initialize_app(credential, app_options)
    logger.debug("Firebase Admin SDK initialised for project '%s'.", project_id)


def terminate_persistence() -> None:
    """Terminate the Firebase Admin SDK.

    Should be called during graceful shutdown to release Firestore connections
    and prevent zombie connections or memory leaks.  This function is
    **idempotent**: if no app is initialised, it is a no-op.

    Raises:
        ImportError: If ``firebase-admin`` is not installed.

    Example::

        from synapse_py import terminate_persistence

        terminate_persistence()
    """
    try:
        import firebase_admin  # type: ignore[import-untyped]
    except ImportError as exc:
        raise ImportError(
            "The 'firebase-admin' package is required for Synapse persistence. "
            "Install it with: pip install 'elastic-resume-base-synapse[firestore]'"
        ) from exc

    if not firebase_admin._apps:  # type: ignore[attr-defined]
        return
    firebase_admin.delete_app(firebase_admin.get_app())
    logger.debug("Firebase Admin SDK terminated.")
