"""Firestore-backed translation cache store with usage-decay and size capping.

Manages the ``translation-cache`` Firestore collection with an LFU-style eviction
policy:

* Every time a phrase is *used* (cache hit or new translation), its ``usage``
  counter is incremented by 1.
* Every translation event *decrements* all other cached phrases by 1 in a
  Firestore batch write, simulating decay over time so that stale entries
  eventually reach low / negative usage counts.
* When the total number of cached entries exceeds :data:`MAX_CACHE_SIZE`
  (10 000 by default), the phrases with the lowest usage are deleted until the
  count is back under the limit.

Firestore batch writes support up to 500 operations each.  Large caches are
handled by chunking the decrement into multiple consecutive batches.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)

#: Maximum number of translation entries retained in the Firestore cache.
MAX_CACHE_SIZE = 10_000

#: Number of operations per Firestore batch write (Firestore limit is 500).
_BATCH_SIZE = 500


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return (
        datetime.now(tz=UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


class TranslationCacheStore:
    """Firestore-backed store for translation cache entries.

    Each document in the collection represents one translated phrase and
    stores the following fields:

    * ``sourceText`` — the original text that was translated.
    * ``translatedText`` — the translated result.
    * ``targetLanguage`` — the BCP-47 target language code.
    * ``usage`` — integer counter; incremented on use and decremented for all
      other entries on every translation event.
    * ``createdAt`` — ISO-8601 UTC timestamp of first insertion.
    * ``updatedAt`` — ISO-8601 UTC timestamp of last update.

    Args:
        collection_name: Firestore collection name.  Defaults to
            ``"translation-cache"``.
        max_size: Maximum number of entries before pruning kicks in.
            Defaults to :data:`MAX_CACHE_SIZE`.

    Example::

        store = TranslationCacheStore()
        cached = store.get("abc123sha")
        if cached is None:
            store.set("abc123sha", "Hello", "Olá", "pt")
    """

    def __init__(
        self,
        collection_name: str = "translation-cache",
        max_size: int = MAX_CACHE_SIZE,
    ) -> None:
        """Initialise the store.

        Args:
            collection_name: Firestore collection name.
            max_size: Maximum number of entries retained before pruning.
        """
        self._collection_name = collection_name
        self._max_size = max_size

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def get(self, cache_key: str) -> str | None:
        """Retrieve a cached translation by its key.

        On a cache hit the matched entry's ``usage`` is incremented by 1, and
        all other entries are decremented by 1 via a Firestore batch write
        (decay step).

        Args:
            cache_key: SHA-256 document ID for the cache entry.

        Returns:
            The cached translated text string, or ``None`` when not found.
        """
        try:
            db = self._db()
            doc = db.collection(self._collection_name).document(cache_key).get()
            if not doc.exists:
                return None

            data: dict[str, Any] = doc.to_dict() or {}
            translated: str | None = data.get("translatedText")
            if not translated:
                return None

            logger.debug("Translation cache hit", extra={"cache_key": cache_key})

            # Increment usage for this entry and decay all others.
            self._apply_decay(touched_key=cache_key, delta=1)

            return translated

        except Exception as exc:
            logger.warning(
                "Failed to read from translation cache: %s",
                exc,
                extra={"cache_key": cache_key},
            )
            return None

    def set(
        self,
        cache_key: str,
        source_text: str,
        translated_text: str,
        target_language: str,
    ) -> None:
        """Store a new translation result in the cache.

        The new entry is written with ``usage=1``.  All existing entries are
        decremented by 1 via Firestore batch writes (decay step).  If the
        total number of entries would exceed :attr:`max_size` after insertion,
        the lowest-usage entries are deleted until the count is back under the
        limit.

        Args:
            cache_key: SHA-256 document ID for the cache entry.
            source_text: The original text that was translated.
            translated_text: The translated result.
            target_language: BCP-47 target language code.
        """
        try:
            db = self._db()
            now = _now_iso()

            # Write the new entry with usage=1.
            db.collection(self._collection_name).document(cache_key).set(
                {
                    "sourceText": source_text,
                    "translatedText": translated_text,
                    "targetLanguage": target_language,
                    "usage": 1,
                    "createdAt": now,
                    "updatedAt": now,
                }
            )
            logger.debug("Translation cached", extra={"cache_key": cache_key})

            # Decay all existing entries (excluding the one we just wrote).
            self._apply_decay(touched_key=cache_key, delta=1)

            # Prune the cache if it exceeds the size limit.
            self._prune_if_needed()

        except Exception as exc:
            logger.warning(
                "Failed to write to translation cache: %s",
                exc,
                extra={"cache_key": cache_key},
            )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _db(self) -> Any:
        """Return the initialised Firestore client.

        Returns:
            A ``google.cloud.firestore_v1.Client`` instance.

        Raises:
            ImportError: If ``firebase-admin`` is not installed.
            RuntimeError: If Firebase Admin SDK is not initialised.
        """
        from firebase_admin import firestore  # type: ignore[import-untyped]

        return firestore.client()

    def _apply_decay(self, touched_key: str, delta: int) -> None:
        """Apply the decay step for a translation event.

        Increments ``usage`` by *delta* for *touched_key* and decrements
        ``usage`` by *delta* for every other entry in the collection.

        All updates are performed as Firestore batch writes in chunks of
        :data:`_BATCH_SIZE` to stay within Firestore limits.  Only document
        IDs are fetched (via a projected query) to minimise data transfer.

        Args:
            touched_key: Cache key of the entry that was just used or written.
            delta: Amount to add to the touched entry (and subtract from all
                others).
        """
        try:
            db = self._db()
            collection = db.collection(self._collection_name)
            from firebase_admin import firestore as fs  # type: ignore[import-untyped]

            # Increment the touched entry.
            collection.document(touched_key).update(
                {"usage": fs.Increment(delta), "updatedAt": _now_iso()}
            )

            # Fetch only document IDs (projected query) to avoid reading full
            # document payloads — significantly reduces data transfer for large
            # collections near the 10k cap.
            other_docs = [
                doc for doc in collection.select([]).stream()
                if doc.id != touched_key
            ]
            if not other_docs:
                return

            chunks = [
                other_docs[i : i + _BATCH_SIZE]
                for i in range(0, len(other_docs), _BATCH_SIZE)
            ]
            now = _now_iso()
            for chunk in chunks:
                batch = db.batch()
                for doc in chunk:
                    batch.update(
                        collection.document(doc.id),
                        {"usage": fs.Increment(-delta), "updatedAt": now},
                    )
                batch.commit()

            logger.debug(
                "Decay applied",
                extra={
                    "touched_key": touched_key,
                    "delta": delta,
                    "others_decremented": len(other_docs),
                },
            )
        except Exception as exc:
            logger.warning("Failed to apply translation cache decay: %s", exc)

    def _prune_if_needed(self) -> None:
        """Delete the lowest-usage entries if the cache exceeds *max_size*.

        Uses a count aggregation query to avoid loading all documents into
        memory when pruning is not needed.  Only streams documents when the
        count exceeds the limit.
        """
        try:
            db = self._db()
            collection = db.collection(self._collection_name)

            # Use an aggregation count query to check the total without loading
            # all document payloads — O(1) data transfer when under the limit.
            try:
                count_query = collection.count()
                count_result = count_query.get()
                total = count_result[0][0].value
            except Exception:
                # Fallback for environments where count() is unavailable
                # (e.g. Firestore emulator versions that predate the feature).
                all_docs = list(collection.select([]).stream())
                total = len(all_docs)

            if total <= self._max_size:
                return

            # How many entries to delete.
            to_delete = total - self._max_size
            logger.info(
                "Translation cache over limit — pruning",
                extra={"total": total, "limit": self._max_size, "to_delete": to_delete},
            )

            # Stream full documents so we can sort by usage and delete the
            # lowest-usage entries.  This is only done when pruning is needed.
            all_docs = list(collection.stream())
            sorted_docs = sorted(
                all_docs,
                key=lambda d: (d.to_dict() or {}).get("usage", 0),
            )
            candidates = sorted_docs[:to_delete]

            # Delete in batches.
            chunks = [
                candidates[i : i + _BATCH_SIZE]
                for i in range(0, len(candidates), _BATCH_SIZE)
            ]
            for chunk in chunks:
                batch = db.batch()
                for doc in chunk:
                    batch.delete(collection.document(doc.id))
                batch.commit()

            logger.info(
                "Translation cache pruned",
                extra={"deleted": len(candidates), "remaining": total - len(candidates)},
            )
        except Exception as exc:
            logger.warning("Failed to prune translation cache: %s", exc)
