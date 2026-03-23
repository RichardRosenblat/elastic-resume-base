import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.routers import documents, health
from app.utils.logger import configure_logging

configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application lifespan events."""
    logger.info("Document Reader service starting up")
    yield
    logger.info("Document Reader service shutting down")


app = FastAPI(
    title="Document Reader",
    version="1.0.0",
    description="OCR service for extracting text and structured data from Brazilian documents.",
    lifespan=lifespan,
)

app.include_router(documents.router, prefix="/api/v1")
app.include_router(health.router)
