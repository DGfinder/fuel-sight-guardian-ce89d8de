@echo off
echo Creating .env file with LYTX API configuration...

echo # LYTX API Configuration > .env
echo VITE_LYTX_API_KEY=diCeZd54DgkVzV2aPumlLG1qcZflO0GS >> .env
echo VITE_LYTX_BASE_URL=https://lytx-api.prod7.lv.lytx.com >> .env
echo. >> .env
echo # Other environment variables can be added below >> .env
echo # VITE_SUPABASE_URL=your-supabase-url >> .env
echo # VITE_SUPABASE_ANON_KEY=your-supabase-anon-key >> .env

echo.
echo ✅ .env file created successfully!
echo.
echo Contents:
type .env
echo.
echo Now run: npm i ^&^& npm run dev