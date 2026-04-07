"""FAISS-based search service for semantic resume search.

Manages an in-memory FAISS index with optional disk persistence.  Provides
methods to add new resume embeddings, perform similarity search, rebuild the
index from Firestore, and save/load the index to/from disk.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any

import faiss
import numpy as np
from firebase_admin import firestore
from google.cloud.firestore_v1 import FieldFilter
from synapse_py import FirestoreResumeStore, initialize_persistence
from toolbox_py import get_logger

from app.config import settings
from app.utils.exceptions import (
    EmbeddingGenerationError,
    FaissIndexError,
    IndexNotReadyError,
)
from app.utils.kms import PII_FIELDS, decrypt_pii_fields

logger = get_logger(__name__)


class SearchService:
    """FAISS-based semantic search service.

    Manages a vector index for resume embeddings, provides similarity search,
    and handles index persistence.

    Attributes:
        embedding_dim: Dimensionality of embedding vectors (768 for
            text-multilingual-embedding-002).
        index_path: Optional file path for persisting the FAISS index.
        metric: Distance metric ("cosine" or "l2").
        decrypt_kms_key_name: KMS key name for decrypting PII fields (empty to skip).
    """

    def __init__(
        self,
        embedding_dim: int = 768,
        index_path: str = "",
        metric: str = "cosine",
        decrypt_kms_key_name: str = "",
    ):
        """Initialize the search service.

        Args:
            embedding_dim: Dimensionality of embedding vectors (default 768).
            index_path: Optional file path for disk persistence (default empty).
            metric: Distance metric, either "cosine" or "l2" (default "cosine").
            decrypt_kms_key_name: KMS key name for PII decryption (default empty).
        """
        self.embedding_dim = embedding_dim
        self.index_path = index_path
        self.metric = metric
        self.decrypt_kms_key_name = decrypt_kms_key_name

        # FAISS index and metadata
        self._index: faiss.Index | None = None
        self._resume_ids: list[str] = []
        self._lock = threading.RLock()

        # Initialize Firestore client
        self._db = firestore.client()

        logger.info(
            "SearchService initialized",
            extra={
                "embedding_dim": embedding_dim,
                "index_path": index_path or "(in-memory only)",
                "metric": metric,
                "decrypt_enabled": bool(decrypt_kms_key_name),
            },
        )

    def initialize(self) -> None:
        """Initialize or load the FAISS index.

        If an index file exists at ``index_path``, loads it from disk.
        Otherwise, creates a new empty index.
        """
        with self._lock:
            if self.index_path and os.path.exists(self.index_path):
                logger.info("Loading FAISS index from disk", extra={"path": self.index_path})
                try:
                    self._load_from_disk()
                except Exception as exc:
                    logger.error("Failed to load index from disk: %s", exc)
                    logger.info("Creating new empty index")
                    self._create_empty_index()
            else:
                logger.info("Creating new empty FAISS index")
                self._create_empty_index()

    def _create_empty_index(self) -> None:
        """Create a new empty FAISS index."""
        if self.metric == "cosine":
            # Use Inner Product with L2-normalized vectors for cosine similarity
            self._index = faiss.IndexFlatIP(self.embedding_dim)
        elif self.metric == "l2":
            # Use L2 (Euclidean) distance
            self._index = faiss.IndexFlatL2(self.embedding_dim)
        else:
            raise ValueError(f"Unsupported metric: {self.metric}")
        self._resume_ids = []
        logger.debug("Empty FAISS index created")

    def _normalize_vector(self, vector: np.ndarray) -> np.ndarray:
        """L2-normalize a vector for cosine similarity.

        Args:
            vector: Input vector (can be 1D or 2D).

        Returns:
            L2-normalized vector.
        """
        if self.metric != "cosine":
            return vector
        norm = np.linalg.norm(vector, axis=-1, keepdims=True)
        # Avoid division by zero
        norm = np.where(norm == 0, 1.0, norm)
        return vector / norm

    def add_resume_embedding(self, resume_id: str, embedding: list[float]) -> None:
        """Add a resume embedding to the FAISS index.

        Args:
            resume_id: Unique identifier for the resume.
            embedding: Embedding vector (768-dimensional).

        Raises:
            FaissIndexError: If the index has not been initialized or the
                embedding dimension is incorrect.
        """
        with self._lock:
            if self._index is None:
                raise FaissIndexError("Index not initialized")

            if len(embedding) != self.embedding_dim:
                raise FaissIndexError(
                    f"Embedding dimension mismatch: expected {self.embedding_dim}, "
                    f"got {len(embedding)}"
                )

            # Convert to numpy array and normalize if using cosine
            vector = np.array(embedding, dtype=np.float32).reshape(1, -1)
            vector = self._normalize_vector(vector)

            # Check if resume already exists in index
            if resume_id in self._resume_ids:
                logger.warning(
                    "Resume already in index, skipping duplicate",
                    extra={"resume_id": resume_id},
                )
                return

            # Add to FAISS index
            self._index.add(vector)
            self._resume_ids.append(resume_id)

            logger.info(
                "Added resume to index",
                extra={"resume_id": resume_id, "total_vectors": len(self._resume_ids)},
            )

    def search(
        self, query_embedding: list[float], top_k: int = 10
    ) -> list[tuple[str, float]]:
        """Perform similarity search against the FAISS index.

        Args:
            query_embedding: Query embedding vector (768-dimensional).
            top_k: Maximum number of results to return (default 10).

        Returns:
            List of (resume_id, similarity_score) tuples, ranked by score.

        Raises:
            IndexNotReadyError: If the index is empty or not initialized.
            FaissIndexError: If the query dimension is incorrect.
        """
        with self._lock:
            if self._index is None:
                raise IndexNotReadyError("Index not initialized")

            if self._index.ntotal == 0:
                raise IndexNotReadyError("Index is empty")

            if len(query_embedding) != self.embedding_dim:
                raise FaissIndexError(
                    f"Query dimension mismatch: expected {self.embedding_dim}, "
                    f"got {len(query_embedding)}"
                )

            # Convert to numpy array and normalize if using cosine
            query_vector = np.array(query_embedding, dtype=np.float32).reshape(1, -1)
            query_vector = self._normalize_vector(query_vector)

            # Limit top_k to the actual number of vectors in the index
            k = min(top_k, self._index.ntotal)

            # Perform search
            distances, indices = self._index.search(query_vector, k)

            # Build results
            results: list[tuple[str, float]] = []
            for i, idx in enumerate(indices[0]):
                if idx < 0 or idx >= len(self._resume_ids):
                    continue
                resume_id = self._resume_ids[idx]
                score = float(distances[0][i])
                results.append((resume_id, score))

            logger.info(
                "Search completed",
                extra={"results_count": len(results), "top_k": top_k},
            )
            return results

    def rebuild_index_from_firestore(self) -> None:
        """Rebuild the FAISS index from all embeddings in Firestore.

        Fetches all documents from the embeddings collection and rebuilds
        the index from scratch.
        """
        logger.info("Starting index rebuild from Firestore")

        with self._lock:
            # Create a new empty index
            self._create_empty_index()

            # Fetch all embeddings from Firestore
            embeddings_ref = self._db.collection(settings.firestore_collection_embeddings)
            docs = embeddings_ref.stream()

            count = 0
            for doc in docs:
                data = doc.to_dict()
                resume_id = doc.id

                # Use fullTextEmbedding for search (768-dim)
                embedding = data.get("fullTextEmbedding")
                if not embedding:
                    logger.warning(
                        "Missing fullTextEmbedding for resume, skipping",
                        extra={"resume_id": resume_id},
                    )
                    continue

                # Add to index (without lock, we're already holding it)
                vector = np.array(embedding, dtype=np.float32).reshape(1, -1)
                vector = self._normalize_vector(vector)
                self._index.add(vector)
                self._resume_ids.append(resume_id)
                count += 1

            logger.info(
                "Index rebuild complete",
                extra={"total_vectors": count},
            )

        # Save to disk if configured
        if self.index_path:
            self.save_to_disk()

    def save_to_disk(self) -> None:
        """Save the FAISS index to disk.

        Persists both the FAISS index and the resume ID mapping to the
        configured ``index_path``.

        Raises:
            FaissIndexError: If the index has not been initialized or no path
                is configured.
        """
        if not self.index_path:
            logger.debug("No index path configured, skipping save")
            return

        with self._lock:
            if self._index is None:
                raise FaissIndexError("Index not initialized")

            try:
                # Create directory if needed
                os.makedirs(os.path.dirname(self.index_path), exist_ok=True)

                # Save FAISS index
                faiss.write_index(self._index, self.index_path)

                # Save resume ID mapping
                metadata_path = f"{self.index_path}.metadata"
                with open(metadata_path, "w") as f:
                    for resume_id in self._resume_ids:
                        f.write(f"{resume_id}\n")

                logger.info(
                    "Index saved to disk",
                    extra={"path": self.index_path, "total_vectors": len(self._resume_ids)},
                )
            except Exception as exc:
                logger.error("Failed to save index to disk: %s", exc)
                raise FaissIndexError(f"Failed to save index: {exc}") from exc

    def _load_from_disk(self) -> None:
        """Load the FAISS index from disk.

        Loads both the FAISS index and the resume ID mapping from the
        configured ``index_path``.

        Raises:
            FaissIndexError: If loading fails.
        """
        try:
            # Load FAISS index
            self._index = faiss.read_index(self.index_path)

            # Load resume ID mapping
            metadata_path = f"{self.index_path}.metadata"
            self._resume_ids = []
            if os.path.exists(metadata_path):
                with open(metadata_path, "r") as f:
                    for line in f:
                        self._resume_ids.append(line.strip())

            logger.info(
                "Index loaded from disk",
                extra={"path": self.index_path, "total_vectors": len(self._resume_ids)},
            )
        except Exception as exc:
            logger.error("Failed to load index from disk: %s", exc)
            raise FaissIndexError(f"Failed to load index: {exc}") from exc

    def get_resume_metadata(self, resume_id: str) -> dict[str, Any]:
        """Fetch resume metadata from Firestore.

        Args:
            resume_id: Unique identifier for the resume.

        Returns:
            Dictionary containing structured resume data with PII fields
            decrypted (if KMS is configured).

        Raises:
            ValueError: If the resume document is not found or has no metadata.
        """
        resumes_ref = self._db.collection(settings.firestore_collection_resumes)
        doc = resumes_ref.document(resume_id).get()

        if not doc.exists:
            raise ValueError(f"Resume not found: {resume_id}")

        data = doc.to_dict()
        metadata = data.get("metadata", {})
        structured_data = metadata.get("structuredData", {})

        if not structured_data:
            raise ValueError(f"No structured data for resume: {resume_id}")

        # Decrypt PII fields if KMS is configured
        if self.decrypt_kms_key_name:
            structured_data = decrypt_pii_fields(
                structured_data,
                PII_FIELDS,
                self.decrypt_kms_key_name,
            )

        return structured_data

    def generate_query_embedding(self, query_text: str) -> list[float]:
        """Generate an embedding vector for a natural language query.

        Uses Vertex AI's text-multilingual-embedding-002 model.

        Args:
            query_text: Natural language query string.

        Returns:
            768-dimensional embedding vector.

        Raises:
            EmbeddingGenerationError: If embedding generation fails.
        """
        try:
            import vertexai
            from vertexai.language_models import TextEmbeddingModel

            # Initialize Vertex AI (idempotent)
            vertexai.init(
                project=settings.gcp_project_id or "demo-project",
                location=settings.vertex_ai_location,
            )

            # Generate embedding
            model = TextEmbeddingModel.from_pretrained(settings.vertex_ai_embedding_model)
            embeddings = model.get_embeddings([query_text])

            if not embeddings or not embeddings[0].values:
                raise EmbeddingGenerationError("Empty embedding returned")

            return embeddings[0].values
        except Exception as exc:
            logger.error("Failed to generate query embedding: %s", exc)
            raise EmbeddingGenerationError(f"Embedding generation failed: {exc}") from exc
