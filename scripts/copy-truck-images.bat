@echo off
echo 🚛 Copying truck images for TankAlert login page...

REM Create trucks directory if it doesn't exist
if not exist "src\assets\trucks" mkdir "src\assets\trucks"

REM Source paths - update these to match your actual file locations
set "SOURCE_1=D:\2 trip\Tuesday\DSCF1800.JPG"
set "SOURCE_2=D:\1 trip\Tuesday Moora\DSCF0948.JPG"
set "SOURCE_3=D:\1 trip\Geralton T-F\DSCF1320.JPG"

REM Destination directory
set "DEST_DIR=src\assets\trucks"

echo 📁 Copying images to project folder...

REM Copy and rename images
if exist "%SOURCE_1%" (
    copy "%SOURCE_1%" "%DEST_DIR%\truck-1.jpg"
    echo ✅ Copied truck-1.jpg
) else (
    echo ⚠️  Could not find %SOURCE_1%
    echo Please manually copy to %DEST_DIR%\truck-1.jpg
)

if exist "%SOURCE_2%" (
    copy "%SOURCE_2%" "%DEST_DIR%\truck-2.jpg"
    echo ✅ Copied truck-2.jpg
) else (
    echo ⚠️  Could not find %SOURCE_2%
    echo Please manually copy to %DEST_DIR%\truck-2.jpg
)

if exist "%SOURCE_3%" (
    copy "%SOURCE_3%" "%DEST_DIR%\truck-3.jpg"
    echo ✅ Copied truck-3.jpg
) else (
    echo ⚠️  Could not find %SOURCE_3%
    echo Please manually copy to %DEST_DIR%\truck-3.jpg
)

echo.
echo 📊 Current files in trucks folder:
dir "%DEST_DIR%" /b

echo.
echo 🔄 Image Optimization Recommendations:
echo 1. Consider using an online tool like squoosh.app to convert to WebP
echo 2. Resize images to 1920x1080 for optimal display
echo 3. Target file size under 200KB per image
echo.
echo 🚀 Next Steps:
echo 1. Run the application to see your truck images on the login page
echo 2. If images are too large, optimize them using online tools
echo 3. Consider converting to WebP format for better performance
echo.
pause