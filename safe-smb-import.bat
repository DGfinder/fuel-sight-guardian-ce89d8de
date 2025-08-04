@echo off
echo 🚀 Safe SMB Captive Payment Data Import
echo =======================================
echo.
echo ⚠️  IMPORTANT: Make sure you have run validate-smb-data.bat first!
echo.
set /p confirm="Have you validated the data and created a backup? (y/N): "

if /i not "%confirm%"=="y" (
    echo.
    echo ❌ Please run validate-smb-data.bat first, then backup-captive-data.bat
    echo.
    pause
    exit /b 1
)

echo.
echo 🔄 Starting safe import process...
echo.

node safe-smb-import.cjs

echo.
echo 📋 Next Steps:
echo   1. Restart your dev server: npm run dev
echo   2. Test: http://localhost:5173/data-centre/captive-payments
echo   3. Verify date range: Sept 1, 2023 - June 30, 2025
echo.
pause