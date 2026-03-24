"""Firestore client lifecycle management for Python services.

Synapse is the **sole owner** of ``google-cloud-firestore`` in the Python
microservice stack.  No consuming service should import or reference Firestore
directly.

Call :func:`initialize_persistence` once at application startup before any
store is used, and :func:`terminate_persistence` during graceful shutdown.

Example::

    from synapse.persistence import PersistenceOptions, initialize_persistence, terminate_persistence

    initialize_persistence(PersistenceOptions(project_id="my-project"))
    # ... service runs ...
    await terminate_persistence()
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field

from google.cloud import firestore  # type: ignore[attr-defined]

logger = logging.getLogger(__name__)

_db: firestore.AsyncClient | None = None


@dataclass
class PersistenceOptions:
    """Configuration for initialising the Firestore persistence layer.

    Attributes:
        project_id: GCP / Firestore project identifier.
        emulator_host: Optional host:port for the Firestore emulator
            (e.g. ``"localhost:8080"``).  When provided, the
            ``FIRESTORE_EMULATOR_HOST`` environment variable is set before the
            client is created.  Omit to use Application Default Credentials
            and the real Firestore service.
        collection_overrides: Optional mapping of logical collection names to
            physical Firestore collection names.  Useful for tests that need to
            write to isolated collections.
    """

    project_id: str
    emulator_host: str | None = None
    collection_overrides: dict[str, str] = field(default_factory=dict)


def initialize_persistence(options: PersistenceOptions) -> None:
    """Initialise the Firestore async client singleton.

    Idempotent — subsequent calls after the first successful initialisation
    are no-ops.

    Args:
        options: Persistence configuration.

    Example:
        >>> from synapse.persistence import PersistenceOptions, initialize_persistence
        >>> initialize_persistence(PersistenceOptions(project_id="demo-project"))
    """
    global _db
    if _db is not None:
        return

    if options.emulator_host:
        os.environ.setdefault("FIRESTORE_EMULATOR_HOST", options.emulator_host)
        logger.debug("Firestore emulator host set to %s", options.emulator_host)

    _db = firestore.AsyncClient(project=options.project_id)
    logger.debug("Firestore AsyncClient initialised for project %s", options.project_id)


def get_db() -> firestore.AsyncClient:
    """Return the initialised Firestore client singleton.

    Returns:
        The active :class:`google.cloud.firestore.AsyncClient` instance.

    Raises:
        RuntimeError: If :func:`initialize_persistence` has not been called.

    Example:
        >>> from synapse.persistence import get_db
        >>> db = get_db()
    """
    if _db is None:
        raise RuntimeError(
            "Synapse has not been initialised. "
            "Call initialize_persistence() before using any store."
        )
    return _db


async def terminate_persistence() -> None:
    """Close the Firestore client and release resources.

    Idempotent — safe to call even if persistence was never initialised.

    Example:
        >>> import asyncio
        >>> from synapse.persistence import terminate_persistence
        >>> asyncio.run(terminate_persistence())
    """
    global _db
    if _db is not None:
        _db.close()
        _db = None
        logger.debug("Firestore AsyncClient closed.")


def _reset_persistence_for_testing() -> None:
    """Reset the Firestore singleton.

    **For testing only.** Clears the singleton so that
    :func:`initialize_persistence` can be called again in the next test.
    """
    global _db
    _db = None
