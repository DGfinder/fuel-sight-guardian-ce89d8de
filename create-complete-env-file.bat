@echo off
echo Creating complete .env file with all API configurations...

echo # Supabase Configuration > .env
echo SUPABASE_URL=https://your-project.supabase.co >> .env
echo SUPABASE_ANON_KEY=your-supabase-anon-key >> .env
echo SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key >> .env
echo. >> .env

echo # LYTX API Configuration >> .env
echo VITE_LYTX_API_KEY=your-lytx-api-key >> .env
echo VITE_LYTX_BASE_URL=https://lytx-api.prod7.lv.lytx.com >> .env
echo LYTX_API_KEY=your-lytx-api-key >> .env
echo. >> .env

echo # Gasbot API Configuration >> .env
echo VITE_ATHARA_API_KEY=your-athara-api-key >> .env
echo VITE_ATHARA_API_SECRET=your-athara-api-secret >> .env
echo VITE_ATHARA_BASE_URL=https://dashboard2-production.prod.gasbot.io >> .env
echo GASBOT_WEBHOOK_SECRET=your-gasbot-webhook-secret >> .env
echo GASBOT_SYNC_SECRET=your-gasbot-sync-secret >> .env
echo. >> .env

echo # SmartFill API Configuration >> .env
echo SMARTFILL_API_URL=https://www.fmtdata.com/API/api.php >> .env
echo # Add your SmartFill API credentials below: >> .env
echo # SMARTFILL_API_REFERENCE=your-api-reference >> .env
echo # SMARTFILL_API_SECRET=your-api-secret >> .env
echo. >> .env

echo # Guardian API Configuration >> .env
echo # Add Guardian API credentials when available >> .env
echo # GUARDIAN_API_KEY=your-guardian-api-key >> .env
echo # GUARDIAN_API_SECRET=your-guardian-api-secret >> .env
echo. >> .env

echo # Vercel Configuration >> .env
echo VERCEL_URL=https://fuel-sight-guardian-ce89d8de.vercel.app >> .env
echo. >> .env

echo # Development Configuration >> .env
echo NODE_ENV=development >> .env
echo VITE_APP_ENV=development >> .env

echo.
echo ✅ Complete .env file created successfully!
echo.
echo ⚠️  IMPORTANT: You need to update the following values:
echo    - SUPABASE_URL: Your actual Supabase project URL
echo    - SUPABASE_ANON_KEY: Your Supabase anonymous key
echo    - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
echo    - SmartFill API credentials (if using SmartFill)
echo    - Guardian API credentials (if using Guardian)
echo.
echo 📋 To get your Supabase credentials:
echo    1. Go to https://supabase.com/dashboard
echo    2. Select your project
echo    3. Go to Settings > API
echo    4. Copy the URL and keys
echo.
echo Contents:
type .env
echo.
echo Now run: npm i ^&^& npm run dev 