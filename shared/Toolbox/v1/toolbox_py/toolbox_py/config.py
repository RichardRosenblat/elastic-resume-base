"""YAML configuration loader for Elastic Resume Base Python services.

Provides :func:`load_config_yaml` which reads the monorepo ``config.yaml``
(or ``configs.yaml``) file and seeds ``os.environ`` with values from
``systems.shared`` and ``systems.<service_name>`` before application settings
are parsed from environment variables.

This mirrors the TypeScript ``loadConfigYaml`` exported from the shared
Toolbox so that all services, regardless of implementation language, share
the same config-loading strategy.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

try:
    import yaml as _yaml
except ImportError:  # pragma: no cover - handled gracefully when dependency missing
    _yaml = None  # type: ignore[assignment]


def _config_file_candidates(depth: int = 2) -> list[Path]:
    """Return candidate YAML config paths in priority order.

    Search order:
    1. Path in the ``CONFIG_FILE`` environment variable (explicit override).
    2. ``configs.yaml`` / ``config.yaml`` in the current working directory.
    3. ``configs.yaml`` / ``config.yaml`` in each parent directory up to
       ``depth`` levels above the current working directory.

    Args:
        depth: Number of parent directories to traverse upwards when searching
            for a config file (default ``2``).
    """
    cwd = Path.cwd()

    candidates: list[Path] = []
    explicit = os.environ.get("CONFIG_FILE")
    if explicit:
        candidates.append(Path(explicit))

    candidates.extend([cwd / "configs.yaml", cwd / "config.yaml"])

    current = cwd
    for _ in range(depth):
        current = current.parent
        candidates.extend([current / "configs.yaml", current / "config.yaml"])

    # De-duplicate while preserving order.
    seen: set[Path] = set()
    unique: list[Path] = []
    for path in candidates:
        if path not in seen:
            unique.append(path)
            seen.add(path)
    return unique


def load_config_yaml(service_name: str, depth: int = 2) -> None:
    """Seed ``os.environ`` from the monorepo YAML config file.

    Loads the first config file found in the candidate search order and merges
    ``systems.shared`` with ``systems.<service_name>``, setting any environment
    variable that is not already present in ``os.environ``.  Variables already
    set by the shell, Docker, or a CI harness always take precedence.

    If no config file is found, or if the file cannot be parsed, the function
    returns silently so the service can fall back to its existing environment.

    Only scalar values (strings, numbers, booleans) are written to
    ``os.environ``; ``None`` values and nested mappings are ignored.

    Search order:

    1. Path in the ``CONFIG_FILE`` environment variable (explicit override).
    2. ``configs.yaml`` / ``config.yaml`` in the current working directory.
    3. ``configs.yaml`` / ``config.yaml`` in each parent directory up to
       ``depth`` levels above the current working directory.

    Args:
        service_name: Key under ``systems.<service_name>`` in the YAML config
            (e.g. ``"document-reader"``).
        depth: Number of parent directories to traverse upwards when searching
            for a config file (default ``2``).

    Example::

        from toolbox_py import load_config_yaml

        # Call before reading environment variables / instantiating settings.
        load_config_yaml("document-reader")
    """
    if _yaml is None:
        return

    config_path = next((p for p in _config_file_candidates(depth) if p.exists()), None)
    if config_path is None:
        return

    try:
        raw = _yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except Exception:
        # Malformed or unreadable YAML — fall through to existing env values.
        return

    if not isinstance(raw, dict):
        return

    systems = cast("dict[str, Any]", raw).get("systems")
    if not isinstance(systems, dict):
        return

    systems_dict = cast("dict[str, Any]", systems)
    merged: dict[str, Any] = {}
    shared = systems_dict.get("shared")
    service = systems_dict.get(service_name)

    if isinstance(shared, dict):
        merged.update(cast("dict[str, Any]", shared))
    if isinstance(service, dict):
        merged.update(cast("dict[str, Any]", service))

    for key, value in merged.items():
        if value is None:
            continue
        if isinstance(value, (int, float, bool)):
            os.environ.setdefault(key, str(value))
        elif isinstance(value, str):
            os.environ.setdefault(key, value)
