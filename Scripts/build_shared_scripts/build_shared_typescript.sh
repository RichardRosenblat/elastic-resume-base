#!/usr/bin/env bash
# build_shared_typescript.sh — Install and build all TypeScript shared libraries under shared/.
#
# Usage:
#   ./build_shared_typescript.sh
#
# For each sub-directory of shared/:
#   - Iterates versioned sub-directories (v1/, v2/, …).
#   - If a <lib_lower>_ts/ subdirectory with a package.json exists inside a
#     version directory, build from that _ts directory.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

for lib_dir in "${ROOT_DIR}"/shared/*/; do
    lib_name="$(basename "${lib_dir%/}")"
    lib_name_lower="${lib_name,,}"

    for version_dir in "${lib_dir}"v*/; do
        [ -d "${version_dir}" ] || continue
        ts_dir="${version_dir}${lib_name_lower}_ts"

        if [ -d "${ts_dir}" ] && [ -f "${ts_dir}/package.json" ]; then
            echo ""
            echo "Building ${ts_dir}"
            (cd "${ts_dir}" && npm install && npm run build)
        fi
    done
done

echo ""
echo "All TypeScript builds completed!"
