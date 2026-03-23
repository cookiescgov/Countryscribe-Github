@echo off
echo ==========================================
echo Starting County Scribe (Universal Docker)
echo ==========================================
echo Checking for Docker...
docker --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not installed or not running! Please install Docker Desktop.
    pause
    exit /b
)

echo.
echo Launching County Scribe Docker containers...
docker compose up -d --build

echo.
echo ==========================================
echo SUCCESS: County Scribe is now running in the background! 
echo Open your web browser and navigate to:
echo http://localhost:8000
echo.
echo Note: It may take a minute or two for the AI models to load on the first run.
echo ==========================================
pause
