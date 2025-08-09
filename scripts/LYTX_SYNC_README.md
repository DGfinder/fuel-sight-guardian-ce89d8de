# LYTX Live Sync Setup Guide

## Overview
The LYTX live sync system polls the LYTX VIDEO API every 15 minutes and upserts safety events into the Supabase database. This enables real-time safety event monitoring in the Fuel Sight Guardian dashboard.

## Setup Complete ✅
- ✅ Environment variables configured
- ✅ API connectivity tested (51,156+ events available)
- ✅ Database schema ready
- ✅ Initial sync completed (100 events processed successfully)
- ✅ Dashboard integration verified

## Files Created
```
scripts/
├── lytx-live-sync/          # Main sync script directory
│   ├── sync.js              # Node.js sync script
│   ├── package.json         # Dependencies
│   └── node_modules/        # Installed packages
├── run-lytx-sync.bat        # Windows automation script
├── run-lytx-sync.sh         # Unix automation script (executable)
└── LYTX_SYNC_README.md      # This file
```

## Manual Sync
To run a one-time sync manually:

### Windows (PowerShell)
```powershell
cd scripts\lytx-live-sync
$env:SUPABASE_URL="https://wjzsdsvbtapriiuxzmih.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="[service_key]"
$env:LYTX_API_KEY="diCeZd54DgkVzV2aPumlLG1qcZflO0GS"
node sync.js
```

### Unix/Linux
```bash
cd scripts/lytx-live-sync
export SUPABASE_URL=https://wjzsdsvbtapriiuxzmih.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=[service_key]
export LYTX_API_KEY=diCeZd54DgkVzV2aPumlLG1qcZflO0GS
node sync.js
```

## Automated Scheduling

### Windows Task Scheduler
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Every 15 minutes
4. Set action: Start a program
5. Program: `C:\path\to\scripts\run-lytx-sync.bat`

### Unix Cron Job
Add to crontab (`crontab -e`):
```bash
*/15 * * * * /path/to/scripts/run-lytx-sync.sh
```

## Monitoring
- Sync logs are written to `scripts/lytx-live-sync/sync.log`
- Successful runs show: `processed=X failed=0`
- Dashboard shows recent events at: http://localhost:5174/lytx-dashboard

## Data Flow
```
LYTX VIDEO API → sync.js → Supabase (lytx_safety_events) → Dashboard
```

## API Status Mapping
| LYTX API Status | Database Status | Description |
|----------------|----------------|-------------|
| 1 (New)        | New            | Unreviewed event |
| 7 (Reviewed)   | Resolved       | Completed review |
| 2 (In Review)  | FYI Notify     | Under review |
| 3 (Coaching)   | Face-To-Face   | Coaching complete |

## Database Table: `lytx_safety_events`
Key fields populated:
- `event_id` - Unique LYTX event identifier
- `vehicle_registration` - Vehicle ID from LYTX
- `driver_name` - Driver first/last name
- `event_datetime` - When the event occurred
- `status` - Review status
- `trigger` - Event trigger type
- `behaviors` - Observed behaviors
- `raw_data` - Complete API response (JSONB)

## Current Status
- **Last Sync**: 100 events processed successfully
- **API Connection**: ✅ Working (51,156+ events available)
- **Database**: ✅ Ready
- **Dashboard**: ✅ Available at http://localhost:5174
- **Automation Scripts**: ✅ Created and ready for scheduling

## Next Steps
1. Set up automated scheduling (Windows Task Scheduler or cron)
2. Monitor sync logs for any issues
3. Access dashboard to view live safety events