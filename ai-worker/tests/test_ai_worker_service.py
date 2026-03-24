"""Unit tests for the AIWorkerService processing pipeline."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.models.resume import ResumeDocument, ResumeStatus
from app.repositories.resume_repository import ResumeNotFoundError
from app.services.ai_worker_service import AIWorkerService


class TestAIWorkerServiceProcess:
    """Tests for AIWorkerService.process()."""

    @pytest.mark.asyncio
    async def test_happy_path_completes_all_pipeline_steps(
        self,
        worker_service: AIWorkerService,
        mock_resume_repo: MagicMock,
        mock_vertex_ai: MagicMock,
        mock_pubsub: MagicMock,
        sample_resume: ResumeDocument,
    ) -> None:
        """process() runs all pipeline steps in the correct order."""
        mock_resume_repo.get_by_id.return_value = sample_resume

        await worker_service.process("resume-test-001")

        mock_resume_repo.update_status.assert_called_once_with(
            "resume-test-001", ResumeStatus.PROCESSING
        )
        mock_resume_repo.get_by_id.assert_called_once_with("resume-test-001")
        mock_vertex_ai.extract_fields.assert_called_once_with(sample_resume.raw_text)
        mock_vertex_ai.generate_embedding.assert_called_once_with(sample_resume.raw_text)
        mock_resume_repo.save_processed_data.assert_called_once()
        mock_pubsub.publish.assert_called_once_with(
            "resume-indexed", {"resumeId": "resume-test-001"}
        )

    @pytest.mark.asyncio
    async def test_raises_and_saves_error_when_resume_not_found(
        self,
        worker_service: AIWorkerService,
        mock_resume_repo: MagicMock,
    ) -> None:
        """process() raises ResumeNotFoundError and triggers DLQ alert."""
        mock_resume_repo.get_by_id.side_effect = ResumeNotFoundError("not found")

        with patch.object(worker_service, "_send_dlq_alert") as mock_alert:
            with pytest.raises(ResumeNotFoundError):
                await worker_service.process("missing-resume")

        mock_alert.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_and_saves_error_when_raw_text_is_missing(
        self,
        worker_service: AIWorkerService,
        mock_resume_repo: MagicMock,
    ) -> None:
        """process() raises ValueError when the resume has no raw_text."""
        mock_resume_repo.get_by_id.return_value = ResumeDocument(
            resume_id="resume-no-text",
            status=ResumeStatus.INGESTED,
            raw_text=None,
        )

        with pytest.raises(Exception):
            await worker_service.process("resume-no-text")

        mock_resume_repo.save_error.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_and_saves_error_when_vertex_extraction_fails(
        self,
        worker_service: AIWorkerService,
        mock_resume_repo: MagicMock,
        mock_vertex_ai: MagicMock,
        sample_resume: ResumeDocument,
    ) -> None:
        """process() raises and persists FAILED status on extraction error."""
        mock_resume_repo.get_by_id.return_value = sample_resume
        mock_vertex_ai.extract_fields.side_effect = RuntimeError("Vertex AI down")

        with pytest.raises(RuntimeError):
            await worker_service.process("resume-test-001")

        mock_resume_repo.save_error.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_and_saves_error_when_embedding_fails(
        self,
        worker_service: AIWorkerService,
        mock_resume_repo: MagicMock,
        mock_vertex_ai: MagicMock,
        sample_resume: ResumeDocument,
    ) -> None:
        """process() raises and persists FAILED status on embedding error."""
        mock_resume_repo.get_by_id.return_value = sample_resume
        mock_vertex_ai.generate_embedding.side_effect = RuntimeError("Embedding model error")

        with pytest.raises(RuntimeError):
            await worker_service.process("resume-test-001")

        mock_resume_repo.save_error.assert_called_once()

    @pytest.mark.asyncio
    async def test_continues_to_dlq_alert_when_save_error_fails(
        self,
        worker_service: AIWorkerService,
        mock_resume_repo: MagicMock,
        mock_vertex_ai: MagicMock,
        sample_resume: ResumeDocument,
    ) -> None:
        """process() still sends a DLQ alert even if save_error itself raises."""
        mock_resume_repo.get_by_id.return_value = sample_resume
        mock_vertex_ai.extract_fields.side_effect = RuntimeError("Vertex AI down")
        mock_resume_repo.save_error.side_effect = RuntimeError("Firestore also down")

        with patch.object(worker_service, "_send_dlq_alert") as mock_alert:
            with pytest.raises(RuntimeError):
                await worker_service.process("resume-test-001")

        mock_alert.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_and_saves_error_when_pubsub_publish_fails(
        self,
        worker_service: AIWorkerService,
        mock_resume_repo: MagicMock,
        mock_pubsub: MagicMock,
        sample_resume: ResumeDocument,
    ) -> None:
        """process() raises and persists FAILED status when Pub/Sub publish fails."""
        mock_resume_repo.get_by_id.return_value = sample_resume
        mock_pubsub.publish.side_effect = RuntimeError("Pub/Sub unavailable")

        with pytest.raises(RuntimeError):
            await worker_service.process("resume-test-001")

        mock_resume_repo.save_error.assert_called_once()


class TestAIWorkerServiceDLQAlert:
    """Tests for AIWorkerService._send_dlq_alert()."""

    def test_sends_hermes_message_when_initialised(
        self,
        worker_service: AIWorkerService,
    ) -> None:
        """_send_dlq_alert sends a Hermes message when Hermes is initialised."""
        mock_messaging = MagicMock()
        with patch(
            "app.services.ai_worker_service.get_messaging_service",
            return_value=mock_messaging,
        ):
            worker_service._send_dlq_alert("resume-001", "Something failed")

        mock_messaging.send.assert_called_once()
        sent_message = mock_messaging.send.call_args[0][0]
        assert "resume-001" in sent_message.subject

    def test_does_not_raise_when_hermes_not_initialised(
        self,
        worker_service: AIWorkerService,
    ) -> None:
        """_send_dlq_alert logs a warning and does not raise when Hermes is absent."""
        with patch(
            "app.services.ai_worker_service.get_messaging_service",
            side_effect=RuntimeError("not initialised"),
        ):
            # Should complete without raising.
            worker_service._send_dlq_alert("resume-001", "error")

    def test_does_not_raise_when_hermes_send_fails(
        self,
        worker_service: AIWorkerService,
    ) -> None:
        """_send_dlq_alert logs an error but does not raise when send() fails."""
        mock_messaging = MagicMock()
        mock_messaging.send.side_effect = Exception("SMTP unavailable")
        with patch(
            "app.services.ai_worker_service.get_messaging_service",
            return_value=mock_messaging,
        ):
            # Should complete without raising even when send() raises.
            worker_service._send_dlq_alert("resume-001", "error")
