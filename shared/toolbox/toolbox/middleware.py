"""Correlation-ID middleware for FastAPI services.

Mirrors the ``correlationIdHook`` in the TypeScript Toolbox library so that
every Python service uses the same header name and resolution logic as the
Node.js services.

Usage::

    from toolbox.middleware import CorrelationIdMiddleware

    app = FastAPI()
    app.add_middleware(CorrelationIdMiddleware)

After the middleware runs, every request object exposes ``request.state.correlation_id``
and the response automatically carries an ``x-correlation-id`` header.
"""

from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

CORRELATION_ID_HEADER = "x-correlation-id"


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Attach a correlation ID to every incoming request.

    Resolution order (mirrors the TypeScript implementation):

    1. The value of the incoming ``x-correlation-id`` request header (forwarded
       from the BFF Gateway or another upstream caller).
    2. A freshly generated UUID v4 when the header is absent.

    The resolved ID is stored on ``request.state.correlation_id`` so that route
    handlers can pass it to Bowltie's ``format_success``/``format_error``.
    It is also echoed back to the caller as the ``x-correlation-id`` response
    header for end-to-end distributed tracing.

    Example:
        >>> app.add_middleware(CorrelationIdMiddleware)
        >>> # In a route handler:
        >>> def my_route(request: Request) -> JSONResponse:
        ...     cid = request.state.correlation_id
        ...     return JSONResponse(
        ...         content=format_success(data, correlation_id=cid).to_dict()
        ...     )
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Process the request, attaching / generating a correlation ID.

        Args:
            request: The incoming Starlette/FastAPI request.
            call_next: The next middleware or route handler in the chain.

        Returns:
            The response with the ``x-correlation-id`` header set.
        """
        correlation_id = request.headers.get(CORRELATION_ID_HEADER) or str(uuid.uuid4())
        request.state.correlation_id = correlation_id

        response: Response = await call_next(request)
        response.headers[CORRELATION_ID_HEADER] = correlation_id
        return response
