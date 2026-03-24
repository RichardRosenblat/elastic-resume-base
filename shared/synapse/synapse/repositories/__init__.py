"""Public re-exports for the synapse.repositories sub-package."""

from synapse.repositories.firestore_resume_document_store import (
    FirestoreResumeDocumentStore,
)
from synapse.repositories.firestore_resume_embedding_store import (
    FirestoreResumeEmbeddingStore,
)

__all__ = ["FirestoreResumeDocumentStore", "FirestoreResumeEmbeddingStore"]
