"""Core AI Worker processing pipeline.

This module orchestrates the full resume processing flow:

1. Retrieve raw text from Firestore.
2. Extract structured fields using Vertex AI Gemini.
3. Generate an embedding vector using Vertex AI text embeddings.
4. Persist the structured data and embedding back to Firestore.
5. Publish a ``resume-indexed`` event to Pub/Sub for downstream consumers.

Any unrecoverable error is written back to Firestore (status ``FAILED``) and
a DLQ notification is sent via Hermes.
"""

from __future__ import annotations

import logging

from hermes import get_messaging_service
from hermes.interfaces import Message

from app.models.resume import ResumeStatus
from app.repositories.resume_repository import ResumeNotFoundError, ResumeRepository
from app.services.pubsub_service import PubSubService
from app.services.vertex_ai_service import VertexAIService

logger = logging.getLogger(__name__)


class AIWorkerService:
    """Orchestrates the end-to-end resume processing pipeline.

    Args:
        resume_repo: Firestore repository for resume documents.
        vertex_ai: Vertex AI service for extraction and embeddings.
        pubsub: Pub/Sub publisher for downstream events.
        output_topic: Pub/Sub topic name to publish processed events to.
        dlq_alert_recipient: Email address for DLQ failure alert messages.

    Example:
        >>> service = AIWorkerService(
        ...     resume_repo=repo,
        ...     vertex_ai=vertex_service,
        ...     pubsub=pubsub_service,
        ...     output_topic="resume-indexed",
        ...     dlq_alert_recipient="ops@example.com",
        ... )
        >>> await service.process("resume-abc123")
    """

    def __init__(
        self,
        resume_repo: ResumeRepository,
        vertex_ai: VertexAIService,
        pubsub: PubSubService,
        output_topic: str,
        dlq_alert_recipient: str,
    ) -> None:
        self._resume_repo = resume_repo
        self._vertex_ai = vertex_ai
        self._pubsub = pubsub
        self._output_topic = output_topic
        self._dlq_alert_recipient = dlq_alert_recipient

    async def process(self, resume_id: str) -> None:
        """Process a single resume through the full AI pipeline.

        Steps:
        1. Mark the resume as ``PROCESSING`` in Firestore.
        2. Fetch the raw text from Firestore.
        3. Extract structured fields using Vertex AI.
        4. Generate an embedding vector using Vertex AI.
        5. Save structured data and embedding to Firestore (status ``PROCESSED``).
        6. Publish a ``{ resumeId }`` event to the output Pub/Sub topic.

        On any failure the document status is set to ``FAILED``, the error is
        persisted, and a DLQ notification is dispatched via Hermes.

        Args:
            resume_id: The Firestore document ID of the resume to process.
        """
        logger.info("Starting AI processing pipeline", extra={"resume_id": resume_id})

        try:
            # Step 1 — mark as processing so that concurrent workers skip it.
            await self._resume_repo.update_status(resume_id, ResumeStatus.PROCESSING)

            # Step 2 — fetch raw text.
            resume = await self._resume_repo.get_by_id(resume_id)
            if not resume.raw_text:
                raise ValueError(f"Resume {resume_id!r} has no raw_text to process.")

            # Step 3 — structured extraction.
            structured_data = await self._vertex_ai.extract_fields(resume.raw_text)
            logger.info(
                "Structured fields extracted successfully",
                extra={"resume_id": resume_id},
            )

            # Step 4 — embedding generation.
            embedding = await self._vertex_ai.generate_embedding(resume.raw_text)
            logger.info(
                "Embedding vector generated successfully",
                extra={"resume_id": resume_id},
            )

            # Step 5 — persist to Firestore.
            await self._resume_repo.save_processed_data(resume_id, structured_data, embedding)
            logger.info(
                "Processed data saved to Firestore",
                extra={"resume_id": resume_id},
            )

            # Step 6 — publish downstream event.
            await self._pubsub.publish(self._output_topic, {"resumeId": resume_id})
            logger.info(
                "Published resume-indexed event",
                extra={"resume_id": resume_id, "topic": self._output_topic},
            )

        except ResumeNotFoundError:
            logger.error(
                "Resume not found — skipping processing",
                extra={"resume_id": resume_id},
            )
            self._send_dlq_alert(resume_id, "Resume document not found in Firestore.")
            raise
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
            resume_id: The Firestore document ID of the failed resume.
            error_message: A short description of the error.
        """
        try:
            await self._resume_repo.save_error(resume_id, error_message)
        except Exception as save_exc:
            # Best-effort — log but do not re-raise so the DLQ alert still fires.
            logger.error(
                "Failed to persist error status to Firestore",
                extra={"resume_id": resume_id, "error": str(save_exc)},
            )

        self._send_dlq_alert(resume_id, error_message)

    def _send_dlq_alert(self, resume_id: str, error_message: str) -> None:
        """Send a DLQ failure notification via Hermes.

        Args:
            resume_id: The resume identifier for context.
            error_message: A short description of the error.
        """
        try:
            messaging = get_messaging_service()
            messaging.send(
                Message(
                    to=self._dlq_alert_recipient,
                    subject=f"[DLQ] AI Worker processing failed — resume {resume_id}",
                    body=(
                        f"The AI Worker failed to process resume {resume_id!r}.\n\n"
                        f"Error: {error_message}\n\n"
                        "Please investigate and re-publish the message if appropriate."
                    ),
                )
            )
            logger.info(
                "DLQ alert sent",
                extra={"resume_id": resume_id, "recipient": self._dlq_alert_recipient},
            )
        except RuntimeError:
            # Hermes not initialised — log and continue.
            logger.warning(
                "Hermes not initialised; DLQ alert not sent",
                extra={"resume_id": resume_id},
            )
        except Exception as exc:
            logger.error(
                "Failed to send DLQ alert via Hermes",
                extra={"resume_id": resume_id, "error": str(exc)},
            )
