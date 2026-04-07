"""FAISS-based search service for semantic resume search.

Manages an in-memory FAISS index with optional disk persistence.  Provides
methods to add new resume embeddings, perform similarity search, rebuild the
index from Firestore, and save/load the index to/from disk.

The service supports multiple embedding types per resume (e.g. ``fullText``,
``skills``, and other field-level embeddings).  Each embedding type is stored
as a separate FAISS vector, keyed by ``{resume_id}:{embedding_type}``.  Search
results are aggregated by ``resume_id``, returning the best score across all
embedding types for each resume.

On startup the service attempts to load an existing index from the path
configured by ``FAISS_INDEX_PATH``.  If no persisted index is found, it falls
back to rebuilding the index from all documents in the Firestore embeddings
collection.  The index is saved back to disk after every update so that it
survives container restarts.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import UTC, datetime
from typing import Any

import faiss
import numpy as np
from firebase_admin import firestore
from toolbox_py import get_logger

from app.config import settings
from app.utils.exceptions import (
    EmbeddingGenerationError,
    FaissIndexError,
    IndexNotReadyError,
)
from app.utils.kms import PII_FIELDS, decrypt_pii_fields

logger = get_logger(__name__)

# Suffix appended to index_path for the JSON metadata sidecar file.
_METADATA_SUFFIX = ".metadata.json"

# Embedding fields that the AI Worker stores in the embeddings collection.
# Any document field whose name ends with "Embedding" is also picked up
# dynamically, so future field-level embeddings are indexed automatically.
_KNOWN_EMBEDDING_TYPES = ("fullText", "skills")

# When searching, we retrieve this many raw FAISS results per unique resume
# we want (at minimum) to ensure enough candidates remain after per-resume
# deduplication (i.e. when a resume has multiple embedding vectors).
_MIN_DEDUP_MULTIPLIER = 5


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return (
        datetime.now(tz=UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _embedding_field_to_type(field_name: str) -> str:
    """Convert a Firestore field name to an embedding type label.

    Examples::

        >>> _embedding_field_to_type("fullTextEmbedding")
        'fullText'
        >>> _embedding_field_to_type("skillsEmbedding")
        'skills'

    Args:
        field_name: Firestore field name ending in ``"Embedding"``.

    Returns:
        Embedding type label (field name without the ``"Embedding"`` suffix).
    """
    if field_name.endswith("Embedding"):
        return field_name[: -len("Embedding")]
    return field_name


class SearchService:
    """FAISS-based semantic search service.

    Manages a vector index for resume embeddings, provides similarity search,
    and handles index persistence.

    Each resume may have multiple embedding vectors (one per embedding type,
    e.g. full-text and skills).  Vectors are stored with keys of the form
    ``"{resume_id}:{embedding_type}"``.  Search results are deduplicated by
    ``resume_id`` and ranked by the best matching score across all embedding
    types.

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

        # FAISS index and positional vector-key list.
        # Each entry in _vector_keys maps positionally to the corresponding
        # FAISS vector: _vector_keys[i] == "{resume_id}:{embedding_type}".
        self._index: faiss.Index | None = None
        self._vector_keys: list[str] = []
        self._vector_key_set: set[str] = set()
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

    # ------------------------------------------------------------------
    # Backward-compatible property
    # ------------------------------------------------------------------

    @property
    def _resume_ids(self) -> list[str]:
        """Backward-compatible list of resume IDs (one entry per vector).

        Returns:
            List of resume IDs extracted from ``_vector_keys`` by stripping
            the embedding-type suffix.
        """
        return [key.split(":", 1)[0] for key in self._vector_keys]

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------

    def initialize(self) -> None:
        """Initialize or load the FAISS index.

        Lookup order:

        1. If a serialised index file exists at ``index_path``, load it.
        2. Otherwise, if a GCP project is configured, rebuild the index from
           all documents in the Firestore embeddings collection.
        3. Otherwise (local development without GCP), create an empty index.
        """
        with self._lock:
            if self.index_path and os.path.exists(self.index_path):
                logger.info("Loading FAISS index from disk", extra={"path": self.index_path})
                try:
                    self._load_from_disk()
                    return
                except Exception as exc:
                    logger.error(
                        "Failed to load index from disk, will rebuild: %s", exc
                    )

            # No persisted file — try to rebuild from Firestore.
            if settings.gcp_project_id:
                logger.info(
                    "No persisted index found. Rebuilding from Firestore embeddings."
                )
                try:
                    self.rebuild_index_from_firestore()
                    return
                except Exception as exc:
                    logger.error(
                        "Failed to rebuild index from Firestore, starting empty: %s", exc
                    )

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
        self._vector_keys = []
        self._vector_key_set = set()
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

    # ------------------------------------------------------------------
    # Index mutation
    # ------------------------------------------------------------------

    def add_resume_embedding(self, resume_id: str, embedding: list[float]) -> None:
        """Add a single full-text embedding for a resume.

        This is the backward-compatible single-vector variant.  It delegates
        to :meth:`add_resume_embeddings` with the ``"fullText"`` type.

        Args:
            resume_id: Unique identifier for the resume.
            embedding: Embedding vector (768-dimensional).

        Raises:
            FaissIndexError: If the index has not been initialized or the
                embedding dimension is incorrect.
        """
        self.add_resume_embeddings(resume_id, {"fullText": embedding})

    def add_resume_embeddings(
        self,
        resume_id: str,
        embeddings: dict[str, list[float]],
        mark_indexed: bool = True,
    ) -> int:
        """Add one or more typed embeddings for a resume to the FAISS index.

        Embeddings are keyed by embedding type (e.g. ``"fullText"``,
        ``"skills"``).  Duplicate ``(resume_id, embedding_type)`` pairs are
        silently skipped.  After new vectors are added the index is saved to
        disk (if ``index_path`` is configured) and the resume is marked as
        indexed in Firestore.

        Args:
            resume_id: Unique identifier for the resume.
            embeddings: Mapping of embedding type label → vector.
            mark_indexed: If ``True`` (default), update the resume document in
                Firestore after successfully adding vectors.

        Returns:
            The number of new vectors actually added (0 if all were duplicates).

        Raises:
            FaissIndexError: If the index has not been initialized or an
                embedding dimension is incorrect.
        """
        added = 0
        with self._lock:
            if self._index is None:
                raise FaissIndexError("Index not initialized")

            for embedding_type, embedding in embeddings.items():
                vector_key = f"{resume_id}:{embedding_type}"

                if vector_key in self._vector_key_set:
                    logger.debug(
                        "Vector already in index, skipping duplicate",
                        extra={"resume_id": resume_id, "embedding_type": embedding_type},
                    )
                    continue

                if len(embedding) != self.embedding_dim:
                    raise FaissIndexError(
                        f"Embedding dimension mismatch for type '{embedding_type}': "
                        f"expected {self.embedding_dim}, got {len(embedding)}"
                    )

                vector = np.array(embedding, dtype=np.float32).reshape(1, -1)
                vector = self._normalize_vector(vector)

                self._index.add(vector)
                self._vector_keys.append(vector_key)
                self._vector_key_set.add(vector_key)
                added += 1

                logger.debug(
                    "Added vector to index",
                    extra={
                        "resume_id": resume_id,
                        "embedding_type": embedding_type,
                        "total_vectors": len(self._vector_keys),
                    },
                )

        if added > 0:
            logger.info(
                "Added resume embeddings to index",
                extra={
                    "resume_id": resume_id,
                    "vectors_added": added,
                    "total_vectors": len(self._vector_keys),
                },
            )
            if self.index_path:
                self.save_to_disk()
            if mark_indexed:
                self._mark_resume_indexed(resume_id)
        else:
            logger.info(
                "Resume already fully indexed, skipping",
                extra={"resume_id": resume_id},
            )

        return added

    def _mark_resume_indexed(self, resume_id: str) -> None:
        """Mark a resume as indexed in the Firestore ``resumes`` collection.

        Uses a partial Firestore update (dot-notation path) so that other
        metadata fields are not overwritten.  Errors are logged and suppressed
        because a missing Firestore update is non-critical — the in-memory
        ``_vector_key_set`` handles deduplication within the same process
        lifetime, and the persisted FAISS index handles it across restarts.

        Args:
            resume_id: The Firestore document ID of the resume.
        """
        try:
            resumes_ref = self._db.collection(settings.firestore_collection_resumes)
            resumes_ref.document(resume_id).update(
                {"metadata.searchIndexInfo.faissIndexedAt": _now_iso()}
            )
            logger.debug(
                "Marked resume as indexed in Firestore",
                extra={"resume_id": resume_id},
            )
        except Exception as exc:
            logger.warning(
                "Failed to mark resume as indexed in Firestore (non-critical): %s",
                exc,
                extra={"resume_id": resume_id},
            )

    # ------------------------------------------------------------------
    # Similarity search
    # ------------------------------------------------------------------

    def search(
        self, query_embedding: list[float], top_k: int = 10
    ) -> list[tuple[str, float]]:
        """Perform similarity search against the FAISS index.

        When a resume has multiple embedding vectors (e.g. full-text and
        skills), the results are deduplicated by ``resume_id`` and ranked by
        the *best* score found across all embedding types for that resume.

        Args:
            query_embedding: Query embedding vector (768-dimensional).
            top_k: Maximum number of *unique resume* results to return (default 10).

        Returns:
            List of (resume_id, best_similarity_score) tuples, ranked by score.

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

            # Retrieve more raw results than top_k to account for
            # per-resume deduplication (multiple vectors per resume).
            # We fetch up to min(ntotal, top_k * 5) to have enough candidates.
            k_raw = min(self._index.ntotal, top_k * max(_MIN_DEDUP_MULTIPLIER, len(_KNOWN_EMBEDDING_TYPES) + 1))

            distances, indices = self._index.search(query_vector, k_raw)

            # Aggregate by resume_id, keeping the best (highest) score.
            best_scores: dict[str, float] = {}
            for i, idx in enumerate(indices[0]):
                if idx < 0 or idx >= len(self._vector_keys):
                    continue
                vector_key = self._vector_keys[idx]
                resume_id = vector_key.split(":", 1)[0]
                score = float(distances[0][i])
                if resume_id not in best_scores or score > best_scores[resume_id]:
                    best_scores[resume_id] = score

            # Sort by descending score and cap at top_k unique resumes.
            results = sorted(best_scores.items(), key=lambda x: x[1], reverse=True)[
                :top_k
            ]

            logger.info(
                "Search completed",
                extra={"results_count": len(results), "top_k": top_k},
            )
            return results

    # ------------------------------------------------------------------
    # Index rebuild
    # ------------------------------------------------------------------

    def rebuild_index_from_firestore(self) -> None:
        """Rebuild the FAISS index from all embeddings stored in Firestore.

        Fetches all documents from the embeddings collection and indexes every
        recognized embedding vector (``fullTextEmbedding``, ``skillsEmbedding``,
        and any other field whose name ends with ``"Embedding"``).

        The rebuilt index is saved to disk after completion (if ``index_path``
        is configured).
        """
        logger.info("Starting index rebuild from Firestore")

        with self._lock:
            self._create_empty_index()

            embeddings_ref = self._db.collection(settings.firestore_collection_embeddings)
            docs = embeddings_ref.stream()

            vectors_added = 0
            resumes_added = 0

            for doc in docs:
                data = doc.to_dict() or {}
                resume_id = doc.id

                # Discover all embedding fields in this document.
                embedding_fields = {
                    k: v
                    for k, v in data.items()
                    if k.endswith("Embedding") and isinstance(v, list) and len(v) > 0
                }

                if not embedding_fields:
                    logger.warning(
                        "No embedding vectors found for resume, skipping",
                        extra={"resume_id": resume_id},
                    )
                    continue

                resume_vector_count = 0
                for field_name, embedding in embedding_fields.items():
                    embedding_type = _embedding_field_to_type(field_name)
                    vector_key = f"{resume_id}:{embedding_type}"

                    if len(embedding) != self.embedding_dim:
                        logger.warning(
                            "Skipping embedding with wrong dimension",
                            extra={
                                "resume_id": resume_id,
                                "embedding_type": embedding_type,
                                "expected_dim": self.embedding_dim,
                                "actual_dim": len(embedding),
                            },
                        )
                        continue

                    vector = np.array(embedding, dtype=np.float32).reshape(1, -1)
                    vector = self._normalize_vector(vector)
                    self._index.add(vector)
                    self._vector_keys.append(vector_key)
                    self._vector_key_set.add(vector_key)
                    vectors_added += 1
                    resume_vector_count += 1

                if resume_vector_count > 0:
                    resumes_added += 1

            logger.info(
                "Index rebuild complete",
                extra={"resumes_indexed": resumes_added, "total_vectors": vectors_added},
            )

        if self.index_path:
            self.save_to_disk()

    # ------------------------------------------------------------------
    # Disk persistence
    # ------------------------------------------------------------------

    def save_to_disk(self) -> None:
        """Save the FAISS index to the configured ``index_path``.

        Writes two files:

        * ``{index_path}`` — the binary FAISS index.
        * ``{index_path}.metadata.json`` — JSON array of vector keys
          (``"{resume_id}:{embedding_type}"``) that maps positionally to the
          FAISS vectors.

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
                index_dir = os.path.dirname(self.index_path)
                if index_dir:
                    os.makedirs(index_dir, exist_ok=True)

                faiss.write_index(self._index, self.index_path)

                metadata_path = self.index_path + _METADATA_SUFFIX
                with open(metadata_path, "w") as f:
                    json.dump(self._vector_keys, f)

                logger.info(
                    "Index saved to disk",
                    extra={
                        "path": self.index_path,
                        "total_vectors": len(self._vector_keys),
                    },
                )
            except Exception as exc:
                logger.error("Failed to save index to disk: %s", exc)
                raise FaissIndexError(f"Failed to save index: {exc}") from exc

    def _load_from_disk(self) -> None:
        """Load the FAISS index and vector-key metadata from disk.

        Reads:

        * ``{index_path}`` — the binary FAISS index.
        * ``{index_path}.metadata.json`` — JSON array of vector keys.

        Falls back gracefully to an empty key list if the metadata sidecar is
        absent (e.g. index was saved by an older version of the service).

        Raises:
            FaissIndexError: If loading the FAISS binary fails.
        """
        try:
            self._index = faiss.read_index(self.index_path)

            metadata_path = self.index_path + _METADATA_SUFFIX
            self._vector_keys = []
            self._vector_key_set = set()

            if os.path.exists(metadata_path):
                with open(metadata_path, "r") as f:
                    keys = json.load(f)
                self._vector_keys = [str(k) for k in keys]
                self._vector_key_set = set(self._vector_keys)
            else:
                # Legacy fallback: plain-text file with one resume_id per line.
                legacy_path = f"{self.index_path}.metadata"
                if os.path.exists(legacy_path):
                    with open(legacy_path, "r") as f:
                        for line in f:
                            key = line.strip()
                            if key:
                                # Treat legacy entries as fullText type.
                                typed_key = (
                                    key
                                    if ":" in key
                                    else f"{key}:fullText"
                                )
                                self._vector_keys.append(typed_key)
                    self._vector_key_set = set(self._vector_keys)

            logger.info(
                "Index loaded from disk",
                extra={
                    "path": self.index_path,
                    "total_vectors": len(self._vector_keys),
                },
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
