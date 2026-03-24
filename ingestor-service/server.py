"""Entry-point for the Ingestor Service.

Reads configuration from the environment, initialises Hermes (Pub/Sub), and
starts the Uvicorn HTTP server.
"""

from __future__ import annotations

import os

from toolbox import setup_logging

# Initialise structured logging before importing anything else.
setup_logging(
    level=os.environ.get("LOG_LEVEL", "info"),
    json_format=os.environ.get("LOG_FORMAT", "text").lower() == "json",
)

from toolbox import get_logger  # noqa: E402 — must come after setup_logging

logger = get_logger(__name__)

import uvicorn  # noqa: E402

from hermes import initialize_pubsub_from_env  # noqa: E402

from app.config import load_settings  # noqa: E402
from app.main import create_app  # noqa: E402


def main() -> None:
    """Load configuration, initialise dependencies, and start the server."""
    settings = load_settings()

    logger.info(
        "Ingestor Service starting: port=%d, project=%s.",
        settings.port,
        settings.gcp_project_id,
    )

    # Initialise the Hermes event publisher singleton before the app starts.
    initialize_pubsub_from_env()

    app = create_app(settings)

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=settings.port,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
