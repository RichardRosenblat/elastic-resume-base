#!/bin/bash
echo "Starting Firebase emulators..."

# Navigate to the firebase_logs directory, exit if it fails
cd ./firebase_logs || { echo "Directory ./firebase_logs not found"; exit 1; }

# Start the emulators
firebase emulators:start