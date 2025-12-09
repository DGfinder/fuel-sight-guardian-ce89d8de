# Kalgoorlie Dip Webhook - Implementation Guide

## Overview

This webhook receives manual tank dip readings from Power Automate (SharePoint Excel) and automatically updates the Fuel Sight Guardian database.

**Endpoint:** `POST /api/kalgoorlie-dip-webhook`

**Authentication:** API Key via `X-API-Key` header

## Architecture

```
Excel (SharePoint) → Power Automate → Webhook API → Supabase
                                           ↓
                              ┌────────────┴────────────┐
                              ↓                         ↓
                        ta_tank_dips              ta_tanks
                        (new reading)         (update current_level)
                              ↓
                        Check alerts → Notifications (if low)
```

## Components

### 1. **KalgoorlieTankMatcher** (`api/services/KalgoorlieTankMatcher.ts`)
Maps Excel tank names to database tank IDs with fuzzy matching support.

**Mappings:**
- `MILLENNIUM STHP` → Millennium STHP
- `KUNDANA Gen 1` → Mil KUNDANA Gen 1 (90,000L capacity)
- `KUNDANA Gen 2` → Mil KUNDANA Gen 2 (65,000L capacity)
- `RHP/RUBICON SURFACE` → RUBICON SURFACE
- `RALEIGH SURFACE` → RALEIGH SURFACE
- `MLG Kundana` → MLG Kundana
- `Paradigm O/P` → Paradigm O/P

### 2. **DipRecordingService** (`api/services/DipRecordingService.ts`)
Handles dip validation, recording, and alert generation.

**Features:**
- Validates dip values (must be > 0 and < tank capacity)
- Inserts into `ta_tank_dips` table
- Updates `ta_tanks.current_level_liters`
- Automatically triggers low fuel/critical alerts
- Returns detailed results per tank

### 3. **Webhook Endpoint** (`api/kalgoorlie-dip-webhook.ts`)
Main API endpoint for receiving dip readings.

**Features:**
- API key authentication
- Batch processing of multiple tanks
- Detailed response with success/failure per tank
- Summary statistics

## Database Changes

### Migration: `fix_kundana_tank_capacities`
Fixed swapped capacities for KUNDANA Gen 1 and Gen 2:
- **Gen 1:** 65,000L → 90,000L ✅
- **Gen 2:** 90,000L → 65,000L ✅

## API Usage

### Request Format

```json
POST /api/kalgoorlie-dip-webhook
Headers:
  Content-Type: application/json
  X-API-Key: kalgoorlie-dip-2025

Body:
{
  "dips": [
    { "tank_name": "MILLENNIUM STHP", "dip_value": 42342, "dip_date": "2025-12-09" },
    { "tank_name": "KUNDANA Gen 1", "dip_value": 87867, "dip_date": "2025-12-09" },
    { "tank_name": "KUNDANA Gen 2", "dip_value": 13855, "dip_date": "2025-12-09" }
  ]
}
```

### Response Format

```json
{
  "success": true,
  "summary": {
    "total": 7,
    "successful": 7,
    "failed": 0,
    "alerts_triggered": 2
  },
  "results": [
    {
      "tank_name": "MILLENNIUM STHP",
      "success": true,
      "tankId": "8b5ed106-5e1a-4a9c-8c5e-975f9fce459a",
      "tankName": "Millennium STHP",
      "levelPercentage": 65.3,
      "alertsTriggered": []
    },
    {
      "tank_name": "KUNDANA Gen 2",
      "success": true,
      "tankId": "df804603-fcad-4e4f-be4c-f530817b5b5f",
      "tankName": "Mil KUNDANA Gen 2",
      "levelPercentage": 21.3,
      "alertsTriggered": ["low_fuel"]
    }
  ],
  "timestamp": "2025-12-09T08:30:00.000Z"
}
```

### Error Responses

**401 Unauthorized:**
```json
{
  "error": "Unauthorized. Invalid API key."
}
```

**400 Bad Request:**
```json
{
  "error": "Invalid payload. Expected { dips: [...] }"
}
```

**Per-tank errors:**
```json
{
  "tank_name": "Unknown Tank",
  "success": false,
  "error": "Tank not found in mapping: \"Unknown Tank\""
}
```

## Testing

### Option 1: PowerShell (Windows)
```powershell
.\test-kalgoorlie-webhook.ps1
```

### Option 2: Bash (Unix/Mac)
```bash
./test-kalgoorlie-webhook.sh
```

### Option 3: Manual curl
```bash
curl -X POST https://fuel-sight-guardian-ce89d8de.vercel.app/api/kalgoorlie-dip-webhook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: kalgoorlie-dip-2025" \
  -d '{
    "dips": [
      { "tank_name": "MILLENNIUM STHP", "dip_value": 42342, "dip_date": "2025-12-09" }
    ]
  }'
```

## Power Automate Setup

### Prerequisites
- Access to Power Automate (https://make.powerautomate.com)
- SharePoint access to the Excel file
- Excel file must be in a SharePoint document library

### Flow Configuration

1. **Trigger:** Recurrence (Daily at 5pm Perth time)
   - Interval: 1
   - Frequency: Day
   - At these hours: 17
   - Time zone: (UTC+08:00) Perth

2. **List rows:** Excel Online (Business) → List rows present in a table
   - Location: Your SharePoint site
   - Document Library: Documents
   - File: /path/to/Kalgoorlie Dips.xlsx
   - Table: Table1

3. **Compose:** Build JSON payload
   ```javascript
   {
     "dips": [
       {
         "tank_name": "MILLENNIUM STHP",
         "dip_value": @{first(body('List_rows_present_in_a_table')?['value'])?['MILLENNIUM STHP']},
         "dip_date": "@{first(body('List_rows_present_in_a_table')?['value'])?['DIP DATE']}"
       },
       // Repeat for all 7 tanks...
     ]
   }
   ```

4. **HTTP:** POST to webhook
   - Method: POST
   - URI: `https://fuel-sight-guardian-ce89d8de.vercel.app/api/kalgoorlie-dip-webhook`
   - Headers:
     - `Content-Type: application/json`
     - `X-API-Key: kalgoorlie-dip-2025`
   - Body: `@{outputs('Compose')}`

5. **Condition:** Check response status code
   - If status code = 200: Success
   - If not: Send error email to admin

### Excel File Structure

Your Excel file should have these columns:

| DIP DATE   | MILLENNIUM STHP | KUNDANA Gen 1 | KUNDANA Gen 2 | RHP/RUBICON SURFACE | RALEIGH SURFACE | MLG Kundana | Paradigm O/P |
|------------|----------------|---------------|---------------|---------------------|-----------------|-------------|--------------|
| 9/12/2025  | 42342          | 87867         | 13855         | 43827               | 20910           | 66070       | 44000        |

**Note:** The webhook reads the DIP row values, not Min/Max/Ullage rows.

## Environment Variables

Add to your `.env` file:
```bash
KALGOORLIE_WEBHOOK_KEY=kalgoorlie-dip-2025
```

**Already configured in:**
- `.env.example` ✅
- Vercel environment variables (required for production)

## Alert Logic

The webhook automatically creates alerts based on tank levels:

### Critical Alert
- **Condition:** `current_level <= critical_level_liters`
- **Severity:** High
- **Message:** "CRITICAL: {tank_name} is at {percentage}% ({level}L). Immediate refill required."

### Low Fuel Alert
- **Condition:** `current_level <= min_level_liters` (but above critical)
- **Severity:** Medium
- **Message:** "{tank_name} is low at {percentage}% ({level}L). Please schedule a delivery."

### Example:
If KUNDANA Gen 2 (65,000L capacity, min: 20,000L) receives a dip of 13,855L:
- Level: 21.3%
- **Alert:** Low fuel alert triggered ⚠️

## Logging

The webhook logs key events to the console:

```
[KalgoorlieDipWebhook] Processing 7 dip readings
[DipRecordingService] Created low_fuel alert for Mil KUNDANA Gen 2
[KalgoorlieDipWebhook] Completed: 7 success, 0 failed, 1 alerts
```

Check Vercel logs for debugging:
```bash
vercel logs fuel-sight-guardian-ce89d8de
```

## Security

- **API Key Authentication:** Required via `X-API-Key` header
- **Service Role Key:** Used server-side for database access
- **Input Validation:** All dip values validated before insertion
- **Error Handling:** Malformed requests return 400 errors

## Files Created/Modified

| File                                          | Status   | Purpose                          |
|-----------------------------------------------|----------|----------------------------------|
| `api/kalgoorlie-dip-webhook.ts`               | Created  | Main webhook endpoint            |
| `api/services/KalgoorlieTankMatcher.ts`       | Created  | Tank name → ID mapping           |
| `api/services/DipRecordingService.ts`         | Created  | Dip validation and recording     |
| `.env.example`                                | Modified | Added KALGOORLIE_WEBHOOK_KEY     |
| `test-kalgoorlie-webhook.ps1`                 | Created  | PowerShell test script           |
| `test-kalgoorlie-webhook.sh`                  | Created  | Bash test script                 |
| `supabase/migrations/fix_kundana_capacities`  | Created  | Database migration               |

## Troubleshooting

### "Tank not found in mapping"
**Cause:** Excel tank name doesn't match any mapping.
**Solution:** Check `KalgoorlieTankMatcher.ts` for exact tank names.

### "Dip value exceeds tank capacity"
**Cause:** Dip value is larger than the tank's capacity.
**Solution:** Verify the dip value in Excel is correct. Check tank capacity in database.

### "Unauthorized. Invalid API key."
**Cause:** Missing or incorrect `X-API-Key` header.
**Solution:** Ensure Power Automate sends header: `X-API-Key: kalgoorlie-dip-2025`

### No alerts triggered for low tank
**Cause:** `min_level_liters` or `critical_level_liters` not set in database.
**Solution:** Update tank alert thresholds in `ta_tanks` table.

## Next Steps

1. ✅ Deploy webhook to Vercel
2. ⏳ Configure Power Automate flow
3. ⏳ Test with real Excel data
4. ⏳ Verify alerts are sent correctly
5. ⏳ Monitor logs for 1 week

## Support

For issues or questions, contact the development team or check Vercel logs for error details.
