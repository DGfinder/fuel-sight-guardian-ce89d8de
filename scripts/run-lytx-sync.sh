#!/bin/bash
# LYTX Live Sync - Unix Cron Job Script
# Add to crontab: */15 * * * * /path/to/this/script.sh

cd "$(dirname "$0")/lytx-live-sync"

# Set environment variables
export SUPABASE_URL=https://wjzsdsvbtapriiuxzmih.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenNkc3ZidGFwcmlpdXh6bWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4MDU1MiwiZXhwIjoyMDY0NzU2NTUyfQ.c6HZBGuXBz-RHXwFasOmJ8A_e0oRkt6vy-hNFDidCKo
export LYTX_API_KEY=diCeZd54DgkVzV2aPumlLG1qcZflO0GS

# Run sync with logging
echo "$(date) - Starting LYTX sync" >> sync.log
node sync.js >> sync.log 2>&1
echo "$(date) - LYTX sync completed" >> sync.log
echo "" >> sync.log