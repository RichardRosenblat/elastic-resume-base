#!/usr/bin/env python3
"""
Generate per-service .env files from config.yaml.

Usage:
    python3 scripts/setup-env.py [--config PATH]

Reads the nested YAML at config.yaml (or the path given with --config) and
writes a flat KEY=value .env file for each service found under
systems.<service-name>/.env.

Variables under systems.shared are merged into every service file as the base
layer; service-specific values take precedence when the same key appears in
both sections.

Run this script once after copying config_example.yaml → config.yaml and
filling in your values.  Re-run it any time you edit config.yaml.

The generated .env files are git-ignored.  They are consumed by Docker Compose
via the env_file directive in docker-compose.yml.
"""

import argparse
import os
import sys

try:
    import yaml
except ImportError:
    print("Error: PyYAML is not installed.")
    print("  Install it with:  pip install pyyaml")
    sys.exit(1)


def write_env_file(path: str, env_vars: dict) -> None:
    """Write a flat KEY=value .env file from a dictionary."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="\n") as fh:
        for key, value in env_vars.items():
            str_value = "" if value is None else str(value)
            fh.write(f"{key}={str_value}\n")
    print(f"  \u2713 {path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate per-service .env files from config.yaml.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--config",
        default=None,
        metavar="PATH",
        help="Path to config.yaml (default: <repo-root>/config.yaml)",
    )
    args = parser.parse_args()

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    config_path = args.config or os.path.join(repo_root, "config.yaml")

    if not os.path.exists(config_path):
        example = os.path.join(repo_root, "config_example.yaml")
        print(f"Error: '{config_path}' not found.")
        print("  Create it from the example template and fill in your values:")
        print(f"    cp {example} {config_path}")
        sys.exit(1)

    with open(config_path) as fh:
        config = yaml.safe_load(fh)

    if not isinstance(config, dict) or "systems" not in config:
        print("Error: config.yaml must contain a top-level 'systems' key.")
        sys.exit(1)

    systems: dict = config["systems"] or {}
    shared: dict = dict(systems.get("shared") or {})

    print(f"Reading config from: {config_path}")
    print("Generating per-service .env files …\n")

    generated = 0
    for service_name, service_vars in systems.items():
        if service_name == "shared":
            continue
        # Merge: shared is the base; service-specific values take precedence.
        merged: dict = {**shared, **(dict(service_vars) if service_vars else {})}
        env_path = os.path.join(repo_root, service_name, ".env")
        write_env_file(env_path, merged)
        generated += 1

    print(f"\nDone — {generated} service .env file(s) written.")
    print("You can now run:  docker compose up")


if __name__ == "__main__":
    main()
