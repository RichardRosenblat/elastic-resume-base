"""Structured HTTP request/response logging middleware.

Mirrors the TypeScript Toolbox ``createRequestLoggerHook`` for Fastify.

Logs one ``INFO`` entry per completed request containing:

- ``method`` — HTTP verb
- ``path`` — request path (without query string)
- ``status_code`` — HTTP response status
- ``duration_ms`` — elapsed time in milliseconds
- ``correlation_id`` — trace ID from :mod:`toolbox.middleware.correlation_id`

Usage::

    from toolbox.middleware.request_logger import RequestLoggerMiddleware

    app.add_middleware(RequestLoggerMiddleware)
    # Optionally pass a custom logger name:
    app.add_middleware(RequestLoggerMiddleware, logger_name="myservice.http")
"""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from toolbox.middleware.correlation_id import get_correlation_id


class RequestLoggerMiddleware(BaseHTTPMiddleware):
    """Starlette middleware that emits a structured log entry per HTTP request.

    Args:
        app: The ASGI application (injected by Starlette automatically).
        logger_name: Name of the Python logger to use.
            Defaults to ``"toolbox.request_logger"``.

    Example:
        >>> from fastapi import FastAPI
        >>> from toolbox.middleware.request_logger import RequestLoggerMiddleware
        >>> app = FastAPI()
        >>> app.add_middleware(RequestLoggerMiddleware, logger_name="ai_worker.http")
    """

    def __init__(self, app: object, logger_name: str = "toolbox.request_logger") -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self._logger = logging.getLogger(logger_name)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Process the request and log the result.

        Args:
            request: The incoming request.
            call_next: The next middleware or route handler.

        Returns:
            The unmodified response from downstream.
        """
        start = time.monotonic()
        response: Response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000)

        self._logger.info(
            "HTTP request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "correlation_id": get_correlation_id(),
            },
        )
        return response
