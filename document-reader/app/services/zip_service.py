import io
import os
import zipfile

from toolbox_py import get_logger

from app.utils.exceptions import ZipExtractionError

logger = get_logger(__name__)

# ZIP entry prefixes that are always skipped (macOS resource-fork metadata, etc.)
_SKIP_PREFIXES = ("__MACOSX/",)


class ZipService:
    """Service for extracting document files from ZIP archives."""

    def extract(
        self,
        content: bytes,
        allowed_extensions: frozenset[str],
        max_entry_bytes: int,
    ) -> list[tuple[str, str, bytes]]:
        """Extract supported document files from a ZIP archive.

        Skips macOS metadata directories (``__MACOSX/``), hidden entries
        (basename starts with ``'.'``), directory entries, and entries whose
        extension is not in *allowed_extensions*.

        Only the **basename** of each entry path is kept to prevent any path-
        traversal attacks embedded in archive entry names.

        Args:
            content: Raw ZIP file bytes.
            allowed_extensions: Set of lowercase file extensions to accept
                (e.g. ``frozenset({'.pdf', '.jpg'})``).
            max_entry_bytes: Maximum allowed uncompressed size in bytes for a
                single entry.  Entries that exceed this limit raise
                :class:`~app.utils.exceptions.ZipExtractionError`.

        Returns:
            List of ``(filename, extension, file_bytes)`` tuples for each
            accepted entry, in the order they appear in the archive.

        Raises:
            ZipExtractionError: If *content* is not a valid ZIP file, if an
                entry is password-protected, if a supported entry exceeds
                *max_entry_bytes*, or if the archive contains no supported
                document files.
        """
        try:
            zf = zipfile.ZipFile(io.BytesIO(content))
        except zipfile.BadZipFile as exc:
            raise ZipExtractionError(f"Invalid ZIP archive: {exc}") from exc

        entries: list[tuple[str, str, bytes]] = []

        try:
            for info in zf.infolist():
                if info.is_dir():
                    continue

                name = info.filename

                # Skip macOS resource-fork metadata directories.
                if any(name.startswith(prefix) for prefix in _SKIP_PREFIXES):
                    logger.debug("Skipping macOS metadata ZIP entry", extra={"entry": name})
                    continue

                # Sanitise: use only the final path component to prevent traversal.
                safe_name = os.path.basename(name)

                # Skip hidden / system files (e.g. .DS_Store).
                if safe_name.startswith("."):
                    logger.debug("Skipping hidden ZIP entry", extra={"entry": name})
                    continue

                _, ext = os.path.splitext(safe_name)
                ext = ext.lower()

                if ext not in allowed_extensions:
                    logger.debug(
                        "Skipping unsupported ZIP entry",
                        extra={"entry": name, "ext": ext},
                    )
                    continue

                # Guard against ZIP bombs: check the declared uncompressed size
                # before decompressing.
                if info.file_size > max_entry_bytes:
                    raise ZipExtractionError(
                        f"Entry '{safe_name}' in ZIP exceeds the maximum allowed size of "
                        f"{max_entry_bytes // (1024 * 1024)} MB"
                    )

                try:
                    file_bytes = zf.read(info)
                except RuntimeError as exc:
                    # Raised by zipfile when the entry requires a password.
                    raise ZipExtractionError(
                        f"Cannot read entry '{safe_name}': "
                        "password-protected archives are not supported."
                    ) from exc

                # Double-check actual decompressed size (declared size may be wrong).
                if len(file_bytes) > max_entry_bytes:
                    raise ZipExtractionError(
                        f"Entry '{safe_name}' in ZIP exceeds the maximum allowed size of "
                        f"{max_entry_bytes // (1024 * 1024)} MB"
                    )

                entries.append((safe_name, ext, file_bytes))
                logger.info("Extracted ZIP entry", extra={"entry": safe_name})
        finally:
            zf.close()

        if not entries:
            raise ZipExtractionError(
                "ZIP archive contains no supported document files. "
                f"Supported types: {', '.join(sorted(allowed_extensions))}"
            )

        return entries
