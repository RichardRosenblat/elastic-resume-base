#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIREBASE_LOGS_DIR="${SCRIPT_DIR}/firebase_logs"

echo "Starting Firebase emulators..."

# Navigate to the firebase_logs directory, exit if it fails
cd "${FIREBASE_LOGS_DIR}" || { echo "Directory ${FIREBASE_LOGS_DIR} not found"; exit 1; }

# Start the emulators
firebase emulators:start