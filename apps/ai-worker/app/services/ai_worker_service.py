"""Core processing pipeline for the AI Worker service.

Orchestrates the full resume AI processing pipeline:

1. Mark the resume as ``PROCESSING`` in Firestore.
2. Retrieve raw resume text from Firestore via Synapse.
3. Extract structured fields using Vertex AI (Gemini).
4. Persist the structured fields back to Firestore.
5. Generate semantic embedding vectors using Vertex AI.
6. Persist embedding vectors to the ``embeddings`` Firestore collection.
7. Mark the resume as ``PROCESSED`` and publish to the ``resume-indexed``
   Pub/Sub topic.
8. On any error: update Firestore status to ``FAILED``, publish the failure
   to the DLQ topic, and re-raise so the caller can decide on the HTTP
   response code.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from hermes_py import IPublisher
from synapse_py.interfaces.resume_store import IResumeStore, UpdateResumeData
from toolbox_py import get_logger

from app.utils.exceptions import EmbeddingError, ExtractionError
from app.utils.kms import PII_FIELDS, decrypt_field, encrypt_pii_fields

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Processing status constants
# ---------------------------------------------------------------------------

STATUS_INGESTED = "INGESTED"
STATUS_PROCESSING = "PROCESSING"
STATUS_PROCESSED = "PROCESSED"
STATUS_FAILED = "FAILED"


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return (
        datetime.now(tz=UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _skills_text(structured_data: dict[str, Any]) -> str:
    """Build a plain-text skills string for embedding generation.

    Args:
        structured_data: Extracted resume fields dict.

    Returns:
        Comma-joined skills string, or empty string if no skills were extracted.
    """
    skills: list[Any] = structured_data.get("skills") or []
    return ", ".join(str(s) for s in skills if s)


class AIWorkerService:
    """Orchestrates the AI processing pipeline for a single resume.

    Args:
        resume_store: Synapse resume store for Firestore read/write operations.
        vertex_ai_service: Service for Vertex AI extraction and embedding calls.
        publisher: Hermes publisher for Pub/Sub message dispatch.
        embeddings_collection: Firestore collection name for embedding vectors.
        topic_resume_indexed: Pub/Sub topic name for post-processing events.
        topic_dlq: Pub/Sub topic name for dead-letter queue events.

    Example::

        service = AIWorkerService(
            resume_store=FirestoreResumeStore(),
            vertex_ai_service=vertex_ai_svc,
            publisher=get_publisher(),
            embeddings_collection="embeddings",
            topic_resume_indexed="resume-indexed",
            topic_dlq="dead-letter-queue",
        )
        await service.process_resume("abc-123")
    """

    def __init__(
        self,
        resume_store: IResumeStore,
        vertex_ai_service: Any,
        publisher: IPublisher,
        embeddings_collection: str,
        topic_resume_indexed: str,
        topic_dlq: str,
        encrypt_kms_key_name: str = "",
        decrypt_raw_text_kms_key_name: str = "",
    ) -> None:
        """Initialise the AI Worker service.

        Args:
            resume_store: Synapse resume store.
            vertex_ai_service: Vertex AI service wrapper.
            publisher: Hermes Pub/Sub publisher.
            embeddings_collection: Firestore embeddings collection name.
            topic_resume_indexed: Pub/Sub topic to publish to on success.
            topic_dlq: Pub/Sub dead-letter queue topic.
            encrypt_kms_key_name: Cloud KMS key name for encrypting PII fields before
                Firestore persistence.  Pass an empty string to skip encryption
                (local development).
            decrypt_raw_text_kms_key_name: Cloud KMS key name for decrypting the raw
                resume text stored by the Ingestor service.  Must match the key used
                by the Ingestor to encrypt the text.  Pass an empty string to read the
                raw text as-is (local development).
        """
        self._store = resume_store
        self._vertex_ai = vertex_ai_service
        self._publisher = publisher
        self._embeddings_collection = embeddings_collection
        self._topic_resume_indexed = topic_resume_indexed
        self._topic_dlq = topic_dlq
        self._encrypt_kms_key_name = encrypt_kms_key_name
        self._decrypt_raw_text_kms_key_name = decrypt_raw_text_kms_key_name

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def process_resume(self, resume_id: str) -> None:
        """Run the full AI processing pipeline for *resume_id*.

        Steps:
            1. Mark resume as ``PROCESSING``.
            2. Fetch raw text from Firestore and decrypt with Cloud KMS (if configured).
            3. Extract structured fields with Vertex AI.
            4. Encrypt PII fields with Cloud KMS (if configured).
            5. Update Firestore with structured fields.
            6. Generate embeddings for full text and skills.
            7. Persist embeddings to the ``embeddings`` collection.
            8. Mark resume as ``PROCESSED``.
            9. Publish ``{ resumeId }`` to the ``resume-indexed`` topic.

        On any failure the resume status is updated to ``FAILED``, the error
        is published to the DLQ topic, and the exception is re-raised.

        Args:
            resume_id: Firestore document ID of the resume to process.

        Raises:
            Exception: Any exception raised during pipeline execution, after
                DLQ publication and status update.
        """
        logger.info("Starting AI processing", extra={"resume_id": resume_id})

        # Step 1 — mark as PROCESSING so downstream can observe progress.
        self._update_status(resume_id, STATUS_PROCESSING, extra_metadata={})

        try:
            # Step 2 — fetch raw text and decrypt if KMS is configured.
            resume = self._store.get_resume(resume_id)
            raw_text = decrypt_field(resume.raw_text, self._decrypt_raw_text_kms_key_name)
            if not raw_text.strip():
                raise ValueError(f"Resume '{resume_id}' has empty raw_text.")

            # Step 3 — extract structured fields.
            logger.info(
                "Extracting structured fields",
                extra={"resume_id": resume_id},
            )
            structured_data = self._vertex_ai.extract_structured_fields(raw_text)

            # Step 4 -- persist structured data (encrypt PII fields first).
            logger.info(
                "Encrypting PII fields",
                extra={"resume_id": resume_id, "kms_configured": bool(self._encrypt_kms_key_name)},
            )
            structured_data_to_store = encrypt_pii_fields(
                structured_data, PII_FIELDS, self._encrypt_kms_key_name
            )
            merged_metadata = dict(resume.metadata)
            merged_metadata["structuredData"] = structured_data_to_store
            merged_metadata["processingInfo"] = {
                "processedAt": _now_iso(),
                "errors": [],
            }
            self._store.update_resume(
                resume_id,
                UpdateResumeData(status=STATUS_PROCESSING, metadata=merged_metadata),
            )

            # Step 5 — generate embeddings.
            logger.info(
                "Generating embeddings",
                extra={"resume_id": resume_id},
            )
            skills_text = _skills_text(structured_data)
            texts_to_embed = [raw_text]
            embed_skills = bool(skills_text)
            if embed_skills:
                texts_to_embed.append(skills_text)

            embedding_vectors = self._vertex_ai.generate_embeddings(texts_to_embed)
            expected_count = len(texts_to_embed)
            if len(embedding_vectors) != expected_count:
                raise EmbeddingError(
                    f"Expected {expected_count} embedding vector(s) but received "
                    f"{len(embedding_vectors)}."
                )
            full_text_embedding = embedding_vectors[0]
            skills_embedding = embedding_vectors[1] if embed_skills else []

            # Step 6 — persist embeddings to the dedicated collection.
            self._save_embeddings(
                resume_id=resume_id,
                full_text_embedding=full_text_embedding,
                skills_embedding=skills_embedding,
            )

            # Step 7 — mark as PROCESSED.
            self._store.update_resume(
                resume_id,
                UpdateResumeData(status=STATUS_PROCESSED),
            )

            # Step 8 — publish downstream event.
            self._publisher.publish(
                self._topic_resume_indexed,
                {"resumeId": resume_id},
            )

            logger.info(
                "AI processing completed successfully",
                extra={"resume_id": resume_id},
            )

        except Exception as exc:
            self._handle_error(resume_id, exc)
            raise

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _update_status(
        self,
        resume_id: str,
        status: str,
        extra_metadata: dict[str, Any],
    ) -> None:
        """Update the Firestore status field (and optionally merge metadata).

        Args:
            resume_id: Firestore document ID.
            status: New status string.
            extra_metadata: Additional metadata fields to merge.  Pass an
                empty dict when no metadata update is required.
        """
        update_data: UpdateResumeData
        if extra_metadata:
            try:
                resume = self._store.get_resume(resume_id)
                merged = {**resume.metadata, **extra_metadata}
            except Exception:
                merged = extra_metadata
            update_data = UpdateResumeData(status=status, metadata=merged)
        else:
            update_data = UpdateResumeData(status=status)
        try:
            self._store.update_resume(resume_id, update_data)
        except Exception as exc:
            logger.warning(
                "Failed to update resume status",
                extra={"resume_id": resume_id, "status": status, "error": str(exc)},
            )

    def _save_embeddings(
        self,
        resume_id: str,
        full_text_embedding: list[float],
        skills_embedding: list[float],
    ) -> None:
        """Persist embedding vectors to the Firestore embeddings collection.

        Writes (or overwrites) a document at
        ``{embeddings_collection}/{resume_id}`` with the provided vectors and
        a timestamp.

        Args:
            resume_id: Firestore document ID (used as the embedding doc ID).
            full_text_embedding: Vector for the full resume text.
            skills_embedding: Vector for the extracted skills text.

        Raises:
            Exception: If the Firestore write fails.
        """
        try:
            from firebase_admin import firestore  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ImportError(
                "The 'firebase-admin' package is required. "
                "Install it with: pip install firebase-admin"
            ) from exc

        now = _now_iso()
        payload: dict[str, Any] = {
            "resumeId": resume_id,
            "fullTextEmbedding": full_text_embedding,
            "skillsEmbedding": skills_embedding,
            "createdAt": now,
            "updatedAt": now,
        }
        try:
            db = firestore.client()
            db.collection(self._embeddings_collection).document(resume_id).set(payload)
        except Exception as exc:
            logger.error(
                "Failed to save embeddings to Firestore: %s",
                exc,
                extra={"resume_id": resume_id},
            )
            raise

        logger.debug(
            "Embeddings saved",
            extra={
                "resume_id": resume_id,
                "full_text_dims": len(full_text_embedding),
                "skills_dims": len(skills_embedding),
            },
        )

    def _handle_error(self, resume_id: str, exc: Exception) -> None:
        """Handle a pipeline failure: update Firestore and publish to DLQ.

        Args:
            resume_id: Firestore document ID of the failed resume.
            exc: The exception that caused the failure.
        """
        error_message = str(exc)
        error_type = type(exc).__name__

        logger.error(
            "AI processing failed",
            extra={
                "resume_id": resume_id,
                "error_type": error_type,
                "error": error_message,
            },
        )

        # Determine which pipeline stage failed.
        if isinstance(exc, ExtractionError):
            stage = "extraction"
        elif isinstance(exc, EmbeddingError):
            stage = "embedding"
        else:
            stage = "unknown"

        error_metadata: dict[str, Any] = {
            "processingInfo": {
                "failedAt": _now_iso(),
                "errors": [
                    {
                        "stage": stage,
                        "errorType": error_type,
                        "errorMessage": error_message,
                    }
                ],
            }
        }
        self._update_status(resume_id, STATUS_FAILED, extra_metadata=error_metadata)

        # Attempt to retrieve the userId stored in the resume's Firestore metadata
        # so the DLQ Notifier can route the notification to the right user.
        user_id: str | None = None
        try:
            resume = self._store.get_resume(resume_id)
            metadata = resume.metadata if isinstance(resume.metadata, dict) else {}
            user_id = metadata.get("userId") or metadata.get("user_id")
        except Exception:
            pass  # Best-effort — missing userId is non-critical

        # Publish to DLQ so the operations team can investigate.
        try:
            dlq_payload: dict[str, Any] = {
                "resumeId": resume_id,
                "errorType": error_type,
                "errorMessage": error_message,
                "stage": stage,
                "failedAt": _now_iso(),
            }
            if user_id:
                dlq_payload["userId"] = user_id
            self._publisher.publish(self._topic_dlq, dlq_payload)
        except Exception as dlq_exc:
            logger.warning(
                "Failed to publish error to DLQ: %s",
                dlq_exc,
                extra={"resume_id": resume_id},
            )
