"""Request-timeout middleware for the ingestor FastAPI application.

Wraps every non-health request in an :func:`asyncio.wait_for` guard so that
requests that take longer than :attr:`~app.config.Settings.http_request_timeout`
seconds are terminated with an HTTP 504 Gateway Timeout response.
"""

import asyncio
from collections.abc import Awaitable, Callable

from bowltie_py import format_error
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from toolbox_py import get_logger

logger = get_logger(__name__)


class TimeoutMiddleware(BaseHTTPMiddleware):
    """ASGI middleware that enforces a per-request wall-clock timeout.

    Health-check paths (``/health/*``) are excluded so that liveness and
    readiness probes are never affected by a long-running ingest request.

    Args:
        app: The ASGI application to wrap.
        timeout_seconds: Maximum number of seconds a request may run before
            a 504 response is returned.
    """

    def __init__(self, app: object, timeout_seconds: float) -> None:
        """Store timeout configuration for request processing.

        Args:
            app: The ASGI application instance being wrapped.
            timeout_seconds: Maximum request processing time in seconds.

        Returns:
            ``None``.
        """
        super().__init__(app)  # type: ignore[arg-type]
        self._timeout = timeout_seconds

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Process the request, enforcing the configured timeout.

        Args:
            request: The incoming HTTP request.
            call_next: Callable that forwards the request to the next handler.

        Returns:
            The response from the next handler, or a 504 JSON error if the
            timeout is exceeded.

        Raises:
            Exception: Re-raises any downstream exception other than timeout.
        """
        if request.url.path.startswith("/health"):
            return await call_next(request)

        logger.debug(
            "Request timeout guard active",
            extra={
                "method": request.method,
                "path": request.url.path,
                "timeout_seconds": self._timeout,
            },
        )
        try:
            return await asyncio.wait_for(call_next(request), timeout=self._timeout)
        except asyncio.TimeoutError:
            logger.warning(
                "Request timed out",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "timeout_seconds": self._timeout,
                },
            )
            return JSONResponse(
                status_code=504,
                content=format_error(
                    "GATEWAY_TIMEOUT",
                    f"Request timed out after {self._timeout:.1f}s",
                ),
            )
