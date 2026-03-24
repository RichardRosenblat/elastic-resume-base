"""elastic-resume-base-synapse — Firestore persistence layer for Python services.

Synapse is the single owner of ``google-cloud-firestore`` in the Python
microservice stack.  No consuming service should import or reference Firestore
directly — all persistence operations are mediated through Synapse interfaces.

Mirrors the role of the TypeScript Synapse library.

Quick start::

    from synapse.persistence import PersistenceOptions, initialize_persistence
    from synapse import (
        FirestoreResumeDocumentStore,
        FirestoreResumeEmbeddingStore,
    )

    initialize_persistence(PersistenceOptions(project_id="my-project"))
    resume_store = FirestoreResumeDocumentStore()
    embedding_store = FirestoreResumeEmbeddingStore()
"""

from synapse.errors import (
    AppError,
    ConflictError,
    DownstreamError,
    ForbiddenError,
    NotFoundError,
    RateLimitError,
    UnauthorizedError,
    UnavailableError,
    ValidationError,
    is_app_error,
)
from synapse.interfaces.resume_document_store import (
    IResumeDocumentStore,
    ResumeDocument,
)
from synapse.interfaces.resume_embedding_store import (
    IResumeEmbeddingStore,
    ResumeEmbeddingEntry,
)
from synapse.persistence import (
    PersistenceOptions,
    get_db,
    initialize_persistence,
    terminate_persistence,
)
from synapse.repositories.firestore_resume_document_store import (
    FirestoreResumeDocumentStore,
)
from synapse.repositories.firestore_resume_embedding_store import (
    FirestoreResumeEmbeddingStore,
)

__all__ = [
    # Persistence lifecycle
    "PersistenceOptions",
    "initialize_persistence",
    "terminate_persistence",
    "get_db",
    # Resume document store
    "IResumeDocumentStore",
    "ResumeDocument",
    "FirestoreResumeDocumentStore",
    # Resume embedding store
    "IResumeEmbeddingStore",
    "ResumeEmbeddingEntry",
    "FirestoreResumeEmbeddingStore",
    # Error classes (re-exported from Toolbox)
    "AppError",
    "NotFoundError",
    "UnauthorizedError",
    "ValidationError",
    "ConflictError",
    "ForbiddenError",
    "DownstreamError",
    "UnavailableError",
    "RateLimitError",
    "is_app_error",
]
