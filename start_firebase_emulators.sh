#!/bin/bash

echo "Starting Firebase emulators and seeding script..."

# Get the absolute path of the directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Launch the seeding sequence in the background
# We use a subshell (...) with an ampersand & at the end to run it asynchronously.
(
    echo "[Seeder] Waiting 45 seconds for emulators to boot..."
    sleep 45
    
    cd "$SCRIPT_DIR/Scripts/emulator_scripts" || {
        echo "[Seeder] Directory not found. Exiting seeder."
        exit 1
    }
    
    # Create venv if it doesn't exist
    if [ ! -d "venv" ]; then
        echo "[Seeder] Creating virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate venv
    source venv/bin/activate
    
    # Install dependencies quietly
    echo "[Seeder] Installing dependencies..."
    pip install -q google-cloud-pubsub firebase-admin
    
    # Run the seeder
    echo "[Seeder] Running python script..."
    python3 seed_emulators.py
) &

# 2. Navigate to the firebase_logs directory
cd "$SCRIPT_DIR/firebase_logs" || {
    echo "Directory $SCRIPT_DIR/firebase_logs not found"
    exit 1
}

# 3. Start the emulators (This blocks the main terminal window)
firebase emulators:start