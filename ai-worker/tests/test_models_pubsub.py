"""Unit tests for the Pub/Sub message models."""

from __future__ import annotations

import base64
import json

import pytest

from app.models.pubsub import PubSubMessage, PubSubPushEnvelope


def _encode(payload: dict) -> str:  # type: ignore[type-arg]
    """Helper: base64-encode a JSON payload."""
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")


class TestPubSubMessageDecodeData:
    """Tests for PubSubMessage.decode_data()."""

    def test_decodes_valid_json_payload(self) -> None:
        """decode_data returns the original dict when data is valid JSON."""
        payload = {"resumeId": "abc123"}
        msg = PubSubMessage(data=_encode(payload), message_id="msg-1")
        assert msg.decode_data() == payload

    def test_raises_value_error_on_non_json(self) -> None:
        """decode_data raises ValueError when the decoded string is not JSON."""
        raw = base64.b64encode(b"not-json").decode("utf-8")
        msg = PubSubMessage(data=raw, message_id="msg-2")
        with pytest.raises(ValueError, match="Failed to decode"):
            msg.decode_data()

    def test_raises_value_error_on_invalid_base64(self) -> None:
        """decode_data raises ValueError for malformed base64."""
        msg = PubSubMessage(data="!!!not-base64!!!", message_id="msg-3")
        with pytest.raises(ValueError, match="Failed to decode"):
            msg.decode_data()


class TestPubSubPushEnvelope:
    """Tests for PubSubPushEnvelope validation."""

    def test_valid_envelope_parses_correctly(self) -> None:
        """A well-formed envelope is parsed without errors."""
        payload = {"resumeId": "xyz"}
        envelope = PubSubPushEnvelope(
            message=PubSubMessage(data=_encode(payload), message_id="msg-4"),
            subscription="projects/demo/subscriptions/resume-ingested-sub",
        )
        assert envelope.subscription.startswith("projects/")

    def test_empty_subscription_raises_validation_error(self) -> None:
        """An empty subscription string fails Pydantic validation."""
        with pytest.raises(Exception):
            PubSubPushEnvelope(
                message=PubSubMessage(data=_encode({"resumeId": "x"}), message_id="m"),
                subscription="   ",
            )
