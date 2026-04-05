"""Google Cloud Translation service with Firestore result caching.

Translates structured resume data fields using the Google Cloud Translation
API (v2 / Basic edition).  Translation results are cached in the
``translation-cache`` Firestore collection to avoid redundant API calls.

Cache document IDs are derived from the SHA-256 hash of the source text combined
with the target language, ensuring stable lookups.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any

from app.utils.exceptions import TranslationError

logger = logging.getLogger(__name__)

# Fields to translate in a resume data dictionary.
_TRANSLATABLE_FIELDS = [
    "summary",
    "objective",
    "description",
]

# Nested list-of-dict fields whose text sub-fields should be translated.
_NESTED_TRANSLATABLE = {
    "experience": ["title", "company", "description"],
    "education": ["institution", "degree", "description"],
    "skills": [],  # skills are translated as a flat list of strings
    "certifications": ["name", "issuer", "description"],
    "languages": [],  # language names kept as-is
}


class TranslationService:
    """Translates structured resume data using the Google Cloud Translation API.

    Caches results in Firestore to avoid re-translating the same text.

    Args:
        project_id: Google Cloud project ID used to call the Translation API.
        cache_collection: Firestore collection name for caching translation
            results.  Defaults to ``"translation-cache"``.
        api_location: Google Cloud region for the Translation API.
            Defaults to ``"global"``.

    Example::

        svc = TranslationService(project_id="my-project")
        translated = svc.translate_resume_data(data, target_language="pt")
    """

    def __init__(
        self,
        project_id: str,
        cache_collection: str = "translation-cache",
        api_location: str = "global",
    ) -> None:
        """Initialise the TranslationService.

        Args:
            project_id: Google Cloud project ID.
            cache_collection: Firestore collection name for caching results.
            api_location: Google Cloud Translation API location.
        """
        self._project_id = project_id
        self._cache_collection = cache_collection
        self._api_location = api_location

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def translate_resume_data(
        self,
        data: dict[str, Any],
        target_language: str,
    ) -> dict[str, Any]:
        """Translate translatable fields in *data* to *target_language*.

        Uses Firestore cache to avoid re-translating existing results.

        Args:
            data: Structured resume data dictionary.
            target_language: BCP-47 target language code (e.g. ``"en"``).

        Returns:
            A new dictionary with translatable fields replaced by their
            translations.  Non-translatable fields are copied as-is.

        Raises:
            TranslationError: If a Translation API call fails.
        """
        result = dict(data)

        # Translate top-level text fields.
        for field in _TRANSLATABLE_FIELDS:
            if isinstance(result.get(field), str) and result[field]:
                result[field] = self._translate_text(
                    result[field], target_language  # type: ignore[arg-type]
                )

        # Translate nested list-of-dict fields.
        for section, text_keys in _NESTED_TRANSLATABLE.items():
            items = result.get(section)
            if not isinstance(items, list):
                continue

            translated_items: list[Any] = []
            for item in items:
                if isinstance(item, dict) and text_keys:
                    new_item = dict(item)
                    for key in text_keys:
                        if isinstance(new_item.get(key), str) and new_item[key]:
                            new_item[key] = self._translate_text(
                                new_item[key], target_language
                            )
                    translated_items.append(new_item)
                elif isinstance(item, str) and item:
                    translated_items.append(
                        self._translate_text(item, target_language)
                    )
                else:
                    translated_items.append(item)

            result[section] = translated_items

        return result

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _cache_key(self, text: str, target_language: str) -> str:
        """Return a deterministic Firestore document ID for a translation entry.

        Args:
            text: The source text to translate.
            target_language: BCP-47 target language code.

        Returns:
            A hex-digest string suitable for use as a Firestore document ID.
        """
        payload = f"{target_language}:{text}".encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def _get_cached(self, cache_key: str) -> str | None:
        """Look up a cached translation in Firestore.

        Args:
            cache_key: Firestore document ID for the cache entry.

        Returns:
            The cached translated text, or ``None`` when not found.
        """
        try:
            from firebase_admin import firestore  # type: ignore[import-untyped]

            db = firestore.client()
            doc = db.collection(self._cache_collection).document(cache_key).get()
            if doc.exists:
                data = doc.to_dict() or {}
                cached: str | None = data.get("translatedText")
                if cached:
                    logger.debug("Translation cache hit", extra={"cache_key": cache_key})
                    return cached
        except Exception as exc:
            logger.warning(
                "Failed to read from translation cache: %s", exc, extra={"cache_key": cache_key}
            )
        return None

    def _set_cached(self, cache_key: str, text: str, translated: str, target_language: str) -> None:
        """Persist a translation result to the Firestore cache.

        Args:
            cache_key: Firestore document ID for the cache entry.
            text: The original source text.
            translated: The translated text to store.
            target_language: BCP-47 target language code.
        """
        try:
            from firebase_admin import firestore  # type: ignore[import-untyped]

            db = firestore.client()
            db.collection(self._cache_collection).document(cache_key).set(
                {
                    "sourceText": text,
                    "translatedText": translated,
                    "targetLanguage": target_language,
                }
            )
            logger.debug("Translation cached", extra={"cache_key": cache_key})
        except Exception as exc:
            logger.warning(
                "Failed to write to translation cache: %s", exc, extra={"cache_key": cache_key}
            )

    def _translate_text(self, text: str, target_language: str) -> str:
        """Translate a single text string, using the Firestore cache.

        Args:
            text: The source text to translate.
            target_language: BCP-47 target language code.

        Returns:
            The translated text string.

        Raises:
            TranslationError: If the Translation API call fails.
        """
        cache_key = self._cache_key(text, target_language)

        # Try cache first.
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        # Call the Translation API.
        try:
            from google.cloud import translate_v2 as translate  # type: ignore[import-untyped]

            client = translate.Client()
            result = client.translate(text, target_language=target_language)
            translated: str = result["translatedText"]
        except Exception as exc:
            logger.error("Translation API call failed: %s", exc)
            raise TranslationError(f"Translation API call failed: {exc}") from exc

        # Persist to cache.
        self._set_cached(cache_key, text, translated, target_language)

        return translated
