"""Synapse — shared Firestore persistence library for Elastic Resume Base Python services.

Synapse is the **sole** persistence layer for Python microservices.  It owns
the Firestore connection from SDK initialisation through to data-access
abstractions, so that consuming services have **zero** direct
``google-cloud-firestore`` dependency.

Quick start::

    from synapse import initialize_persistence, get_resume_store

    # Call once at application startup.
    initialize_persistence(project_id="my-gcp-project")

    # Anywhere in your code:
    store = get_resume_store()
    resume_id = store.create(text="Candidate resume...", metadata={"source": "sheet-1"})
"""

from synapse.interfaces.resume_store import IResumeStore
from synapse.persistence import (
    PersistenceOptions,
    get_resume_store,
    initialize_persistence,
    terminate_persistence,
)
from synapse.repositories.firestore_resume_store import FirestoreResumeStore

__all__ = [
    "IResumeStore",
    "FirestoreResumeStore",
    "PersistenceOptions",
    "initialize_persistence",
    "terminate_persistence",
    "get_resume_store",
]
