"""Thread-safe sliding-window rate limiter.

Tracks the timestamps of events within a rolling time window and decides
whether the next event is within the configured limit.
"""

import threading
import time
from collections import deque


class RateLimiter:
    """Sliding-window rate limiter.

    Keeps a deque of event timestamps.  Each call to :meth:`is_allowed`
    first evicts timestamps older than ``window_seconds``, then either
    records the new timestamp (allowed) or rejects it (limit reached).

    Thread-safe: a :class:`threading.Lock` guards all state mutations.

    Args:
        max_calls: Maximum number of calls permitted within the window.
        window_seconds: Length of the sliding window in seconds.
    """

    def __init__(self, max_calls: int, window_seconds: int = 60) -> None:
        """Initialise limiter state for a fixed sliding window policy.

        Args:
            max_calls: Maximum number of calls allowed in one window.
            window_seconds: Sliding-window duration in seconds.

        Returns:
            ``None``.
        """
        self._max_calls = max_calls
        self._window = window_seconds
        self._calls: deque[float] = deque()
        self._lock = threading.Lock()

    def is_allowed(self) -> bool:
        """Check whether the next call is within the rate limit.

        Evicts stale timestamps, then accepts or rejects the new event.

        Args:
            None.

        Returns:
            ``True`` if the call is allowed (and records it), ``False`` if
            the rate limit has been reached.
        """
        now = time.monotonic()
        window_start = now - self._window
        with self._lock:
            while self._calls and self._calls[0] < window_start:
                self._calls.popleft()
            if len(self._calls) >= self._max_calls:
                return False
            self._calls.append(now)
            return True
