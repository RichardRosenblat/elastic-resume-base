"""Public re-exports for the synapse.interfaces sub-package."""

from synapse.interfaces.resume_document_store import IResumeDocumentStore, ResumeDocument
from synapse.interfaces.resume_embedding_store import IResumeEmbeddingStore, ResumeEmbeddingEntry

__all__ = [
    "IResumeDocumentStore",
    "ResumeDocument",
    "IResumeEmbeddingStore",
    "ResumeEmbeddingEntry",
]
