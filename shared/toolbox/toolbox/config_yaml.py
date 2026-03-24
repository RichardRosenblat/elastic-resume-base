"""Load and merge ``config.yaml`` into ``os.environ`` for Python services.

Mirrors the behaviour of the TypeScript ``loadConfigYaml`` utility so that
Python services can share the same ``config.yaml`` root configuration file as
the Node.js services.

Usage::

    from toolbox.config_yaml import load_config_yaml

    # Call once at application startup, before loading settings.
    load_config_yaml("ingestor-service")

After the call, the merged values from ``systems.shared`` and
``systems.ingestor-service`` are available in ``os.environ``.

Keys that are **already** set in the environment are **never** overridden —
shell variables, Docker ``-e`` flags, and CI secrets always take precedence.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Candidates for the config.yaml path, searched in order.
_DEFAULT_SEARCH_ORDER = [
    # 1. Explicit override via CONFIG_FILE env var.
    lambda: os.environ.get("CONFIG_FILE"),
    # 2. config.yaml in the current working directory (Docker, monorepo root).
    lambda: str(Path.cwd() / "config.yaml"),
    # 3. config.yaml one level above cwd (running from inside service directory).
    lambda: str(Path.cwd().parent / "config.yaml"),
]


def load_config_yaml(service_name: str) -> None:
    """Populate ``os.environ`` from ``config.yaml`` for the given service.

    Reads the root ``config.yaml`` file and merges:

    * ``systems.shared`` — variables shared across all services.
    * ``systems.<service_name>`` — service-specific overrides.

    Service-specific values take precedence over shared values when the same
    key appears in both sections.

    Keys that are already present in ``os.environ`` are **never** overridden
    (twelve-factor app convention).

    Args:
        service_name: The key under ``systems.<service_name>`` in config.yaml
            (e.g. ``"ingestor-service"``).

    Example:
        >>> from toolbox.config_yaml import load_config_yaml
        >>> load_config_yaml("ingestor-service")
        >>> import os
        >>> os.environ.get("GCP_PROJECT_ID")  # set from config.yaml
        'demo-elastic-resume-base'
    """
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        logger.debug(
            "PyYAML is not installed — skipping config.yaml loading.  "
            "Install it with: pip install pyyaml"
        )
        return

    config_path = _find_config_file()
    if config_path is None:
        logger.debug(
            "config.yaml not found in any candidate path — using environment as-is."
        )
        return

    try:
        with open(config_path, encoding="utf-8") as fh:
            raw: Any = yaml.safe_load(fh)
    except Exception as exc:
        logger.warning("Failed to parse config.yaml (%s): %s", config_path, exc)
        return

    if not isinstance(raw, dict):
        logger.warning("config.yaml has unexpected top-level type: %s", type(raw).__name__)
        return

    systems: Any = raw.get("systems", {})
    if not isinstance(systems, dict):
        return

    # Merge shared then service-specific values.
    merged: dict[str, str] = {}

    shared: Any = systems.get("shared", {})
    if isinstance(shared, dict):
        merged.update({str(k): str(v) for k, v in shared.items() if v is not None})

    service_section: Any = systems.get(service_name, {})
    if isinstance(service_section, dict):
        merged.update(
            {str(k): str(v) for k, v in service_section.items() if v is not None}
        )

    # Only set keys that are not already in the environment.
    applied = 0
    for key, value in merged.items():
        if key not in os.environ:
            os.environ[key] = value
            applied += 1

    logger.debug(
        "Loaded config.yaml from '%s': applied %d/%d keys for service '%s'.",
        config_path,
        applied,
        len(merged),
        service_name,
    )


def _find_config_file() -> str | None:
    """Return the path of the first existing config.yaml candidate.

    Returns:
        Absolute path string, or ``None`` if no candidate file exists.
    """
    for candidate_fn in _DEFAULT_SEARCH_ORDER:
        candidate = candidate_fn()
        if candidate and Path(candidate).is_file():
            return candidate
    return None
