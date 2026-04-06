@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

call "%SCRIPT_DIR%\Scripts\build_shared_scripts\build_shared_typescript.bat"

echo.
echo All shared library builds completed!