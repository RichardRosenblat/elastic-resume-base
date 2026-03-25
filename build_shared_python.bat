@echo off
:: build_shared_python.bat — Install and test all Python shared libraries under shared\.
::
:: Usage:
::   build_shared_python.bat
::
:: For each sub-directory of shared\ that contains a pyproject.toml, this script:
::   1. Creates (or reuses) a virtual environment in shared\<lib>\.venv
::   2. Installs production and development dependencies
::   3. Installs the package in editable mode
::   4. Runs the test suite with coverage
setlocal

for /d %%d in (shared\*) do (
    if exist "%%d\pyproject.toml" (
        echo.
        echo Building %%d
        pushd "%%d"

        if not exist ".venv" (
            python -m venv .venv
        )

        call .venv\Scripts\activate.bat

        pip install --quiet --upgrade pip

        if exist "requirements-dev.txt" (
            pip install --quiet -r requirements-dev.txt
        ) else if exist "requirements.txt" (
            pip install --quiet -r requirements.txt
        )

        pip install --quiet -e .

        pytest --cov --cov-report=term-missing

        call .venv\Scripts\deactivate.bat
        popd
    )
)

echo.
echo All Python builds completed!
pause
