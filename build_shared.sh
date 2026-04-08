#!/usr/bin/env bash
echo ""
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"${SCRIPT_DIR}/Scripts/build_shared_scripts/build_shared_typescript.sh"

echo ""

echo "All builds completed!"
