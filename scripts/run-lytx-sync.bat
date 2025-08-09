@echo off
REM LYTX Live Sync - Windows Task Scheduler Script
REM Run this script every 5-15 minutes via Windows Task Scheduler

cd /d "C:\Users\Hayden\Downloads\fuel-sight-guardian-ce89d8de\scripts\lytx-live-sync"

REM Set environment variables
set SUPABASE_URL=https://wjzsdsvbtapriiuxzmih.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo
set LYTX_API_KEY=diCeZd54DgkVzV2aPumlLG1qcZflO0GS

REM Run sync with logging
echo %date% %time% - Starting LYTX sync >> sync.log
node sync.js >> sync.log 2>&1
echo %date% %time% - LYTX sync completed >> sync.log
echo. >> sync.log