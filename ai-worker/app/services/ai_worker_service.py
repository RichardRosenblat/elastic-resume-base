"""Core AI Worker processing pipeline.

This module orchestrates the full resume processing flow:

1. Mark the resume as ``PROCESSING`` in the ``resumes`` collection via Synapse.
2. Fetch the raw resume text from Firestore via Synapse.
3. Extract structured fields using Vertex AI Gemini (rate-limited).
4. Save structured fields to the ``resumes`` collection via Synapse.
5. Generate an embedding vector using Vertex AI (rate-limited).
6. Save the embedding to the **separate** ``resume_embeddings`` collection via Synapse.
7. Mark the resume as ``PROCESSED``.
8. Publish a ``{ resumeId }`` event to the ``resume_indexing`` Pub/Sub topic via Hermes.

Any unrecoverable error is written back to Firestore (status ``FAILED``) and
a DLQ notification is sent via Hermes SMTP messaging.
"""

from __future__ import annotations

import logging

from hermes import get_messaging_service
from hermes.interfaces import Message
from hermes.interfaces.pubsub_service import IPubSubService
from synapse.interfaces.resume_document_store import IResumeDocumentStore
from synapse.interfaces.resume_embedding_store import IResumeEmbeddingStore

from app.services.vertex_ai_service import VertexAIService

logger = logging.getLogger(__name__)


class AIWorkerService:
    """Orchestrates the end-to-end resume processing pipeline.

    Args:
        resume_store: Synapse store for the ``resumes`` Firestore collection.
        embedding_store: Synapse store for the ``resume_embeddings`` collection.
        vertex_ai: Vertex AI service for extraction and embeddings.
        pubsub: Hermes Pub/Sub publisher for downstream events.
        output_topic: Pub/Sub topic to publish processed events to.
        dlq_alert_recipient: Email address for DLQ failure alerts.

    Example:
        >>> service = AIWorkerService(
        ...     resume_store=resume_store,
        ...     embedding_store=embedding_store,
        ...     vertex_ai=vertex_service,
        ...     pubsub=pubsub_service,
        ...     output_topic="resume_indexing",
        ...     dlq_alert_recipient="ops@example.com",
        ... )
        >>> await service.process("resume-abc123")
    """

    def __init__(
        self,
        resume_store: IResumeDocumentStore,
        embedding_store: IResumeEmbeddingStore,
        vertex_ai: VertexAIService,
        pubsub: IPubSubService,
        output_topic: str,
        dlq_alert_recipient: str,
    ) -> None:
        self._resume_store = resume_store
        self._embedding_store = embedding_store
        self._vertex_ai = vertex_ai
        self._pubsub = pubsub
        self._output_topic = output_topic
        self._dlq_alert_recipient = dlq_alert_recipient

    async def process(self, resume_id: str) -> None:
        """Process a single resume through the full AI pipeline.

        Steps:
        1. Mark the resume ``PROCESSING`` in the ``resumes`` collection.
        2. Fetch raw text from ``resumes`` collection.
        3. Extract structured JSON fields using Vertex AI (rate-limited).
        4. Save structured JSON to the ``resumes`` collection.
        5. Generate embedding vector using Vertex AI (rate-limited).
        6. Save embedding to the ``resume_embeddings`` collection (separate from resumes).
        7. Mark the resume ``PROCESSED``.
        8. Publish ``{ resumeId }`` to the ``resume_indexing`` Pub/Sub topic via Hermes.

        On any failure the document status is set to ``FAILED``, the error is
        persisted, and a DLQ notification is dispatched via Hermes SMTP.

        Args:
            resume_id: Firestore document ID of the resume to process.
        """
        logger.info("Starting AI processing pipeline", extra={"resume_id": resume_id})

        try:
            # Step 1 — mark PROCESSING so concurrent workers skip this doc.
            await self._resume_store.update_status(resume_id, "PROCESSING")

            # Step 2 — fetch raw text.
            resume = await self._resume_store.get_by_id(resume_id)
            if not resume.raw_text:
                raise ValueError(f"Resume '{resume_id}' has no raw_text to process.")

            # Step 3 — structured extraction (AI call, rate-limited inside service).
            structured = await self._vertex_ai.extract_fields(resume.raw_text)
            logger.info(
                "Structured fields extracted", extra={"resume_id": resume_id}
            )

            # Step 4 — persist structured JSON to the resumes collection.
            await self._resume_store.save_structured_data(
                resume_id, structured.model_dump(exclude_none=True)
            )
            logger.info(
                "Structured data saved to resumes collection",
                extra={"resume_id": resume_id},
            )

            # Step 5 — embedding generation (AI call, rate-limited inside service).
            embedding = await self._vertex_ai.generate_embedding(resume.raw_text)
            logger.info(
                "Embedding vector generated", extra={"resume_id": resume_id}
            )

            # Step 6 — persist embedding to the SEPARATE resume_embeddings collection.
            await self._embedding_store.save_embedding(resume_id, embedding)
            logger.info(
                "Embedding saved to resume_embeddings collection",
                extra={"resume_id": resume_id},
            )

            # Step 7 — mark PROCESSED.
            await self._resume_store.update_status(resume_id, "PROCESSED")

            # Step 8 — publish downstream event via Hermes.
            await self._pubsub.publish(self._output_topic, {"resumeId": resume_id})
            logger.info(
                "Published to resume_indexing topic",
                extra={"resume_id": resume_id, "topic": self._output_topic},
            )

        except Exception as exc:
            error_msg = str(exc)
            logger.error(
                "AI processing pipeline failed",
                extra={"resume_id": resume_id, "error": error_msg},
            )
            await self._handle_processing_error(resume_id, error_msg)
            raise

    async def _handle_processing_error(self, resume_id: str, error_message: str) -> None:
        """Persist the failure status and send a DLQ notification.

        Args:
            resume_id: Firestore document ID.
            error_message: Short description of the error.
        """
        try:
            await self._resume_store.save_error(resume_id, error_message)
        except Exception as save_exc:
            logger.error(
                "Failed to persist error status",
                extra={"resume_id": resume_id, "error": str(save_exc)},
            )

        self._send_dlq_alert(resume_id, error_message)

    def _send_dlq_alert(self, resume_id: str, error_message: str) -> None:
        """Send a DLQ failure notification via Hermes SMTP.

        Args:
            resume_id: Resume identifier for context.
            error_message: Short description of the error.
        """
        try:
            messaging = get_messaging_service()
            messaging.send(
                Message(
                    to=self._dlq_alert_recipient,
                    subject=f"[DLQ] AI Worker failed — resume {resume_id}",
                    body=(
                        f"The AI Worker failed to process resume '{resume_id}'.\n\n"
                        f"Error: {error_message}\n\n"
                        "Please investigate and re-publish if appropriate."
                    ),
                )
            )
            logger.info("DLQ alert sent", extra={"resume_id": resume_id})
        except RuntimeError:
            logger.warning(
                "Hermes not initialised; DLQ alert not sent",
                extra={"resume_id": resume_id},
            )
        except Exception as exc:
            logger.error(
                "Failed to send DLQ alert", extra={"resume_id": resume_id, "error": str(exc)}
            )
