@echo off
echo 📦 Captive Payment Data Backup Tool
echo ===================================
echo.
echo Options:
echo   1. Create backup
echo   2. List backups  
echo   3. Restore from backup
echo.
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo.
    echo Creating backup...
    node backup-captive-data.cjs create
) else if "%choice%"=="2" (
    echo.
    echo Listing backups...
    node backup-captive-data.cjs list
) else if "%choice%"=="3" (
    echo.
    set /p backupdir="Enter backup directory name: "
    echo Restoring from backup: %backupdir%
    node backup-captive-data.cjs restore %backupdir%
) else (
    echo Invalid choice. Please run again and select 1, 2, or 3.
)

echo.
pause