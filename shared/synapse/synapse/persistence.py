"""Synapse persistence layer initialisation and singleton management.

Call :func:`initialize_persistence` **once** at application startup before
using any store.  After that, :func:`get_db` and :func:`get_resume_store`
can be called anywhere.

Mirrors the TypeScript ``initializePersistence`` / ``terminatePersistence``
pattern so that Python services have the same lifecycle contract.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Options dataclass
# ---------------------------------------------------------------------------


@dataclass
class PersistenceOptions:
    """Options for initialising the Synapse persistence layer.

    Attributes:
        project_id: Firestore / Firebase project identifier.
        service_account_key: Service-account credentials as a raw JSON string
            **or** a Base64-encoded JSON string.  When ``None``, Application
            Default Credentials (ADC) are used (works on Cloud Run and with
            ``gcloud auth application-default login`` locally).
        resumes_collection: Firestore collection name for resume documents.
            Defaults to ``"resumes"``.
    """

    project_id: str
    service_account_key: str | None = None
    resumes_collection: str = "resumes"


# ---------------------------------------------------------------------------
# Module-level singletons
# ---------------------------------------------------------------------------

_db: object | None = None
_options: PersistenceOptions | None = None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def initialize_persistence(
    project_id: str | None = None,
    service_account_key: str | None = None,
    resumes_collection: str = "resumes",
    options: PersistenceOptions | None = None,
) -> None:
    """Initialise the Firestore client singleton.

    This function is **idempotent**: subsequent calls after the first
    successful initialisation are no-ops.

    You may pass arguments directly **or** as a :class:`PersistenceOptions`
    instance — the ``options`` kwarg takes precedence when both are supplied.

    Args:
        project_id: Google Cloud project ID.  Defaults to the
            ``GCP_PROJECT_ID`` environment variable.
        service_account_key: Raw JSON or Base64-encoded service-account
            credentials.  When ``None``, ADC are used.
        resumes_collection: Firestore collection name.  Defaults to
            ``"resumes"``.
        options: A :class:`PersistenceOptions` instance — takes precedence
            over the individual keyword arguments.

    Raises:
        ValueError: If no project ID can be determined.

    Example:
        >>> from synapse import initialize_persistence
        >>> initialize_persistence(project_id="my-gcp-project")
    """
    global _db, _options

    if _db is not None:
        return  # Already initialised — idempotent.

    if options is not None:
        resolved = options
    else:
        pid = project_id or os.environ.get("GCP_PROJECT_ID") or os.environ.get("FIREBASE_PROJECT_ID")
        if not pid:
            raise ValueError(
                "No project_id supplied and neither GCP_PROJECT_ID nor "
                "FIREBASE_PROJECT_ID is set in the environment."
            )
        resolved = PersistenceOptions(
            project_id=pid,
            service_account_key=service_account_key,
            resumes_collection=resumes_collection,
        )

    _db = _build_firestore_client(resolved)
    _options = resolved
    logger.info(
        "Synapse persistence initialised: project=%s collection=%s.",
        resolved.project_id,
        resolved.resumes_collection,
    )


def initialize_persistence_from_env() -> None:
    """Initialise persistence using environment variables.

    Reads:
    * ``GCP_PROJECT_ID`` or ``FIREBASE_PROJECT_ID`` — project identifier.
    * ``GOOGLE_SERVICE_ACCOUNT_KEY`` — optional JSON/Base64 credentials.
    * ``FIRESTORE_RESUMES_COLLECTION`` — optional collection name.

    Example:
        >>> from synapse import initialize_persistence_from_env
        >>> initialize_persistence_from_env()
    """
    initialize_persistence(
        project_id=(
            os.environ.get("GCP_PROJECT_ID")
            or os.environ.get("FIREBASE_PROJECT_ID")
        ),
        service_account_key=os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY"),
        resumes_collection=os.environ.get("FIRESTORE_RESUMES_COLLECTION", "resumes"),
    )


def terminate_persistence() -> None:
    """Release the Firestore client.

    Should be called during graceful shutdown to release connections.
    This function is **idempotent**: calling it when nothing is initialised
    is a no-op.

    Example:
        >>> import signal
        >>> def on_sigterm(sig, frame):
        ...     terminate_persistence()
        >>> signal.signal(signal.SIGTERM, on_sigterm)
    """
    global _db, _options
    _db = None
    _options = None
    logger.info("Synapse persistence terminated.")


def get_db() -> object:
    """Return the initialised Firestore client.

    Returns:
        The ``google.cloud.firestore.Client`` instance.

    Raises:
        RuntimeError: If :func:`initialize_persistence` has not been called.
    """
    if _db is None:
        raise RuntimeError(
            "Synapse persistence has not been initialised.  "
            "Call initialize_persistence() once at application startup."
        )
    return _db


def get_resume_store() -> "FirestoreResumeStore":  # noqa: F821
    """Return a :class:`~synapse.repositories.firestore_resume_store.FirestoreResumeStore`.

    The store is constructed fresh on every call (cheap — it holds no state
    beyond a reference to the shared Firestore client).

    Returns:
        A ready-to-use :class:`~synapse.repositories.firestore_resume_store.FirestoreResumeStore`.

    Raises:
        RuntimeError: If :func:`initialize_persistence` has not been called.
    """
    from synapse.repositories.firestore_resume_store import FirestoreResumeStore

    db = get_db()
    collection = _options.resumes_collection if _options else "resumes"
    return FirestoreResumeStore(db=db, collection=collection)


# ---------------------------------------------------------------------------
# Testing helpers (not part of the public API)
# ---------------------------------------------------------------------------


def _reset_persistence_for_testing() -> None:
    """Reset module-level state — for use in unit tests only."""
    global _db, _options
    _db = None
    _options = None


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _build_firestore_client(options: PersistenceOptions) -> object:
    """Build a ``google.cloud.firestore.Client`` from the given options.

    Tries to use service-account credentials when supplied; falls back to ADC.

    Args:
        options: Resolved persistence options.

    Returns:
        An initialised Firestore client.
    """
    from google.cloud import firestore  # type: ignore[import-untyped]
    import google.auth  # type: ignore[import-untyped]
    from google.oauth2 import service_account  # type: ignore[import-untyped]

    scopes = ["https://www.googleapis.com/auth/datastore"]

    credentials = None
    if options.service_account_key:
        try:
            raw = options.service_account_key.strip()
            decoded = raw if raw.startswith("{") else base64.b64decode(raw).decode("utf-8")
            account_info = json.loads(decoded)
            credentials = service_account.Credentials.from_service_account_info(
                account_info, scopes=scopes
            )
            logger.debug("Using service-account credentials for Firestore.")
        except Exception as exc:
            logger.warning(
                "Failed to parse service-account key; falling back to ADC: %s", exc
            )

    if credentials is None:
        credentials, _ = google.auth.default(scopes=scopes)
        logger.debug("Using Application Default Credentials for Firestore.")

    return firestore.Client(project=options.project_id, credentials=credentials)
