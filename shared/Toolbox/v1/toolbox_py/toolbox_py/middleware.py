"""ASGI middleware for correlation ID and GCP Cloud Trace context propagation.

This module provides :class:`CorrelationIdMiddleware`, a Starlette/FastAPI
``BaseHTTPMiddleware`` that:

* Reads or generates a correlation ID from the ``x-correlation-id`` request
  header, stores it in a context variable, and echoes it back in the response.
* Parses the ``x-cloud-trace-context`` request header (format:
  ``TRACE_ID/SPAN_ID;o=FLAG``) and stores the trace ID and span ID in context
  variables.  When the header is absent or malformed the trace ID is derived
  from the correlation ID (UUID without hyphens → 32 hex chars) and span ID
  defaults to ``"0"``.
* Sets the ``x-cloud-trace-context`` response header so that downstream
  services can continue the same trace.

The three context variables are exposed as module-level accessor functions::

    from toolbox_py import get_correlation_id, get_trace_id, get_span_id

    correlation_id = get_correlation_id()

and are automatically injected into every log entry when the root logger is
configured with :func:`toolbox_py.logger.setup_logging`.
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Awaitable, Callable
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# ─── Context variables ────────────────────────────────────────────────────────

_correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")
_trace_id_var: ContextVar[str] = ContextVar("trace_id", default="")
_span_id_var: ContextVar[str] = ContextVar("span_id", default="")

# Regex that matches the X-Cloud-Trace-Context header value.
# Format: TRACE_ID/SPAN_ID  or  TRACE_ID/SPAN_ID;o=FLAG
_CLOUD_TRACE_PATTERN = re.compile(
    r"^([0-9a-f]{32})/([0-9]+)(?:;o=\d+)?$",
    re.IGNORECASE,
)


# ─── Accessor helpers ─────────────────────────────────────────────────────────


def get_correlation_id() -> str:
    """Return the correlation ID for the current request context.

    Returns an empty string when called outside of a request context.
    """
    return _correlation_id_var.get()


def get_trace_id() -> str:
    """Return the GCP Cloud Trace trace ID for the current request context.

    Returns an empty string when called outside of a request context.
    """
    return _trace_id_var.get()


def get_span_id() -> str:
    """Return the GCP Cloud Trace span ID for the current request context.

    Returns an empty string when called outside of a request context.
    """
    return _span_id_var.get()


# ─── Middleware ───────────────────────────────────────────────────────────────


def _parse_cloud_trace_context(header: str | None) -> tuple[str, str] | None:
    """Parse the ``X-Cloud-Trace-Context`` header value.

    Args:
        header: Raw header value, or ``None`` when the header is absent.

    Returns:
        A ``(trace_id, span_id)`` tuple when the header is valid, or ``None``
        when the header is absent or does not match the expected format.
    """
    if not header:
        return None
    match = _CLOUD_TRACE_PATTERN.match(header)
    if not match:
        return None
    return match.group(1).lower(), match.group(2)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """ASGI middleware that propagates correlation IDs and GCP Cloud Trace context.

    Attach this middleware to a FastAPI / Starlette application **before** any
    other middleware that needs access to the context variables::

        from toolbox_py import CorrelationIdMiddleware

        app.add_middleware(CorrelationIdMiddleware)

    The middleware:

    1. Reads the ``x-correlation-id`` request header, or generates a new UUID
       v4 when the header is absent.
    2. Reads and parses the ``x-cloud-trace-context`` request header.  When
       absent or malformed, derives the trace ID from the correlation ID (UUID
       without hyphens) and sets span ID to ``"0"``.
    3. Stores all three values in :mod:`contextvars` so that loggers configured
       via :func:`~toolbox_py.logger.setup_logging` include them automatically.
    4. Adds ``x-correlation-id`` and ``x-cloud-trace-context`` headers to the
       response so that callers and downstream services can continue the trace.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Process the request, injecting tracing context into context variables.

        Args:
            request: The incoming HTTP request.
            call_next: Callable that forwards the request to the next handler.

        Returns:
            The downstream response, augmented with tracing response headers.
        """
        correlation_id = request.headers.get("x-correlation-id") or str(uuid.uuid4())

        parsed = _parse_cloud_trace_context(request.headers.get("x-cloud-trace-context"))
        if parsed:
            trace_id, span_id = parsed
        else:
            trace_id = correlation_id.replace("-", "")
            span_id = "0"

        _correlation_id_var.set(correlation_id)
        _trace_id_var.set(trace_id)
        _span_id_var.set(span_id)

        response = await call_next(request)

        response.headers["x-correlation-id"] = correlation_id
        response.headers["x-cloud-trace-context"] = f"{trace_id}/{span_id};o=1"

        return response
