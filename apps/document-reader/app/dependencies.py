"""FastAPI dependencies for the document-reader service.

Reusable :func:`Depends`-compatible callables that can be attached to
individual routes or entire routers.
"""

import threading

from fastapi import HTTPException, Request
from toolbox_py import get_logger

from app.config import settings
from app.utils.rate_limiter import RateLimiter

logger = get_logger(__name__)

# Per-IP API rate limiter — shared across all requests to this process.
# Note: entries are never evicted; the dict is bounded in practice by the
# number of unique client IPs that reach this process (typically small for
# an internal OCR microservice). A future improvement could add LRU eviction.
_api_rate_limiters: dict[str, RateLimiter] = {}
_api_rate_limiter_lock = threading.Lock()

_API_RATE_LIMIT_MESSAGE = (
    "You have exceeded the maximum number of requests allowed. "
    "Please try again later."
)

__all__ = ["check_api_rate_limit", "_reset_rate_limiters_for_testing"]


def _get_client_ip(request: Request) -> str:
    """Return the best-effort client IP address from the request.

    Checks the ``X-Forwarded-For`` header first (set by reverse proxies),
    then falls back to the direct connection's remote address.

    Args:
        request: The incoming FastAPI/Starlette request.

    Returns:
        The client IP string, or ``"unknown"`` if it cannot be determined.
    """
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_api_rate_limit(request: Request) -> None:
    """FastAPI dependency that enforces per-IP API rate limiting.

    Lazily creates a :class:`~app.utils.rate_limiter.RateLimiter` for each
    unique client IP and rejects requests that exceed
    ``settings.rate_limit_per_minute`` calls per minute.

    Args:
        request: The incoming request (injected by FastAPI).

    Returns:
        ``None``. Raises when the request exceeds the allowed rate.

    Raises:
        HTTPException: 429 if the client has exceeded the allowed request rate.
    """
    client_ip = _get_client_ip(request)
    with _api_rate_limiter_lock:
        if client_ip not in _api_rate_limiters:
            _api_rate_limiters[client_ip] = RateLimiter(
                max_calls=settings.rate_limit_per_minute,
                window_seconds=60,
            )
        limiter = _api_rate_limiters[client_ip]
    if not limiter.is_allowed():
        logger.warning("API rate limit reached for client %s", client_ip)
        raise HTTPException(status_code=429, detail=_API_RATE_LIMIT_MESSAGE)


def _reset_rate_limiters_for_testing() -> None:
    """Clear all per-IP rate limiter state.

    **For use in tests only.**  Resets the shared limiter dictionary so that
    each test starts from a clean state without cross-test contamination.

    Returns:
        ``None``.
    """
    with _api_rate_limiter_lock:
        _api_rate_limiters.clear()
