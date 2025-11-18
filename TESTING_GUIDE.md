# Testing Guide - Enhanced Email Templates

## Quick Start

### Step 1: Get a Customer Contact ID

Run this query in your Supabase SQL editor or use the dashboard:

```sql
SELECT
  id,
  customer_name,
  contact_name,
  contact_email,
  report_frequency,
  enabled
FROM customer_contacts
WHERE enabled = true
LIMIT 5;
```

Copy one of the `id` values (UUID format).

### Step 2: Test the New Email Templates

#### Option A: Using the Test Script (Recommended)

```bash
# Test all three variants at once
node test-new-email.js YOUR_CONTACT_ID_HERE
```

This will send you 3 test emails:
1. Daily Enhanced Report
2. Weekly Enhanced Report
3. Monthly Enhanced Report

#### Option B: Using cURL (Manual)

**Test Daily Report:**
```bash
curl -X POST https://fuel-sight-guardian-ce89d8de.vercel.app/api/test-send-email \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "YOUR_CONTACT_ID_HERE",
    "use_enhanced": true,
    "frequency": "daily"
  }'
```

**Test Weekly Report:**
```bash
curl -X POST https://fuel-sight-guardian-ce89d8de.vercel.app/api/test-send-email \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "YOUR_CONTACT_ID_HERE",
    "use_enhanced": true,
    "frequency": "weekly"
  }'
```

**Test Monthly Report:**
```bash
curl -X POST https://fuel-sight-guardian-ce89d8de.vercel.app/api/test-send-email \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "YOUR_CONTACT_ID_HERE",
    "use_enhanced": true,
    "frequency": "monthly"
  }'
```

#### Option C: Using Postman/Insomnia

1. Create a new POST request
2. URL: `https://fuel-sight-guardian-ce89d8de.vercel.app/api/test-send-email`
3. Headers: `Content-Type: application/json`
4. Body (JSON):
   ```json
   {
     "contact_id": "YOUR_CONTACT_ID_HERE",
     "use_enhanced": true,
     "frequency": "daily"
   }
   ```
5. Click Send

### Step 3: Enable Enhanced Reports in Production

Once you're happy with the test emails, enable them for everyone:

1. Open `api/cron/send-agbot-reports.ts`
2. Find line 14:
   ```typescript
   const USE_ENHANCED_REPORTS = true;
   ```
3. Make sure it's set to `true`
4. Commit and push the change
5. Vercel will auto-deploy

---

## What to Look For

### ✅ Good Signs

**In the Email:**
- [ ] Great Southern Fuels branding (green header)
- [ ] 24-hour consumption prominently displayed
- [ ] Tank capacity shown as "X L / Yk L"
- [ ] Estimated refill dates
- [ ] Trend indicators (↑↓→)
- [ ] Color-coded fuel levels (red/amber/green)
- [ ] Professional layout and formatting
- [ ] Mobile-responsive design

**In Weekly/Monthly Reports:**
- [ ] Charts display correctly
- [ ] Fleet analytics section visible
- [ ] Pattern analysis included

### ❌ Issues to Check

- Email not received (check spam folder)
- Charts not loading (QuickChart API issue)
- Data missing (analytics calculation error)
- Formatting broken (CSS/HTML issue)

---

## Comparing Legacy vs Enhanced

### Test Both Templates

**Legacy Template:**
```bash
curl -X POST https://fuel-sight-guardian-ce89d8de.vercel.app/api/test-send-email \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "YOUR_CONTACT_ID",
    "use_enhanced": false,
    "frequency": "daily"
  }'
```

**Enhanced Template:**
```bash
curl -X POST https://fuel-sight-guardian-ce89d8de.vercel.app/api/test-send-email \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "YOUR_CONTACT_ID",
    "use_enhanced": true,
    "frequency": "daily"
  }'
```

### Key Differences

| Feature | Legacy | Enhanced |
|---------|--------|----------|
| Branding | Sky blue header | Great Southern Fuels green |
| 24hr consumption | Not shown | Highlighted in summary |
| Capacity format | "X L of Yk L" | "X L / Yk L" (more prominent) |
| Trends | Not shown | Trend indicators (↑↓→) |
| Refill dates | Not shown | Estimated dates |
| Charts | None | Sparklines + charts |
| Analytics | Basic | Comprehensive |
| Frequencies | Daily only | Daily/Weekly/Monthly |

---

## Troubleshooting

### Issue: No Email Received

1. Check spam/junk folder
2. Verify contact email in database
3. Check Resend dashboard for delivery status
4. Check `customer_email_logs` table

### Issue: Charts Not Loading

- QuickChart API may be rate-limited (60 req/min free tier)
- Charts only appear in weekly/monthly reports
- Daily reports use text-based sparklines

### Issue: Analytics Data Missing

- Requires historical data in `agbot_readings_history`
- New tanks may not have enough data
- Falls back gracefully to basic info

### Issue: 500 Error

1. Check Vercel logs
2. Verify environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `RESEND_API_KEY`
3. Check TypeScript compilation errors

---

## Next Steps After Testing

1. **Collect Feedback**
   - Forward test emails to stakeholders
   - Get approval from management
   - Note any requested changes

2. **Enable in Production**
   - Set `USE_ENHANCED_REPORTS = true`
   - Monitor first batch of emails
   - Check `customer_email_logs` for issues

3. **Upload Logo**
   - Upload `src/assets/logo.png` to CDN
   - Update `logoUrl` in report generator
   - Re-test to verify logo displays

4. **Monitor Performance**
   - Check email open rates
   - Monitor Resend delivery rates
   - Watch for bounce/complaint rates

5. **Iterate**
   - Add requested features
   - Adjust analytics based on feedback
   - Fine-tune chart visualizations

---

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Check Supabase logs
3. Check Resend dashboard
4. Review `customer_email_logs` table
5. Check `EMAIL_TEMPLATE_ENHANCEMENT_SUMMARY.md` for details

---

## Feature Rollback

If you need to revert to the legacy template:

```typescript
// In api/cron/send-agbot-reports.ts line 14
const USE_ENHANCED_REPORTS = false;
```

Commit, push, and the next cron run will use the old template.
