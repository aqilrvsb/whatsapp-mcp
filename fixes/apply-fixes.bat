@echo off
echo WhatsApp MCP Fix Script
echo =======================
echo.

REM Apply database fix
echo Applying database fix...
echo Please enter your PostgreSQL password when prompted:
psql -U postgres -d whatsapp_mcp -f fix-campaigns-constraint.sql
if %errorlevel% equ 0 (
    echo Database fix applied successfully!
) else (
    echo Failed to apply database fix. Please check your PostgreSQL credentials.
)

echo.
echo Clearing sessions directory...
if exist ..\sessions (
    rd /s /q ..\sessions 2>nul
    mkdir ..\sessions
    echo Sessions directory cleared!
) else (
    mkdir ..\sessions
    echo Sessions directory created!
)

echo.
echo Running verification tests...
node test-fixes.js

echo.
echo Fix process completed!
echo Now restart your server with: npm start
pause
