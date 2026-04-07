"""Health check endpoints for the Search Base service."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.dependencies import get_search_service
from app.utils.exceptions import IndexNotReadyError

router = APIRouter(tags=["Health"])


@router.get("/live", summary="Liveness probe")
async def liveness() -> JSONResponse:
    """Liveness probe endpoint.

    Returns HTTP 200 if the service process is alive.

    Returns:
        JSON response with status "alive".
    """
    return JSONResponse({"status": "alive"})


@router.get("/ready", summary="Readiness probe")
async def readiness() -> JSONResponse:
    """Readiness probe endpoint.

    Returns HTTP 200 if the service is ready to handle requests (i.e., the
    FAISS index is initialized).  Returns HTTP 503 if the index is not ready.

    Returns:
        JSON response with status "ready" or "not_ready".
    """
    try:
        service = get_search_service()
        # Check if index is initialized and not empty
        if service._index is None:
            return JSONResponse(
                {"status": "not_ready", "reason": "Index not initialized"},
                status_code=503,
            )
        return JSONResponse({"status": "ready"})
    except Exception as exc:
        return JSONResponse(
            {"status": "not_ready", "reason": str(exc)},
            status_code=503,
        )
