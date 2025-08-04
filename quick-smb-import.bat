@echo off
echo 🚀 Quick SMB Import (All Steps)
echo ==============================
echo.
echo This will run all steps automatically:
echo   1. Validate data
echo   2. Create backup  
echo   3. Import data
echo.
set /p confirm="Continue with full import process? (y/N): "

if /i not "%confirm%"=="y" (
    echo Import cancelled.
    pause
    exit /b 1
)

echo.
echo 📋 Step 1/3: Validating data...
echo ================================
node validate-smb-data-import.cjs
if errorlevel 1 (
    echo.
    echo ❌ Validation failed! Import cancelled.
    pause
    exit /b 1
)

echo.
echo 📋 Step 2/3: Creating backup...
echo ===============================
node backup-captive-data.cjs create
if errorlevel 1 (
    echo.
    echo ❌ Backup failed! Import cancelled.
    pause
    exit /b 1
)

echo.
echo 📋 Step 3/3: Importing data...
echo ==============================
node safe-smb-import.cjs
if errorlevel 1 (
    echo.
    echo ❌ Import failed! Check output above for details.
    pause
    exit /b 1
)

echo.
echo 🎉 IMPORT COMPLETED SUCCESSFULLY!
echo.
echo 📋 Next Steps:
echo   1. Restart your dev server: npm run dev
echo   2. Test: http://localhost:5173/data-centre/captive-payments
echo   3. Verify date range: Sept 1, 2023 - June 30, 2025
echo.
pause