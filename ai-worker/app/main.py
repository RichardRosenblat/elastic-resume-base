"""FastAPI application entrypoint for the AI Worker service.

Startup sequence:
1. Configure structured JSON logging.
2. Initialise Hermes SMTP (DLQ alerts) and Hermes Pub/Sub.
3. Initialise Synapse (Firestore persistence — owned by Synapse, not the AI Worker).
4. Instantiate service and repository objects.
5. Register middlewares: CorrelationId, RequestLogger, slowapi rate limiter.
6. Mount API routers.
7. Register shutdown handler.

The AI Worker has **no direct dependency** on ``google-cloud-firestore`` or
``google-cloud-pubsub`` — those are owned exclusively by Synapse and Hermes
respectively.  The only permitted direct GCP dependency is ``vertexai``.
"""

from __future__ import annotations

import logging
import logging.config
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler  # type: ignore[attr-defined]
from slowapi.errors import RateLimitExceeded  # type: ignore[attr-defined]

from hermes import initialize_messaging_from_env
from hermes.pubsub import initialize_pubsub, get_pubsub_service
from hermes.pubsub_options import PubSubOptions
from synapse.persistence import PersistenceOptions, initialize_persistence, terminate_persistence
from synapse.repositories import FirestoreResumeDocumentStore, FirestoreResumeEmbeddingStore
from toolbox.middleware.correlation_id import CorrelationIdMiddleware
from toolbox.middleware.request_logger import RequestLoggerMiddleware

from app.config import settings
from app.rate_limit import limiter
from app.routers.health import router as health_router
from app.routers.pubsub import router as pubsub_router
from app.services.ai_worker_service import AIWorkerService
from app.services.vertex_ai_service import VertexAIService


def _configure_logging() -> None:
    """Configure structured JSON-compatible logging for Google Cloud Logging."""
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: initialise and tear down resources."""
    _configure_logging()
    logger = logging.getLogger(__name__)
    logger.info("AI Worker starting up.")

    # 1. Initialise Hermes SMTP for DLQ alerts.
    try:
        initialize_messaging_from_env()
        logger.info("Hermes SMTP messaging layer initialised.")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Hermes SMTP could not be initialised: %s — DLQ alerts disabled.", exc)

    # 2. Initialise Hermes Pub/Sub (owns google-cloud-pubsub).
    initialize_pubsub(
        PubSubOptions(
            project_id=settings.project_id,
            emulator_host=settings.pubsub_emulator_host,
        )
    )
    logger.info("Hermes Pub/Sub layer initialised.")

    # 3. Initialise Synapse (owns google-cloud-firestore).
    initialize_persistence(
        PersistenceOptions(
            project_id=settings.project_id,
            emulator_host=settings.firestore_emulator_host,
        )
    )
    logger.info("Synapse Firestore persistence initialised.")

    # 4. Instantiate service and store objects.
    resume_store = FirestoreResumeDocumentStore(settings.firestore_resumes_collection)
    embedding_store = FirestoreResumeEmbeddingStore(settings.firestore_embeddings_collection)
    vertex_ai = VertexAIService(
        project_id=settings.project_id,
        location=settings.vertex_ai_location,
        extraction_model=settings.vertex_ai_extraction_model,
        embedding_model=settings.vertex_ai_embedding_model,
        max_calls_per_minute=settings.vertex_ai_max_calls_per_minute,
    )
    worker_service = AIWorkerService(
        resume_store=resume_store,
        embedding_store=embedding_store,
        vertex_ai=vertex_ai,
        pubsub=get_pubsub_service(),
        output_topic=settings.pubsub_output_topic,
        dlq_alert_recipient=settings.dlq_alert_recipient,
    )

    # Store singletons on application state for dependency injection.
    app.state.limiter = limiter
    app.state.worker_service = worker_service

    logger.info("AI Worker ready.")
    yield

    # Teardown.
    logger.info("AI Worker shutting down.")
    await terminate_persistence()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.

    Returns:
        The fully configured :class:`fastapi.FastAPI` instance.
    """
    app = FastAPI(
        title="AI Worker",
        description=(
            "Processes resume-ingested Pub/Sub events: extracts structured JSON "
            "and generates embedding vectors using Vertex AI.  Persists structured "
            "data to the ``resumes`` collection and embeddings to the separate "
            "``resume_embeddings`` collection via Synapse, then publishes a "
            "``resume_indexing`` event via Hermes."
        ),
        version="2.0.0",
        lifespan=lifespan,
    )

    # ── Middleware (outermost first) ────────────────────────────────────────
    app.add_middleware(RequestLoggerMiddleware, logger_name="ai_worker.http")
    app.add_middleware(CorrelationIdMiddleware)

    # ── Rate limiting (slowapi) ─────────────────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(
        RateLimitExceeded,
        _rate_limit_exceeded_handler,  # type: ignore[arg-type]
    )

    # ── Routers ─────────────────────────────────────────────────────────────
    app.include_router(pubsub_router)
    app.include_router(health_router)

    return app


app = create_app()
