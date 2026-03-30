"""Unit tests for toolbox_py.config.load_config_yaml."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from toolbox_py import load_config_yaml


class TestLoadConfigYaml:
    """Tests for the load_config_yaml() utility function."""

    def test_sets_env_vars_from_shared_and_service(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Values from systems.shared and systems.<service> are set in os.environ."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text(
            """
systems:
  shared:
    SHARED_KEY: "shared-value"
  my-service:
    SERVICE_KEY: "service-value"
""".strip(),
            encoding="utf-8",
        )

        monkeypatch.setenv("CONFIG_FILE", str(config_file))
        monkeypatch.delenv("SHARED_KEY", raising=False)
        monkeypatch.delenv("SERVICE_KEY", raising=False)

        load_config_yaml("my-service")

        assert os.environ["SHARED_KEY"] == "shared-value"
        assert os.environ["SERVICE_KEY"] == "service-value"

    def test_does_not_override_existing_env_vars(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Variables already set in the environment are never overwritten."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text(
            """
systems:
  shared:
    EXISTING_KEY: "from-yaml"
""".strip(),
            encoding="utf-8",
        )

        monkeypatch.setenv("CONFIG_FILE", str(config_file))
        monkeypatch.setenv("EXISTING_KEY", "pre-existing")

        load_config_yaml("my-service")

        assert os.environ["EXISTING_KEY"] == "pre-existing"

    def test_service_keys_override_shared_keys(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Service-level keys take precedence over shared keys for the same name."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text(
            """
systems:
  shared:
    SOME_KEY: "shared-value"
  my-service:
    SOME_KEY: "service-override"
""".strip(),
            encoding="utf-8",
        )

        monkeypatch.setenv("CONFIG_FILE", str(config_file))
        monkeypatch.delenv("SOME_KEY", raising=False)

        load_config_yaml("my-service")

        assert os.environ["SOME_KEY"] == "service-override"

    def test_returns_silently_when_no_config_file_found(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """No error is raised when the config file does not exist."""
        monkeypatch.delenv("CONFIG_FILE", raising=False)
        # Ensure no config.yaml exists in the search paths by setting CONFIG_FILE
        # to a non-existent path — the function must not raise.
        monkeypatch.setenv("CONFIG_FILE", "/nonexistent/path/config.yaml")
        load_config_yaml("no-such-service")  # must not raise

    def test_returns_silently_when_yaml_is_malformed(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Malformed YAML causes a silent return, not an exception."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("this: is: not: valid: yaml: [", encoding="utf-8")

        monkeypatch.setenv("CONFIG_FILE", str(config_file))
        load_config_yaml("my-service")  # must not raise

    def test_returns_silently_when_yaml_root_is_not_dict(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """A YAML file whose root is a bare string/list is silently ignored."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text('"just a string"', encoding="utf-8")

        monkeypatch.setenv("CONFIG_FILE", str(config_file))
        load_config_yaml("my-service")  # must not raise

    def test_returns_silently_when_systems_key_missing(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Config without a ``systems`` key is silently ignored."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("other:\n  key: value\n", encoding="utf-8")

        monkeypatch.setenv("CONFIG_FILE", str(config_file))
        load_config_yaml("my-service")  # must not raise

    def test_handles_missing_shared_section(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Service section is still applied when ``systems.shared`` is absent."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text(
            """
systems:
  my-service:
    ONLY_SERVICE_KEY: "only-service"
""".strip(),
            encoding="utf-8",
        )

        monkeypatch.setenv("CONFIG_FILE", str(config_file))
        monkeypatch.delenv("ONLY_SERVICE_KEY", raising=False)

        load_config_yaml("my-service")

        assert os.environ["ONLY_SERVICE_KEY"] == "only-service"

    def test_handles_missing_service_section(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Shared section is still applied when the service section is absent."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text(
            """
systems:
  shared:
    ONLY_SHARED_KEY: "only-shared"
""".strip(),
            encoding="utf-8",
        )

        monkeypatch.setenv("CONFIG_FILE", str(config_file))
        monkeypatch.delenv("ONLY_SHARED_KEY", raising=False)

        load_config_yaml("other-service")

        assert os.environ["ONLY_SHARED_KEY"] == "only-shared"

    def test_numeric_values_are_stringified(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Integer and float YAML values are converted to strings in os.environ."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text(
            """
systems:
  my-service:
    PORT: 9000
    TIMEOUT: 30.5
""".strip(),
            encoding="utf-8",
        )

        monkeypatch.setenv("CONFIG_FILE", str(config_file))
        monkeypatch.delenv("PORT", raising=False)
        monkeypatch.delenv("TIMEOUT", raising=False)

        load_config_yaml("my-service")

        assert os.environ["PORT"] == "9000"
        assert os.environ["TIMEOUT"] == "30.5"

    def test_bool_values_are_stringified(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Boolean YAML values are converted to strings in os.environ."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text(
            """
systems:
  my-service:
    FEATURE_FLAG: true
""".strip(),
            encoding="utf-8",
        )

        monkeypatch.setenv("CONFIG_FILE", str(config_file))
        monkeypatch.delenv("FEATURE_FLAG", raising=False)

        load_config_yaml("my-service")

        assert os.environ["FEATURE_FLAG"] == "True"

    def test_none_values_are_skipped(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Keys with null/None YAML values are not written to os.environ."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text(
            """
systems:
  my-service:
    NULL_KEY: null
""".strip(),
            encoding="utf-8",
        )

        monkeypatch.setenv("CONFIG_FILE", str(config_file))
        monkeypatch.delenv("NULL_KEY", raising=False)

        load_config_yaml("my-service")

        assert "NULL_KEY" not in os.environ

    def test_configs_yaml_is_found_before_config_yaml(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """``configs.yaml`` takes precedence over ``config.yaml`` in the same dir."""
        configs_file = tmp_path / "configs.yaml"
        configs_file.write_text(
            """
systems:
  my-service:
    SOURCE_FILE: "configs.yaml"
""".strip(),
            encoding="utf-8",
        )
        config_file = tmp_path / "config.yaml"
        config_file.write_text(
            """
systems:
  my-service:
    SOURCE_FILE: "config.yaml"
""".strip(),
            encoding="utf-8",
        )

        monkeypatch.chdir(tmp_path)
        monkeypatch.delenv("CONFIG_FILE", raising=False)
        monkeypatch.delenv("SOURCE_FILE", raising=False)

        load_config_yaml("my-service")

        assert os.environ["SOURCE_FILE"] == "configs.yaml"
