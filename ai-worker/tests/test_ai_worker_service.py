"""Unit tests for the AIWorkerService processing pipeline."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.ai_worker_service import AIWorkerService
from synapse.errors import NotFoundError
from synapse.interfaces.resume_document_store import ResumeDocument


class TestAIWorkerServiceProcess:
    """Tests for AIWorkerService.process()."""

    @pytest.mark.asyncio
    async def test_happy_path_runs_all_pipeline_steps(
        self,
        worker_service: AIWorkerService,
        mock_resume_store: MagicMock,
        mock_embedding_store: MagicMock,
        mock_vertex_ai: MagicMock,
        mock_pubsub: MagicMock,
        sample_resume: ResumeDocument,
    ) -> None:
        """process() runs all 8 pipeline steps in the correct order."""
        mock_resume_store.get_by_id.return_value = sample_resume

        await worker_service.process("resume-test-001")

        # Step 1 — mark PROCESSING
        mock_resume_store.update_status.assert_any_call("resume-test-001", "PROCESSING")
        # Step 2 — fetch raw text
        mock_resume_store.get_by_id.assert_called_once_with("resume-test-001")
        # Step 3 — extraction
        mock_vertex_ai.extract_fields.assert_called_once_with(sample_resume.raw_text)
        # Step 4 — save structured data to resumes collection
        mock_resume_store.save_structured_data.assert_called_once()
        # Step 5 — generate embedding
        mock_vertex_ai.generate_embedding.assert_called_once_with(sample_resume.raw_text)
        # Step 6 — save embedding to resume_embeddings collection
        mock_embedding_store.save_embedding.assert_called_once_with(
            "resume-test-001", [0.1, 0.2, 0.3]
        )
        # Step 7 — mark PROCESSED
        mock_resume_store.update_status.assert_any_call("resume-test-001", "PROCESSED")
        # Step 8 — publish to resume_indexing topic
        mock_pubsub.publish.assert_called_once_with(
            "resume_indexing", {"resumeId": "resume-test-001"}
        )

    @pytest.mark.asyncio
    async def test_raises_and_saves_error_when_raw_text_missing(
        self,
        worker_service: AIWorkerService,
        mock_resume_store: MagicMock,
    ) -> None:
        """process() raises ValueError when the resume has no raw_text."""
        mock_resume_store.get_by_id.return_value = ResumeDocument(
            resume_id="no-text",
            status="INGESTED",
            raw_text=None,
        )

        with pytest.raises(ValueError, match="raw_text"):
            await worker_service.process("no-text")

        mock_resume_store.save_error.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_and_saves_error_on_extraction_failure(
        self,
        worker_service: AIWorkerService,
        mock_resume_store: MagicMock,
        mock_vertex_ai: MagicMock,
        sample_resume: ResumeDocument,
    ) -> None:
        """process() persists FAILED status when Vertex AI extraction fails."""
        mock_resume_store.get_by_id.return_value = sample_resume
        mock_vertex_ai.extract_fields.side_effect = RuntimeError("Vertex AI down")

        with pytest.raises(RuntimeError):
            await worker_service.process("resume-test-001")

        mock_resume_store.save_error.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_and_saves_error_on_embedding_failure(
        self,
        worker_service: AIWorkerService,
        mock_resume_store: MagicMock,
        mock_vertex_ai: MagicMock,
        sample_resume: ResumeDocument,
    ) -> None:
        """process() persists FAILED status when embedding generation fails."""
        mock_resume_store.get_by_id.return_value = sample_resume
        mock_vertex_ai.generate_embedding.side_effect = RuntimeError("Embedding error")

        with pytest.raises(RuntimeError):
            await worker_service.process("resume-test-001")

        mock_resume_store.save_error.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_and_saves_error_on_embedding_store_failure(
        self,
        worker_service: AIWorkerService,
        mock_resume_store: MagicMock,
        mock_embedding_store: MagicMock,
        sample_resume: ResumeDocument,
    ) -> None:
        """process() persists FAILED status when embedding store write fails."""
        mock_resume_store.get_by_id.return_value = sample_resume
        mock_embedding_store.save_embedding.side_effect = RuntimeError("Firestore write error")

        with pytest.raises(RuntimeError):
            await worker_service.process("resume-test-001")

        mock_resume_store.save_error.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_and_saves_error_on_pubsub_failure(
        self,
        worker_service: AIWorkerService,
        mock_resume_store: MagicMock,
        mock_pubsub: MagicMock,
        sample_resume: ResumeDocument,
    ) -> None:
        """process() persists FAILED status when Pub/Sub publish fails."""
        mock_resume_store.get_by_id.return_value = sample_resume
        mock_pubsub.publish.side_effect = RuntimeError("Pub/Sub unavailable")

        with pytest.raises(RuntimeError):
            await worker_service.process("resume-test-001")

        mock_resume_store.save_error.assert_called_once()

    @pytest.mark.asyncio
    async def test_dlq_alert_still_sent_when_save_error_fails(
        self,
        worker_service: AIWorkerService,
        mock_resume_store: MagicMock,
        mock_vertex_ai: MagicMock,
        sample_resume: ResumeDocument,
    ) -> None:
        """process() still sends a DLQ alert even if save_error itself raises."""
        mock_resume_store.get_by_id.return_value = sample_resume
        mock_vertex_ai.extract_fields.side_effect = RuntimeError("Vertex AI down")
        mock_resume_store.save_error.side_effect = RuntimeError("Firestore also down")

        with patch.object(worker_service, "_send_dlq_alert") as mock_alert:
            with pytest.raises(RuntimeError):
                await worker_service.process("resume-test-001")

        mock_alert.assert_called_once()


class TestAIWorkerServiceDLQAlert:
    """Tests for AIWorkerService._send_dlq_alert()."""

    def test_sends_hermes_message_when_initialised(
        self,
        worker_service: AIWorkerService,
    ) -> None:
        mock_messaging = MagicMock()
        with patch(
            "app.services.ai_worker_service.get_messaging_service",
            return_value=mock_messaging,
        ):
            worker_service._send_dlq_alert("resume-001", "Something failed")

        mock_messaging.send.assert_called_once()
        sent = mock_messaging.send.call_args[0][0]
        assert "resume-001" in sent.subject

    def test_does_not_raise_when_hermes_not_initialised(
        self,
        worker_service: AIWorkerService,
    ) -> None:
        with patch(
            "app.services.ai_worker_service.get_messaging_service",
            side_effect=RuntimeError("not initialised"),
        ):
            worker_service._send_dlq_alert("resume-001", "error")

    def test_does_not_raise_when_hermes_send_fails(
        self,
        worker_service: AIWorkerService,
    ) -> None:
        mock_messaging = MagicMock()
        mock_messaging.send.side_effect = Exception("SMTP unavailable")
        with patch(
            "app.services.ai_worker_service.get_messaging_service",
            return_value=mock_messaging,
        ):
            worker_service._send_dlq_alert("resume-001", "error")
