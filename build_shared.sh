#!/usr/bin/env bash
set -euo pipefail

for dir in shared/*/; do
    if [ -f "${dir}package.json" ]; then
        echo ""
        echo "Building ${dir}"
        (cd "${dir}" && npm install && npm run build)
    fi
done

echo ""
echo "All builds completed!"
