@echo off
setlocal

for /d %%d in (shared\*) do (
    if exist "%%d\package.json" (
        echo.
        echo Installing %%d
        pushd "%%d"
        call npm install
        node -e "const p=require('./package.json');if(p.scripts&&p.scripts.build){process.exit(0)}else{process.exit(1)}" 2>nul
        if not errorlevel 1 (
            echo Building %%d
            call npm run build
        ) else (
            echo No build step for %%d - skipping
        )
        popd
    )
)

echo.
echo All builds completed!
pause