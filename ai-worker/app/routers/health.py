"""Health check endpoint for the AI Worker.

Returns a Bowltie :class:`~bowltie.response.SuccessResponse` with a simple
``{ "status": "healthy" }`` payload so that infrastructure health checks and
load balancers can verify the service is running.  The correlation ID from
the incoming request is forwarded in the response envelope ``meta``.
"""

import logging
from typing import Any

from fastapi import APIRouter, Request

from bowltie.response import SuccessResponse, format_success
from toolbox.middleware.correlation_id import get_correlation_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])


@router.get(
    "",
    summary="Health check",
    response_model=SuccessResponse[dict[str, Any]],
    description="Returns 200 with a Bowltie success envelope when the service is healthy.",
)
async def health_check(request: Request) -> SuccessResponse[dict[str, Any]]:
    """Return service health status wrapped in a Bowltie SuccessResponse.

    Args:
        request: Incoming request (used for correlation ID propagation).

    Returns:
        :class:`~bowltie.response.SuccessResponse` with ``{"status": "healthy"}``.
    """
    return format_success({"status": "healthy"}, correlation_id=get_correlation_id())
