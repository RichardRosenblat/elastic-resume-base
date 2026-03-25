#!/usr/bin/env bash
# build_shared_python.sh — Install and test all Python shared libraries under shared/.
#
# Usage:
#   ./build_shared_python.sh
#
# For each sub-directory of shared/ that contains a pyproject.toml, this script:
#   1. Creates (or reuses) a virtual environment in shared/<lib>/.venv
#   2. Installs production and development dependencies
#   3. Installs the package in editable mode
#   4. Runs the test suite with coverage
set -euo pipefail

for dir in shared/*/; do
    if [ -f "${dir}pyproject.toml" ]; then
        echo ""
        echo "Building ${dir}"
        (
            cd "${dir}"

            # Create a virtual environment if one doesn't exist.
            if [ ! -d ".venv" ]; then
                python3 -m venv .venv
            fi

            # Activate the venv for this sub-shell.
            # shellcheck source=/dev/null
            . .venv/bin/activate

            pip install --quiet --upgrade pip

            if [ -f "requirements-dev.txt" ]; then
                pip install --quiet -r requirements-dev.txt
            elif [ -f "requirements.txt" ]; then
                pip install --quiet -r requirements.txt
            fi

            pip install --quiet -e .

            pytest tests/ --cov --cov-report=term-missing
        )
    fi
done

echo ""
echo "All Python builds completed!"
