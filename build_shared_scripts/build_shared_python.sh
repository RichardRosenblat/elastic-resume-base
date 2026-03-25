#!/usr/bin/env bash
# build_shared_python.sh — Install and test all Python shared libraries under shared/.
#
# Usage:
#   ./build_shared_python.sh
#
# For each sub-directory of shared/ that contains a pyproject.toml, this script:
#   1. Creates (or reuses) a virtual environment in shared/<lib>/<lib>_venv
#   2. Installs production and development dependencies
#   3. Installs the package in editable mode
#   4. Runs the test suite with coverage
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

for dir in "${ROOT_DIR}"/shared/*/; do
    if [ -f "${dir}pyproject.toml" ]; then
        echo ""
        echo "Building ${dir}"
        (
            cd "${dir}"
            LIB_NAME="$(basename "${dir}")"
            VENV_DIR="${LIB_NAME}_venv"

            # Create a virtual environment if one doesn't exist.
            if [ ! -d "${VENV_DIR}" ]; then
                if command -v python3 >/dev/null 2>&1; then
                    python3 -m venv "${VENV_DIR}"
                elif command -v python >/dev/null 2>&1; then
                    python -m venv "${VENV_DIR}"
                else
                    echo "Neither python3 nor python was found on PATH"
                    exit 1
                fi
            fi

            # Activate the venv for this sub-shell.
            # shellcheck source=/dev/null
            . "${VENV_DIR}/bin/activate"

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
