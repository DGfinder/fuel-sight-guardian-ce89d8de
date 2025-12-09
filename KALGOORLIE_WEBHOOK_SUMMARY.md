# Kalgoorlie Dip Webhook - Quick Summary

## ✅ Implementation Complete

All components have been successfully implemented and are ready for deployment.

## 📋 What Was Built

### 1. Database Migration ✅
- Fixed KUNDANA Gen 1 capacity: 65,000L → 90,000L
- Fixed KUNDANA Gen 2 capacity: 90,000L → 65,000L
- Migration applied to Supabase: `fix_kundana_tank_capacities`

### 2. Services ✅
- **KalgoorlieTankMatcher** - Maps Excel tank names to database IDs
- **DipRecordingService** - Validates, records dips, and triggers alerts

### 3. Webhook Endpoint ✅
- **URL:** `/api/kalgoorlie-dip-webhook`
- **Method:** POST
- **Auth:** API Key via `X-API-Key` header
- **Features:**
  - Batch processing (7 tanks at once)
  - Automatic alert generation
  - Detailed success/failure reporting

### 4. Test Scripts ✅
- `test-kalgoorlie-webhook.ps1` (PowerShell for Windows)
- `test-kalgoorlie-webhook.sh` (Bash for Unix/Mac)

### 5. Documentation ✅
- `KALGOORLIE_WEBHOOK_README.md` - Complete implementation guide
- Power Automate setup instructions included

## 🔑 Configuration Required

### Environment Variable
Add to Vercel environment variables:
```
KALGOORLIE_WEBHOOK_KEY=kalgoorlie-dip-2025
```

**Important:** This must be set in Vercel dashboard before the webhook will work in production.

## 🚀 Next Steps

### 1. Deploy to Vercel
```bash
git add .
git commit -m "feat: Add Kalgoorlie dip webhook endpoint"
git push
```

### 2. Add API Key to Vercel
1. Go to: https://vercel.com/your-project/settings/environment-variables
2. Add new variable:
   - **Name:** `KALGOORLIE_WEBHOOK_KEY`
   - **Value:** `kalgoorlie-dip-2025`
   - **Environment:** Production
3. Redeploy the project

### 3. Configure Power Automate
Follow the detailed instructions in `KALGOORLIE_WEBHOOK_README.md` section "Power Automate Setup"

### 4. Test the Webhook
Run the PowerShell test script:
```powershell
.\test-kalgoorlie-webhook.ps1
```

Or use curl:
```bash
curl -X POST https://fuel-sight-guardian-ce89d8de.vercel.app/api/kalgoorlie-dip-webhook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: kalgoorlie-dip-2025" \
  -d '{"dips":[{"tank_name":"MILLENNIUM STHP","dip_value":42342,"dip_date":"2025-12-09"}]}'
```

## 📊 Tank Mappings

| Excel Name          | Database Name     | Tank ID                              | Capacity |
|---------------------|-------------------|--------------------------------------|----------|
| MILLENNIUM STHP     | Millennium STHP   | 8b5ed106-5e1a-4a9c-8c5e-975f9fce459a | 65,000L  |
| KUNDANA Gen 1       | Mil KUNDANA Gen 1 | 6bc0db19-4c82-4447-9531-2c0c957ab902 | 90,000L  |
| KUNDANA Gen 2       | Mil KUNDANA Gen 2 | df804603-fcad-4e4f-be4c-f530817b5b5f | 65,000L  |
| RHP/RUBICON SURFACE | RUBICON SURFACE   | 8f63f353-089b-4a94-b2b4-03de167d764f | 50,000L  |
| RALEIGH SURFACE     | RALEIGH SURFACE   | 5aefc0ef-0fbb-4edf-8a84-801372179138 | 50,000L  |
| MLG Kundana         | MLG Kundana       | 38adbc1a-4236-4daa-a03a-d1f21f914f59 | 110,000L |
| Paradigm O/P        | Paradigm O/P      | bcd39536-bac0-473d-879c-8a088c315f81 | 110,000L |

## 🎯 Expected Behavior

When Power Automate sends dip readings:

1. **Webhook receives POST request**
   - Authenticates API key
   - Validates payload structure

2. **For each tank dip:**
   - Matches Excel name to database tank ID
   - Validates dip value (> 0, < capacity)
   - Inserts record into `ta_tank_dips`
   - Updates `ta_tanks.current_level_liters`
   - Calculates level percentage

3. **Alert generation:**
   - If level ≤ critical threshold → Create CRITICAL alert
   - If level ≤ min threshold → Create LOW FUEL alert

4. **Response returned:**
   ```json
   {
     "success": true,
     "summary": {
       "total": 7,
       "successful": 7,
       "failed": 0,
       "alerts_triggered": 1
     },
     "results": [...]
   }
   ```

## 🔍 Monitoring

After deployment, monitor:
- Vercel logs for webhook calls
- `ta_tank_dips` table for new records
- `ta_alerts` table for generated alerts
- Power Automate run history for flow status

## ✅ Success Criteria

- [ ] Webhook deployed to Vercel
- [ ] API key configured in Vercel environment
- [ ] Test script returns `"success": true`
- [ ] Power Automate flow created and tested
- [ ] Dip readings appear in `ta_tank_dips`
- [ ] Tank levels update in `ta_tanks`
- [ ] Alerts generated for low tanks

## 📞 Support

For issues, check:
1. Vercel logs: `vercel logs fuel-sight-guardian-ce89d8de`
2. `KALGOORLIE_WEBHOOK_README.md` troubleshooting section
3. Power Automate run history for flow errors
