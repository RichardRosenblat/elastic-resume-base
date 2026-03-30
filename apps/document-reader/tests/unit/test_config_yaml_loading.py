import os

from toolbox_py import load_config_yaml


def test_loads_systems_shared_and_service_from_configs_yaml(tmp_path, monkeypatch):
    config_file = tmp_path / "configs.yaml"
    config_file.write_text(
        """
systems:
  shared:
    GCP_PROJECT_ID: shared-project
    LOG_LEVEL: warning
  document-reader:
    PORT: "9000"
    GCP_PROJECT_ID: service-project
""".strip(),
        encoding="utf-8",
    )

    monkeypatch.setenv("CONFIG_FILE", str(config_file))
    monkeypatch.delenv("GCP_PROJECT_ID", raising=False)
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    monkeypatch.delenv("PORT", raising=False)

    load_config_yaml("document-reader")

    assert os.environ["GCP_PROJECT_ID"] == "service-project"
    assert os.environ["LOG_LEVEL"] == "warning"
    assert os.environ["PORT"] == "9000"


def test_does_not_override_existing_environment_variables(tmp_path, monkeypatch):
    config_file = tmp_path / "configs.yaml"
    config_file.write_text(
        """
systems:
  shared:
    LOG_LEVEL: info
  document-reader:
    LOG_LEVEL: debug
""".strip(),
        encoding="utf-8",
    )

    monkeypatch.setenv("CONFIG_FILE", str(config_file))
    monkeypatch.setenv("LOG_LEVEL", "error")

    load_config_yaml("document-reader")

    assert os.environ["LOG_LEVEL"] == "error"
