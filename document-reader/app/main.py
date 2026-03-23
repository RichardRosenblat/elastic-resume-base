import logging

from fastapi import FastAPI

from app.config import settings
from app.routers import documents, health
from app.utils.logger import configure_logging

configure_logging(settings.log_level)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Document Reader",
    version="1.0.0",
    description="OCR service for extracting text and structured data from Brazilian documents.",
)

app.include_router(documents.router, prefix="/api/v1")
app.include_router(health.router)


@app.on_event("startup")
async def on_startup() -> None:
    """Log service startup."""
    logger.info("Document Reader service starting up")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    """Log service shutdown."""
    logger.info("Document Reader service shutting down")
