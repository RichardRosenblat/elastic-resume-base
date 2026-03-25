#!/usr/bin/env bash
# build_shared_python.sh — Install Python shared libraries under shared/.
#
# Usage:
#   ./build_shared_python.sh [--prod]
#
# Options:
#   --prod   Install without the -e (editable) flag.  Default is editable mode.
#
# For each sub-directory of shared/ that contains a <lib_lower>_py/ sub-directory
# with a pyproject.toml, this script:
#   1. Creates (or reuses) a virtual environment in shared/<lib>/<lib_lower>_py/venv
#   2. Installs production and development dependencies
#   3. Installs the package (editable by default, non-editable with --prod)
#   4. Runs the test suite with coverage (testpaths are read from pyproject.toml)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Parse flags
EDITABLE="-e"
for arg in "$@"; do
    if [ "${arg}" = "--prod" ]; then
        EDITABLE=""
    fi
done

for lib_dir in "${ROOT_DIR}"/shared/*/; do
    lib_name="$(basename "${lib_dir%/}")"
    lib_name_lower="${lib_name,,}"
    py_dir="${lib_dir}${lib_name_lower}_py"

    if [ -d "${py_dir}" ] && [ -f "${py_dir}/pyproject.toml" ]; then
        echo ""
        echo "Installing ${py_dir}"
        (
            cd "${py_dir}"
            VENV_DIR="venv"

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

            python -m pip install --quiet --upgrade pip

            if [ -f "requirements-dev.txt" ]; then
                python -m pip install --quiet -r requirements-dev.txt
            elif [ -f "requirements.txt" ]; then
                python -m pip install --quiet -r requirements.txt
            fi

            if [ -n "${EDITABLE}" ]; then
                python -m pip install --quiet -e .
            else
                python -m pip install --quiet .
            fi

            # testpaths are defined in pyproject.toml — no explicit path needed here
            python -m pytest --cov --cov-report=term-missing
        )
    fi
done

echo ""
echo "All Python installs completed!"
