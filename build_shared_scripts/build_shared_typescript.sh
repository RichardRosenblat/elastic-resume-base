#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

for dir in "${ROOT_DIR}"/shared/*/; do
    if [ -f "${dir}package.json" ]; then
        echo ""
        echo "Building ${dir}"
        (cd "${dir}" && npm install && npm run build)
    fi
done

echo ""
echo "All builds completed!"
