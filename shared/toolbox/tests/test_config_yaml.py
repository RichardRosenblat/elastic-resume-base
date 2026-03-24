"""Unit tests for load_config_yaml."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
import yaml

from toolbox.config_yaml import load_config_yaml


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Remove test keys from os.environ before and after every test."""
    keys_to_clean = ["TEST_SHARED_KEY", "TEST_SERVICE_KEY", "CONFIG_FILE", "OVERRIDE_ME"]
    for key in keys_to_clean:
        monkeypatch.delenv(key, raising=False)
    yield
    for key in keys_to_clean:
        monkeypatch.delenv(key, raising=False)


def _write_config(tmp_path: Path, content: dict) -> Path:
    """Write a config.yaml to tmp_path and return its path."""
    p = tmp_path / "config.yaml"
    p.write_text(yaml.dump(content), encoding="utf-8")
    return p


class TestLoadConfigYaml:
    """Tests for load_config_yaml()."""

    def test_sets_shared_keys(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Keys from systems.shared are set in os.environ."""
        cfg = _write_config(
            tmp_path,
            {"systems": {"shared": {"TEST_SHARED_KEY": "shared-value"}}},
        )
        monkeypatch.setenv("CONFIG_FILE", str(cfg))
        load_config_yaml("my-service")
        assert os.environ.get("TEST_SHARED_KEY") == "shared-value"

    def test_sets_service_specific_keys(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Keys from the service section are set in os.environ."""
        cfg = _write_config(
            tmp_path,
            {"systems": {"my-service": {"TEST_SERVICE_KEY": "svc-value"}}},
        )
        monkeypatch.setenv("CONFIG_FILE", str(cfg))
        load_config_yaml("my-service")
        assert os.environ.get("TEST_SERVICE_KEY") == "svc-value"

    def test_service_key_overrides_shared_key(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A service-specific key overrides the same key from shared."""
        cfg = _write_config(
            tmp_path,
            {
                "systems": {
                    "shared": {"TEST_SHARED_KEY": "shared-value"},
                    "my-service": {"TEST_SHARED_KEY": "service-override"},
                }
            },
        )
        monkeypatch.setenv("CONFIG_FILE", str(cfg))
        load_config_yaml("my-service")
        assert os.environ.get("TEST_SHARED_KEY") == "service-override"

    def test_existing_env_vars_are_not_overridden(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Keys already in os.environ are never overwritten."""
        monkeypatch.setenv("OVERRIDE_ME", "already-set")
        cfg = _write_config(
            tmp_path,
            {"systems": {"shared": {"OVERRIDE_ME": "from-config"}}},
        )
        monkeypatch.setenv("CONFIG_FILE", str(cfg))
        load_config_yaml("my-service")
        assert os.environ.get("OVERRIDE_ME") == "already-set"

    def test_missing_config_file_is_silent(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """If config.yaml is not found, load_config_yaml does not raise."""
        monkeypatch.setenv("CONFIG_FILE", "/nonexistent/config.yaml")
        load_config_yaml("my-service")  # should not raise

    def test_missing_service_section_is_silent(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """If the service section is missing, shared keys are still applied."""
        cfg = _write_config(
            tmp_path,
            {"systems": {"shared": {"TEST_SHARED_KEY": "shared-value"}}},
        )
        monkeypatch.setenv("CONFIG_FILE", str(cfg))
        load_config_yaml("nonexistent-service")
        assert os.environ.get("TEST_SHARED_KEY") == "shared-value"

    def test_empty_config_is_silent(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """An empty config.yaml file does not raise."""
        cfg = tmp_path / "config.yaml"
        cfg.write_text("", encoding="utf-8")
        monkeypatch.setenv("CONFIG_FILE", str(cfg))
        load_config_yaml("my-service")  # should not raise

    def test_integer_values_are_coerced_to_strings(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Numeric config values are stored as strings in os.environ."""
        cfg = _write_config(
            tmp_path,
            {"systems": {"shared": {"PORT": 8001}}},
        )
        monkeypatch.setenv("CONFIG_FILE", str(cfg))
        load_config_yaml("my-service")
        assert os.environ.get("PORT") == "8001"
