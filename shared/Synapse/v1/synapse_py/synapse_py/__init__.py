"""Synapse — persistence layer abstraction for Elastic Resume Base Python services.

Synapse is the **sole** persistence layer for Elastic Resume Base Python
microservices.  It owns every aspect of the Firestore connection — from SDK
initialisation through to data-access abstractions — so that consuming services
can remain free of any direct ``firebase-admin`` dependency.

Quick start::

    from synapse_py import initialize_persistence, FirestoreResumeStore

    # Call once at application startup, before using any store.
    initialize_persistence(project_id="my-gcp-project")

    store = FirestoreResumeStore()
    resume = store.create_resume(
        raw_text="John Doe — Software Engineer...",
        source={"sheetId": "abc123", "row": 2},
    )
    print(resume["id"])  # auto-generated Firestore document ID
"""

from synapse_py.errors import SynapseConflictError, SynapseError, SynapseNotFoundError
from synapse_py.interfaces.resume_store import (
    CreateResumeData,
    IResumeStore,
    ResumeDocument,
    UpdateResumeData,
)
from synapse_py.persistence import PersistenceOptions, initialize_persistence, terminate_persistence
from synapse_py.repositories.firestore_resume_store import FirestoreResumeStore

__all__ = [
    # Persistence initialisation
    "PersistenceOptions",
    "initialize_persistence",
    "terminate_persistence",
    # Resume store interface & models
    "IResumeStore",
    "ResumeDocument",
    "CreateResumeData",
    "UpdateResumeData",
    # Concrete Firestore implementation
    "FirestoreResumeStore",
    # Errors
    "SynapseError",
    "SynapseNotFoundError",
    "SynapseConflictError",
]
