"""Entry-point for the Ingestor Service.

Startup sequence:
1. Initialise structured logging (before any other imports).
2. Load ``config.yaml`` via Toolbox to populate environment variables.
3. Load and validate application settings.
4. Initialise Hermes Pub/Sub publisher singleton.
5. Initialise Synapse Firestore persistence singleton.
6. Build the FastAPI application.
7. Start the Uvicorn HTTP server.
"""

from __future__ import annotations

import os

from toolbox import setup_logging

# 1. Initialise structured logging before importing anything else.
setup_logging(
    level=os.environ.get("LOG_LEVEL", "info"),
    json_format=os.environ.get("LOG_FORMAT", "text").lower() == "json",
)

from toolbox import get_logger, load_config_yaml  # noqa: E402 — after setup_logging

logger = get_logger(__name__)

# 2. Load config.yaml — merges systems.shared + systems.ingestor-service into
#    os.environ so that Settings() picks them up below.  Keys already set in
#    the environment (Docker -e, CI secrets, etc.) are never overridden.
load_config_yaml("ingestor-service")

import uvicorn  # noqa: E402

from hermes import initialize_pubsub_from_env  # noqa: E402
from synapse import initialize_persistence_from_env  # noqa: E402

from app.config import load_settings  # noqa: E402
from app.main import create_app  # noqa: E402


def main() -> None:
    """Load configuration, initialise dependencies, and start the server."""
    settings = load_settings()

    logger.info(
        "Ingestor Service starting: port=%d, project=%s, rate_limit=%d/%ds, max_ai_calls=%s.",
        settings.port,
        settings.gcp_project_id,
        settings.ingest_rate_limit_max_requests,
        settings.ingest_rate_limit_window_seconds,
        settings.max_ai_calls_per_batch or "unlimited",
    )

    # 3. Initialise the Hermes Pub/Sub publisher singleton (sole Pub/Sub contact point).
    initialize_pubsub_from_env()

    # 4. Initialise the Synapse Firestore persistence singleton (sole Firestore contact point).
    initialize_persistence_from_env()

    app = create_app(settings)

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=settings.port,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
