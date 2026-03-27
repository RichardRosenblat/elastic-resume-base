"""Unit tests for the RateLimiter utility."""

import time
from unittest.mock import patch

import pytest

from app.utils.rate_limiter import RateLimiter


def test_allows_calls_within_limit() -> None:
    """All calls within the configured max are allowed."""
    limiter = RateLimiter(max_calls=5, window_seconds=60)
    for _ in range(5):
        assert limiter.is_allowed() is True


def test_rejects_call_exceeding_limit() -> None:
    """The (max_calls + 1)-th call within the window is rejected."""
    limiter = RateLimiter(max_calls=3, window_seconds=60)
    for _ in range(3):
        limiter.is_allowed()
    assert limiter.is_allowed() is False


def test_allows_call_after_window_expires() -> None:
    """A previously rejected call is accepted once the window rolls over."""
    limiter = RateLimiter(max_calls=2, window_seconds=1)

    # Fill the window.
    limiter.is_allowed()
    limiter.is_allowed()
    assert limiter.is_allowed() is False  # limit reached

    # Advance time past the window boundary.
    with patch("app.utils.rate_limiter.time.monotonic", return_value=time.monotonic() + 2):
        assert limiter.is_allowed() is True


def test_sliding_window_evicts_old_timestamps() -> None:
    """Timestamps older than the window are evicted on each call."""
    limiter = RateLimiter(max_calls=2, window_seconds=10)

    base = time.monotonic()
    with patch("app.utils.rate_limiter.time.monotonic", return_value=base):
        limiter.is_allowed()

    # Advance 5 s — first timestamp still in window.
    with patch("app.utils.rate_limiter.time.monotonic", return_value=base + 5):
        limiter.is_allowed()

    # Advance 16 s — both original timestamps are now outside the 10 s window.
    # window_start = base+16 - 10 = base+6  →  base+0 and base+5 are both evicted.
    with patch("app.utils.rate_limiter.time.monotonic", return_value=base + 16):
        assert limiter.is_allowed() is True
        assert limiter.is_allowed() is True
        # Third call in this window — now at the limit.
        assert limiter.is_allowed() is False


def test_zero_max_calls_always_rejects() -> None:
    """A limiter with max_calls=0 never permits a call."""
    limiter = RateLimiter(max_calls=0, window_seconds=60)
    assert limiter.is_allowed() is False
