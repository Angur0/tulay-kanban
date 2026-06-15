@echo off
setlocal EnableDelayedExpansion

:: ---------------------------------------------------------------------------
:: Tulay Kanban - Windows Launch Script
:: Opens port 5173 in Windows Firewall, starts backend + frontend,
:: and cleans up firewall rule on exit.
:: Run as Administrator (required for netsh firewall commands).
:: ---------------------------------------------------------------------------

set "ROOT_DIR=%~dp0.."
set "VENV_ACTIVATE=%ROOT_DIR%\venv\Scripts\activate.bat"
set "FRONTEND_DIR=%ROOT_DIR%\frontend"
set "FIREWALL_RULE=Tulay Kanban Dev"

:: ── Prerequisite checks ────────────────────────────────────────────────────

where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: python is required but was not found in PATH.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is required but was not found in PATH.
    pause
    exit /b 1
)

if not exist "%VENV_ACTIVATE%" (
    echo ERROR: venv\Scripts\activate.bat not found.
    echo        Create the project virtual environment first:
    echo          python -m venv venv
    echo          venv\Scripts\activate
    echo          pip install -r requirements.txt
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\node_modules" (
    echo ERROR: frontend\node_modules not found.
    echo        Run: cd frontend ^&^& npm install
    pause
    exit /b 1
)

:: ── Open firewall port ─────────────────────────────────────────────────────

echo Opening Windows Firewall port 5173 for local network access...
netsh advfirewall firewall add rule ^
    name="%FIREWALL_RULE%" ^
    dir=in ^
    action=allow ^
    protocol=tcp ^
    localport=5173 >nul 2>&1

:: ── Start backend ──────────────────────────────────────────────────────────

echo Starting Tulay Kanban backend on http://localhost:8000 ...
start "Tulay Backend" /D "%ROOT_DIR%" cmd /k ^
    "call venv\Scripts\activate.bat && python main.py"

:: Give the backend a moment to bind before Vite starts
timeout /t 3 /nobreak >nul

:: ── Start frontend ─────────────────────────────────────────────────────────

echo Starting Tulay Kanban frontend on http://localhost:5173 ...
start "Tulay Frontend" /D "%FRONTEND_DIR%" cmd /k ^
    "npm run dev -- --host 0.0.0.0"

:: ── Wait and cleanup ───────────────────────────────────────────────────────

echo.
echo Both servers are running in separate windows.
echo Close those windows (or press Ctrl+C here) to stop.
echo.
echo Press any key to remove the firewall rule and exit...
pause >nul

:cleanup
echo Removing firewall rule "%FIREWALL_RULE%"...
netsh advfirewall firewall delete rule name="%FIREWALL_RULE%" >nul 2>&1

echo Done.
endlocal
