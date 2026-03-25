@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

call "%SCRIPT_DIR%build_shared_scripts\build_shared_python.bat"
call "%SCRIPT_DIR%build_shared_scripts\build_shared_typescript.bat"

echo.
echo All shared library builds completed!