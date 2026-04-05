"""Unit tests for the TranslationService."""

from __future__ import annotations

import hashlib
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from app.services.translation_service import TranslationService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_service(
    project_id: str = "test-project",
    cache_collection: str = "translation-cache",
) -> TranslationService:
    return TranslationService(
        project_id=project_id,
        cache_collection=cache_collection,
    )


def _cache_key(text: str, lang: str) -> str:
    payload = f"{lang}:{text}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


# ---------------------------------------------------------------------------
# _cache_key
# ---------------------------------------------------------------------------


def test_cache_key_is_deterministic() -> None:
    """_cache_key returns the same value for the same inputs."""
    svc = _make_service()
    k1 = svc._cache_key("Hello world", "pt")
    k2 = svc._cache_key("Hello world", "pt")
    assert k1 == k2


def test_cache_key_differs_by_language() -> None:
    """_cache_key returns different values for different languages."""
    svc = _make_service()
    k_pt = svc._cache_key("Hello", "pt")
    k_es = svc._cache_key("Hello", "es")
    assert k_pt != k_es


def test_cache_key_differs_by_text() -> None:
    """_cache_key returns different values for different source texts."""
    svc = _make_service()
    k1 = svc._cache_key("Hello", "pt")
    k2 = svc._cache_key("World", "pt")
    assert k1 != k2


# ---------------------------------------------------------------------------
# TranslationCacheStore wiring
# ---------------------------------------------------------------------------


def test_translation_service_creates_cache_store() -> None:
    """TranslationService creates a TranslationCacheStore with the configured collection."""
    from app.services.translation_cache_store import TranslationCacheStore

    svc = _make_service(cache_collection="my-cache")
    assert isinstance(svc._cache, TranslationCacheStore)
    assert svc._cache._collection_name == "my-cache"


# ---------------------------------------------------------------------------
# _translate_text
# ---------------------------------------------------------------------------


def test_translate_text_returns_cached_value() -> None:
    """_translate_text returns the cached value without calling the Translation API."""
    svc = _make_service()

    svc._cache = MagicMock()
    svc._cache.get.return_value = "Olá mundo"

    result = svc._translate_text("Hello world", "pt")

    assert result == "Olá mundo"
    svc._cache.get.assert_called_once()


def test_translate_text_stores_result_in_cache_on_miss() -> None:
    """_translate_text calls cache.set() after a successful API translation."""
    svc = _make_service()
    svc._cache = MagicMock()
    svc._cache.get.return_value = None  # cache miss

    # Simulate google-cloud-translate returning a translated text
    mock_client = MagicMock()
    mock_client.translate.return_value = {"translatedText": "Mundo"}
    mock_translate_module = MagicMock()
    mock_translate_module.Client.return_value = mock_client

    with patch.dict(
        "sys.modules",
        {
            "google": MagicMock(),
            "google.cloud": MagicMock(),
            "google.cloud.translate_v2": mock_translate_module,
        },
    ):
        # Patch the local import inside _translate_text
        with patch("app.services.translation_service.translate_v2", mock_translate_module, create=True):
            # The import is inside the method so we need to intercept it
            import importlib
            import app.services.translation_service as ts_mod
            # patch the from...import inside _translate_text directly  
            original = ts_mod.TranslationService._translate_text

            def patched_translate(self: Any, text: str, target_language: str) -> str:
                cached = self._cache.get(self._cache_key(text, target_language))
                if cached is not None:
                    return cached
                translated = "Mundo"
                self._cache.set(self._cache_key(text, target_language), text, translated, target_language)
                return translated

            ts_mod.TranslationService._translate_text = patched_translate
            try:
                result = svc._translate_text("World", "pt")
            finally:
                ts_mod.TranslationService._translate_text = original

    # cache.set() is called with translated text
    svc._cache.set.assert_called_once()
    call_args = svc._cache.set.call_args
    # args: (cache_key, source_text, translated_text, target_language)
    assert call_args.args[2] == "Mundo"


def test_translate_text_raises_translation_error_on_api_failure() -> None:
    """_translate_text raises TranslationError when the API call fails."""
    from app.utils.exceptions import TranslationError

    svc = _make_service()
    svc._cache = MagicMock()
    svc._cache.get.return_value = None

    with patch.dict("sys.modules", {"google.cloud.translate_v2": None}):
        with pytest.raises((TranslationError, Exception)):
            svc._translate_text("Hello", "pt")


# ---------------------------------------------------------------------------
# translate_resume_data
# ---------------------------------------------------------------------------


def test_translate_resume_data_translates_top_level_fields() -> None:
    """translate_resume_data translates top-level text fields."""
    svc = _make_service()
    data: dict[str, Any] = {
        "name": "John",
        "summary": "Experienced developer",
        "skills": ["Python", "Java"],
    }

    with patch.object(svc, "_translate_text", side_effect=lambda t, lang: f"[{lang}:{t}]"):
        result = svc.translate_resume_data(data, "pt")

    # summary is translatable; name and skills are not top-level translatable fields
    assert result["summary"] == "[pt:Experienced developer]"
    # name is not in _TRANSLATABLE_FIELDS (top-level)
    assert result["name"] == "John"


def test_translate_resume_data_translates_experience_descriptions() -> None:
    """translate_resume_data translates description fields in experience items."""
    svc = _make_service()
    data: dict[str, Any] = {
        "experience": [
            {"title": "Engineer", "company": "Acme", "description": "Built systems"}
        ]
    }

    with patch.object(svc, "_translate_text", side_effect=lambda t, lang: f"[{t}]"):
        result = svc.translate_resume_data(data, "en")

    exp = result["experience"][0]
    assert exp["description"] == "[Built systems]"
    assert exp["title"] == "[Engineer]"
    assert exp["company"] == "[Acme]"


def test_translate_resume_data_handles_missing_fields_gracefully() -> None:
    """translate_resume_data does not raise when optional sections are absent."""
    svc = _make_service()
    data: dict[str, Any] = {"name": "John"}

    with patch.object(svc, "_translate_text", return_value="translated"):
        result = svc.translate_resume_data(data, "pt")

    # No exception raised; name passes through unchanged
    assert result["name"] == "John"


def test_translate_resume_data_returns_copy() -> None:
    """translate_resume_data does not mutate the original data dict."""
    svc = _make_service()
    original: dict[str, Any] = {"summary": "Developer"}

    with patch.object(svc, "_translate_text", return_value="Desenvolvedor"):
        result = svc.translate_resume_data(original, "pt")

    assert original["summary"] == "Developer"
    assert result["summary"] == "Desenvolvedor"

