@echo off
:: build_shared_python.bat — Install Python shared libraries under shared\.
::
:: Usage:
::   build_shared_python.bat [--prod]
::
:: Options:
::   --prod   Install without the -e (editable) flag.  Default is editable mode.
::
:: For each sub-directory of shared\ that contains a <lib_lower>_py\ sub-directory
:: with a pyproject.toml, this script:
::   1. Creates (or reuses) a virtual environment in shared\<lib>\<lib_lower>_py\venv
::   2. Installs production and development dependencies
::   3. Installs the package (editable by default, non-editable with --prod)
::   4. Runs the test suite with coverage (testpaths are read from pyproject.toml)
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
for %%i in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fi"

:: Parse flags
set "EDITABLE=-e"
for %%a in (%*) do (
    if /i "%%a"=="--prod" set "EDITABLE="
)

for /d %%d in ("%ROOT_DIR%\shared\*") do (
    for %%n in ("%%d\.") do set "LIB_NAME=%%~nn"
    :: Convert to lowercase using PowerShell
    for /f %%l in ('powershell -Command "\"!LIB_NAME!\".ToLower()"') do set "LIB_NAME_LOWER=%%l"
    set "PY_DIR=%%d\!LIB_NAME_LOWER!_py"

    if exist "!PY_DIR!\pyproject.toml" (
        echo.
        echo Installing !PY_DIR!
        pushd "!PY_DIR!"

        set "VENV_DIR=venv"

        if not exist "!VENV_DIR!" (
            python -m venv "!VENV_DIR!"
        )

        call "!VENV_DIR!\Scripts\activate.bat"

        python -m pip install --quiet --upgrade pip
        if errorlevel 1 (
            echo Failed to upgrade pip for !LIB_NAME!
            popd
            exit /b 1
        )

        if exist "requirements-dev.txt" (
            python -m pip install --quiet -r requirements-dev.txt
        ) else if exist "requirements.txt" (
            python -m pip install --quiet -r requirements.txt
        )

        if "!EDITABLE!"=="-e" (
            python -m pip install --quiet -e .
        ) else (
            python -m pip install --quiet .
        )

        :: testpaths are defined in pyproject.toml — no explicit path needed here
        python -m pytest --cov --cov-report=term-missing

        call "!VENV_DIR!\Scripts\deactivate.bat"
        popd
    )
)

echo.
echo All Python installs completed!
