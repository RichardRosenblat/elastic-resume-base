@echo off
:: build_shared_typescript.bat — Install and build all TypeScript shared libraries under shared\.
::
:: Usage:
::   build_shared_typescript.bat
::
:: For each sub-directory of shared\:
::   - If a <lib_lower>_ts\ subdirectory with a package.json exists (library has both
::     Python and TypeScript implementations), build from that _ts directory.
::   - Otherwise, if a package.json exists at the root of the shared lib directory
::     (TypeScript-only library such as Aegis, Bugle, Synapse), build from there.
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
for %%i in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fi"

for /d %%d in ("%ROOT_DIR%\shared\*") do (
    for %%n in ("%%d\.") do set "LIB_NAME=%%~nn"
    for /f %%l in ('powershell -Command "\"!LIB_NAME!\".ToLower()"') do set "LIB_NAME_LOWER=%%l"
    set "TS_DIR=%%d\!LIB_NAME_LOWER!_ts"

    if exist "!TS_DIR!\package.json" (
        echo.
        echo Building !TS_DIR!
        pushd "!TS_DIR!"
        call npm install
        call npm run build
        popd
    ) else if exist "%%d\package.json" (
        echo.
        echo Building %%d
        pushd "%%d"
        call npm install
        call npm run build
        popd
    )
)

echo.
echo All builds completed!
