@echo off
echo Starting Firebase emulators...

set "SCRIPT_DIR=%~dp0"

:: Navigate to the firebase_logs directory
cd /d "%SCRIPT_DIR%firebase_logs" || (
	echo Directory "%SCRIPT_DIR%firebase_logs" not found
	exit /b 1
)

:: Start the emulators
firebase emulators:start

pause