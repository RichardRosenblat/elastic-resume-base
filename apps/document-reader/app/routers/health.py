from bowltie_py import format_success
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(tags=["Health"])


@router.get("/live")
async def liveness_check() -> JSONResponse:
    """Liveness probe — confirms the service process is running.

    Used by orchestrators (Cloud Run, Kubernetes) to decide whether to restart
    the container.  Returns HTTP 200 as long as the process is alive.

    Returns:
        JSONResponse containing a Bowltie-formatted ``{"status": "ok"}`` payload.
    """
    return JSONResponse(format_success({"status": "ok"}))


@router.get("/ready")
async def readiness_check() -> JSONResponse:
    """Readiness probe — confirms the service is ready to accept traffic.

    Used by orchestrators to gate traffic until the service has fully
    initialised.  Returns HTTP 200 when all startup steps have completed.

    Returns:
        JSONResponse containing a Bowltie-formatted ``{"status": "ok"}`` payload.
    """
    return JSONResponse(format_success({"status": "ok"}))
