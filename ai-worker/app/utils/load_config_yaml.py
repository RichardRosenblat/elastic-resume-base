"""Utility for loading config.yaml and merging settings into environment variables.

Mirrors the TypeScript ``loadConfigYaml.ts`` used by Node.js services.

Search order for ``config.yaml``:
1. Path in the ``CONFIG_FILE`` environment variable (explicit override).
2. ``config.yaml`` in the current working directory.
3. ``config.yaml`` one directory above the current working directory (matches
   ``python -m uvicorn`` launched from the service directory).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def load_config_yaml(service_name: str) -> None:
    """Load ``config.yaml`` and populate ``os.environ`` for *service_name*.

    Merges ``systems.shared`` and ``systems.<service_name>`` from the YAML
    file, with service-specific values overriding shared ones.  Keys already
    present in ``os.environ`` are **never** overridden so that Docker / CI
    environment variables always take precedence.

    If the file cannot be found or parsed the function returns silently,
    allowing the service to fall back to whatever ``os.environ`` already
    contains.

    Args:
        service_name: Key under ``systems.<service_name>`` in ``config.yaml``
            (e.g. ``"ai-worker"``).
    """
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        logger.debug("PyYAML not installed; skipping config.yaml loading.")
        return

    candidates = [
        os.environ.get("CONFIG_FILE"),
        str(Path.cwd() / "config.yaml"),
        str(Path.cwd().parent / "config.yaml"),
    ]
    config_path = next(
        (p for p in candidates if p and Path(p).exists()),
        None,
    )
    if config_path is None:
        logger.debug("config.yaml not found; using existing environment variables.")
        return

    try:
        with open(config_path, encoding="utf-8") as fh:
            raw = yaml.safe_load(fh)

        if not isinstance(raw, dict):
            return

        systems = raw.get("systems", {})
        if not isinstance(systems, dict):
            return

        merged: dict[str, object] = {
            **systems.get("shared", {}),
            **systems.get(service_name, {}),
        }

        for key, value in merged.items():
            if os.environ.get(key) is None and value is not None:
                os.environ[key] = str(value)

        logger.debug(
            "Loaded config.yaml for service '%s' from %s", service_name, config_path
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Failed to load config.yaml from '%s': %s", config_path, exc
        )
