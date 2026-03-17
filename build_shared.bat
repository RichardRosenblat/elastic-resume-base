@echo off
setlocal

for /d %%d in (shared\*) do (
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
pause