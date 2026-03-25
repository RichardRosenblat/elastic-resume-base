from bowltie_py import format_success
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check() -> JSONResponse:
    """Return the service health status wrapped in a Bowltie success envelope.

    Returns:
        JSONResponse containing a Bowltie-formatted ``{"status": "ok"}`` payload.
    """
    return JSONResponse(format_success({"status": "ok"}))
