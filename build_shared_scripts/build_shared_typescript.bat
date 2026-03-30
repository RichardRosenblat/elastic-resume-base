@echo off
:: build_shared_typescript.bat — Install and build all TypeScript shared libraries under shared\.
::
:: Usage:
::   build_shared_typescript.bat
::
:: For each sub-directory of shared\:
::   - Iterates versioned sub-directories (v1\, v2\, …).
::   - If a <lib_lower>_ts\ subdirectory with a package.json exists inside a
::     version directory, build from that _ts directory.
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
for %%i in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fi"

for /d %%d in ("%ROOT_DIR%\shared\*") do (
    for %%n in ("%%d\.") do set "LIB_NAME=%%~nn"
    for /f %%l in ('powershell -Command "\"!LIB_NAME!\".ToLower()"') do set "LIB_NAME_LOWER=%%l"

    for /d %%v in ("%%d\v*") do (
        set "TS_DIR=%%v\!LIB_NAME_LOWER!_ts"

        if exist "!TS_DIR!\package.json" (
            echo.
            echo Building !TS_DIR!
            pushd "!TS_DIR!"
            call npm install
            call npm run build
            popd
        )
    )
)

echo.
echo All TypeScript builds completed!
