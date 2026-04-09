@echo off
echo Starting Firebase emulators and seeding script...

set "SCRIPT_DIR=%~dp0"

:: 1. Launch a new terminal window for the seeding script
:: Notice the single '&' after the if statement. This ensures activation happens even if the venv already exists.
start "Emulator Seeder (close after finished)" cmd /k "cd /d "%SCRIPT_DIR%Scripts\emulator_scripts" && timeout /t 45 && (if not exist venv python -m venv venv) & call venv\Scripts\activate && pip install google-cloud-pubsub firebase-admin && python seed_emulators.py"

:: 2. Navigate to the firebase_logs directory
cd /d "%SCRIPT_DIR%firebase_logs" || (
    echo Directory "%SCRIPT_DIR%firebase_logs" not found
    exit /b 1
)

:: 3. Start the emulators (This command blocks this original terminal window)
firebase emulators:start

pause