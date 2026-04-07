"""Exception types for the Search Base service."""


class SearchServiceError(Exception):
    """Base exception for search service errors.

    Attributes:
        message: Human-readable error message.
    """

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class FaissIndexError(SearchServiceError):
    """FAISS index operation failed."""


class EmbeddingGenerationError(SearchServiceError):
    """Failed to generate embedding vector for query."""


class IndexNotReadyError(SearchServiceError):
    """FAISS index has not been initialized or is empty."""


class PubSubMessageError(SearchServiceError):
    """Malformed Pub/Sub message payload."""


class KmsDecryptionError(SearchServiceError):
    """Failed to decrypt PII field using Cloud KMS."""
