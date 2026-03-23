import io
import zipfile

import pytest

from app.services.zip_service import ZipService
from app.utils.exceptions import ZipExtractionError

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ALLOWED = frozenset({".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp", ".docx"})
_MAX = 10 * 1024 * 1024  # 10 MB


def _make_zip(entries: dict[str, bytes]) -> bytes:
    """Build an in-memory ZIP archive from a {name: content} mapping."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_STORED) as zf:
        for name, data in entries.items():
            zf.writestr(name, data)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_extract_single_supported_file() -> None:
    """A ZIP with one supported file returns a single entry."""
    content = _make_zip({"rg.png": b"fake-png-bytes"})
    service = ZipService()
    result = service.extract(content, _ALLOWED, _MAX)
    assert len(result) == 1
    name, ext, data = result[0]
    assert name == "rg.png"
    assert ext == ".png"
    assert data == b"fake-png-bytes"


def test_extract_multiple_files() -> None:
    """A ZIP with several supported files returns all of them."""
    content = _make_zip(
        {
            "rg.jpg": b"jpg-bytes",
            "ctps.pdf": b"pdf-bytes",
            "pis.docx": b"docx-bytes",
        }
    )
    service = ZipService()
    result = service.extract(content, _ALLOWED, _MAX)
    assert len(result) == 3
    names = {r[0] for r in result}
    assert names == {"rg.jpg", "ctps.pdf", "pis.docx"}


def test_extract_skips_directories() -> None:
    """Directory entries inside the ZIP are silently skipped."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w") as zf:
        zf.mkdir("subfolder")  # directory entry
        zf.writestr("subfolder/doc.pdf", b"pdf-bytes")
    service = ZipService()
    result = service.extract(buf.getvalue(), _ALLOWED, _MAX)
    assert len(result) == 1
    assert result[0][0] == "doc.pdf"


def test_extract_skips_macos_metadata() -> None:
    """Entries under __MACOSX/ are silently skipped."""
    content = _make_zip(
        {
            "doc.pdf": b"pdf-bytes",
            "__MACOSX/doc.pdf": b"macos-metadata",
        }
    )
    service = ZipService()
    result = service.extract(content, _ALLOWED, _MAX)
    assert len(result) == 1
    assert result[0][0] == "doc.pdf"


def test_extract_skips_hidden_files() -> None:
    """Hidden files (basename starting with '.') are silently skipped."""
    content = _make_zip(
        {
            "doc.jpg": b"jpg-bytes",
            ".DS_Store": b"hidden",
            "folder/.hidden.pdf": b"also-hidden",
        }
    )
    service = ZipService()
    result = service.extract(content, _ALLOWED, _MAX)
    assert len(result) == 1
    assert result[0][0] == "doc.jpg"


def test_extract_skips_unsupported_extensions() -> None:
    """Entries with unsupported extensions are silently skipped."""
    content = _make_zip(
        {
            "notes.txt": b"plain text",
            "data.csv": b"a,b,c",
            "rg.jpg": b"jpg-bytes",
        }
    )
    service = ZipService()
    result = service.extract(content, _ALLOWED, _MAX)
    assert len(result) == 1
    assert result[0][0] == "rg.jpg"


def test_extract_no_supported_files_raises() -> None:
    """ZIP containing only unsupported files raises ZipExtractionError."""
    content = _make_zip({"readme.txt": b"nothing here", "data.csv": b"a,b"})
    service = ZipService()
    with pytest.raises(ZipExtractionError, match="no supported document files"):
        service.extract(content, _ALLOWED, _MAX)


def test_extract_invalid_zip_raises() -> None:
    """Non-ZIP bytes raise ZipExtractionError."""
    service = ZipService()
    with pytest.raises(ZipExtractionError, match="Invalid ZIP archive"):
        service.extract(b"this is not a zip file at all", _ALLOWED, _MAX)


def test_extract_entry_too_large_raises() -> None:
    """A ZIP entry whose declared size exceeds max_entry_bytes raises ZipExtractionError."""
    large = b"x" * (5 * 1024 * 1024)  # 5 MB
    content = _make_zip({"big.jpg": large})
    small_limit = 1 * 1024 * 1024  # 1 MB limit
    service = ZipService()
    with pytest.raises(ZipExtractionError, match="exceeds the maximum allowed size"):
        service.extract(content, _ALLOWED, small_limit)


def test_extract_path_traversal_uses_basename() -> None:
    """Entry names with directory components are reduced to their basename."""
    content = _make_zip({"deeply/nested/path/rg.pdf": b"pdf-bytes"})
    service = ZipService()
    result = service.extract(content, _ALLOWED, _MAX)
    assert len(result) == 1
    assert result[0][0] == "rg.pdf"


def test_extract_mixed_zip_and_unsupported() -> None:
    """Unsupported entries are skipped; supported entries are returned."""
    content = _make_zip(
        {
            "readme.txt": b"ignored",
            "cert.png": b"png-bytes",
            "diploma.pdf": b"pdf-bytes",
        }
    )
    service = ZipService()
    result = service.extract(content, _ALLOWED, _MAX)
    assert len(result) == 2
    names = {r[0] for r in result}
    assert names == {"cert.png", "diploma.pdf"}
