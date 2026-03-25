@echo off
:: build_shared_python.bat — Install and test all Python shared libraries under shared\.
::
:: Usage:
::   build_shared_python.bat
::
:: For each sub-directory of shared\ that contains a pyproject.toml, this script:
::   1. Creates (or reuses) a virtual environment in shared\<lib>\<lib_lower>_py\venv
::   2. Installs production and development dependencies
::   3. Installs the package in editable mode
::   4. Runs the test suite with coverage (testpaths are read from pyproject.toml)
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
for %%i in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fi"

for /d %%d in ("%ROOT_DIR%\shared\*") do (
    if exist "%%d\pyproject.toml" (
        echo.
        echo Building %%d
        pushd "%%d"

        for %%n in ("%%d\.") do set "LIB_NAME=%%~nn"
        :: Convert to lowercase using PowerShell
        for /f %%l in ('powershell -Command "\"!LIB_NAME!\".ToLower()"') do set "LIB_NAME_LOWER=%%l"
        set "VENV_DIR=!LIB_NAME_LOWER!_py\venv"

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

        python -m pip install --quiet -e .

        :: testpaths are defined in pyproject.toml — no explicit path needed here
        python -m pytest --cov --cov-report=term-missing

        call "!VENV_DIR!\Scripts\deactivate.bat"
        popd
    )
)

echo.
echo All Python builds completed!
