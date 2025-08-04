@echo off
echo 🔍 SMB Captive Payment Data Validation
echo =====================================
echo.

node validate-smb-data-import.cjs

echo.
echo ✅ Validation completed. Review the output above.
echo.
echo If validation PASSED:
echo   - Run: safe-smb-import.bat
echo.
echo If validation FAILED:
echo   - DO NOT proceed with import
echo   - Check the new data file for issues
echo.
pause