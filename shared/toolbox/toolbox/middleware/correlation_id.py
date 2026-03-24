"""Correlation ID middleware for Starlette / FastAPI services.

Mirrors the TypeScript Toolbox ``correlationIdHook`` for Fastify.

Resolution order
----------------
1. The value of the incoming ``x-correlation-id`` request header (forwarded
   from an upstream service or API gateway).
2. A freshly generated UUID v4 when no header is present.

The resolved ID is stored in a ``contextvars.ContextVar`` so it is available
throughout the current async task without explicit parameter passing, and is
echoed back via the ``x-correlation-id`` response header.

Usage::

    from toolbox.middleware.correlation_id import (
        CorrelationIdMiddleware,
        get_correlation_id,
    )

    app.add_middleware(CorrelationIdMiddleware)

    # Anywhere inside a request handler:
    cid = get_correlation_id()
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from contextvars import ContextVar
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

#: HTTP header name used to propagate correlation IDs.
CORRELATION_ID_HEADER: str = "x-correlation-id"

#: Module-level context variable; one value per running async task.
_correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Starlette middleware that attaches a correlation ID to every request.

    The ID is stored in :data:`_correlation_id_var` for the lifetime of the
    request and is added to the response headers so callers can trace requests
    across service boundaries.

    Example:
        >>> from fastapi import FastAPI
        >>> from toolbox.middleware.correlation_id import CorrelationIdMiddleware
        >>> app = FastAPI()
        >>> app.add_middleware(CorrelationIdMiddleware)
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Process the request, attach a correlation ID, and forward.

        Args:
            request: The incoming Starlette/FastAPI request.
            call_next: The next middleware or route handler in the chain.

        Returns:
            The response with the ``x-correlation-id`` header set.
        """
        correlation_id = request.headers.get(CORRELATION_ID_HEADER) or str(uuid4())
        token = _correlation_id_var.set(correlation_id)
        try:
            response: Response = await call_next(request)
        finally:
            _correlation_id_var.reset(token)

        response.headers[CORRELATION_ID_HEADER] = correlation_id
        return response


def get_correlation_id() -> str:
    """Return the correlation ID for the current async task.

    Returns an empty string when called outside of a request context (e.g. in
    background tasks not spawned from a request handler).

    Returns:
        The correlation ID string set by :class:`CorrelationIdMiddleware`, or
        an empty string if none has been set.

    Example:
        >>> from toolbox.middleware.correlation_id import get_correlation_id
        >>> cid = get_correlation_id()
        >>> len(cid) > 0  # True inside a request handler
        False
    """
    return _correlation_id_var.get()
