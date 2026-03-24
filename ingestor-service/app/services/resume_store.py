"""Re-export Synapse's IResumeStore for use within the Ingestor Service.

All Firestore access for resume documents is delegated to the Python Synapse
library.  This module is kept as a thin pass-through so that internal imports
remain stable while the implementation lives exclusively in Synapse.

Consuming code within this service should import from here::

    from app.services.resume_store import IResumeStore

and receive a concrete :class:`~synapse.repositories.firestore_resume_store.FirestoreResumeStore`
from :func:`synapse.persistence.get_resume_store` at startup.
"""

from __future__ import annotations

# Re-export the Synapse interface so the rest of the service only imports from
# ``app.services.resume_store`` — making it easy to swap implementations later.
from synapse.interfaces.resume_store import IResumeStore

__all__ = ["IResumeStore"]
