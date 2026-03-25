@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%i in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fi"

for /d %%d in ("%ROOT_DIR%\shared\*") do (
    if exist "%%d\package.json" (
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