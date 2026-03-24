"""FastAPI application entrypoint for the AI Worker service.

Startup sequence:
1. Configure structured JSON logging.
2. Initialise Hermes (SMTP messaging for DLQ alerts).
3. Create a Firestore async client.
4. Instantiate service and repository objects.
5. Mount API routers.
6. Register shutdown handler.
"""

from __future__ import annotations

import logging
import logging.config
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from google.cloud import firestore  # type: ignore[attr-defined]
from hermes import initialize_messaging_from_env

from app.config import settings
from app.repositories.resume_repository import ResumeRepository
from app.routers.pubsub import router as pubsub_router
from app.services.ai_worker_service import AIWorkerService
from app.services.pubsub_service import PubSubService
from app.services.vertex_ai_service import VertexAIService


def _configure_logging() -> None:
    """Configure structured JSON-compatible logging for Google Cloud Logging."""
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: initialise and tear down resources.

    Args:
        app: The FastAPI application instance.
    """
    _configure_logging()
    logger = logging.getLogger(__name__)
    logger.info("AI Worker starting up.")

    # Initialise Hermes for DLQ alerts.
    try:
        initialize_messaging_from_env()
        logger.info("Hermes messaging layer initialised.")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Hermes could not be initialised: %s — DLQ alerts disabled.", exc)

    # Build Firestore client.
    db: firestore.AsyncClient = firestore.AsyncClient(project=settings.project_id)

    # Build service dependencies.
    resume_repo = ResumeRepository(db, settings.firestore_resumes_collection)
    vertex_ai = VertexAIService(
        project_id=settings.project_id,
        location=settings.vertex_ai_location,
        extraction_model=settings.vertex_ai_extraction_model,
        embedding_model=settings.vertex_ai_embedding_model,
    )
    pubsub = PubSubService(project_id=settings.project_id)
    worker_service = AIWorkerService(
        resume_repo=resume_repo,
        vertex_ai=vertex_ai,
        pubsub=pubsub,
        output_topic=settings.pubsub_output_topic,
        dlq_alert_recipient=settings.dlq_alert_recipient,
    )

    # Store singletons on application state for dependency injection.
    app.state.db = db
    app.state.worker_service = worker_service

    logger.info("AI Worker ready.")
    yield

    # Teardown.
    logger.info("AI Worker shutting down.")
    db.close()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.

    Returns:
        The fully configured :class:`fastapi.FastAPI` instance.
    """
    app = FastAPI(
        title="AI Worker",
        description=(
            "Processes resume-ingested Pub/Sub events: extracts structured fields "
            "and generates embedding vectors using Vertex AI, then persists results "
            "to Firestore and publishes resume-indexed events."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )
    app.include_router(pubsub_router)
    return app


app = create_app()
