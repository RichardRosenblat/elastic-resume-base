"""Health-check route."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get(
    "/health",
    summary="Health check",
    description="Returns HTTP 200 with ``{\"status\": \"ok\"}`` when the service is running.",
    tags=["Health"],
)
async def health_check() -> JSONResponse:
    """Return a simple liveness indicator."""
    return JSONResponse(content={"status": "ok"})
