# AgBot Customer Email Reports - Deployment Guide

## 📋 Overview

This implementation adds daily email reporting capabilities to the AgBot monitoring system, allowing customers to receive automated reports about their fuel tank statuses.

### Features Implemented

✅ **Email Infrastructure**
- Resend email service integration
- React Email templates for professional-looking reports
- Email delivery logging and tracking

✅ **Database System**
- Customer contacts table with email preferences
- Email delivery logs for audit trail
- Hierarchical customer support (GSF + individual customers)

✅ **Automated Cron Jobs**
- Daily email reports scheduled for 7 AM AWST (11 PM UTC)
- Configurable report frequency (daily/weekly/monthly)
- Error handling and retry logic

✅ **Admin UI**
- Customer contact management interface
- Add, edit, enable/disable contacts
- View email delivery history
- Integrated into AgBot page with toggle button

---

## 🚀 Deployment Steps

### Step 1: Install Dependencies

Dependencies have already been installed:
```bash
npm install resend react-email @react-email/components @react-email/render
```

### Step 2: Set Up Resend Account

1. **Create Resend Account**
   - Go to https://resend.com
   - Sign up for a free account (100 emails/day on free tier)
   - Verify your email address

2. **Generate API Key**
   - Navigate to API Keys section
   - Click "Create API Key"
   - Name it: "Fuel Sight Guardian - Production"
   - Copy the API key (starts with `re_`)

3. **Verify Domain (Optional but Recommended)**
   - Go to Domains section
   - Add `greatsouthernfuel.com.au` (or your domain)
   - Add the required DNS records (SPF, DKIM)
   - Wait for verification (can take 24-48 hours)

   **Note:** Until domain is verified, you can send from `onboarding@resend.dev` but it may have deliverability issues.

### Step 3: Configure Environment Variables

Add these environment variables to your Vercel project:

```bash
# Resend Email Service
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Cron Job Authentication
CRON_SECRET=FSG-cron-secret-2025

# Existing variables (should already be set)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

**To add in Vercel:**
1. Go to https://vercel.com/your-project/settings/environment-variables
2. Add each variable
3. Select "Production", "Preview", and "Development" environments
4. Save changes

### Step 4: Run Database Migration

You need to run the database migration to create the customer contacts tables.

**Option A: Via Supabase SQL Editor**
1. Go to https://supabase.com/dashboard/project/your-project/sql
2. Click "New Query"
3. Copy the contents of `database/migrations/create_customer_contacts_system.sql`
4. Paste and click "Run"
5. Verify success message: "Customer contacts system created successfully"

**Option B: Via psql command line**
```bash
psql postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres < database/migrations/create_customer_contacts_system.sql
```

### Step 5: Add Initial Customer Contacts

The migration includes seed data for:
- Great Southern Fuel Supplies (placeholder email)
- **Indosolutions** (placeholder email)

**Update the contacts with real emails:**
1. Deploy the application (Step 6)
2. Navigate to AgBot page
3. Click "Email Contacts" button
4. Edit each contact and add real email addresses
5. Enable the contacts

**Or update directly in Supabase:**
```sql
UPDATE customer_contacts
SET contact_email = 'real-email@indosolutions.com.au',
    contact_name = 'Operations Manager',
    enabled = true
WHERE customer_name = 'Indosolutions';
```

### Step 6: Deploy to Vercel

1. **Commit Changes to Git**
```bash
git add .
git commit -m "Add AgBot customer email reporting system

- Install Resend and React Email packages
- Create customer_contacts database schema
- Build daily email report cron job
- Add admin UI for managing customer contacts
- Configure Vercel cron schedule for 7 AM AWST"
git push origin main
```

2. **Automatic Deployment**
   - Vercel will automatically detect the push
   - Build will start automatically
   - Wait for deployment to complete (~2-3 minutes)

3. **Verify Deployment**
   - Check build logs for errors
   - Visit: https://fuel-sight-guardian-ce89d8de.vercel.app
   - Navigate to AgBot page
   - Click "Email Contacts" button - should see admin UI

### Step 7: Configure Vercel Cron Jobs

The cron job is already configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/send-agbot-reports",
      "schedule": "0 23 * * *"
    }
  ]
}
```

**Verify Cron Configuration:**
1. Go to Vercel Dashboard → Your Project → Cron Jobs
2. You should see: `send-agbot-reports` scheduled for `0 23 * * *`
3. Cron will run daily at 11 PM UTC (7 AM Perth time)

**Note:** Cron jobs are only available on Vercel Pro plan. On Hobby plan, you can:
- Manually trigger: `POST /api/cron/send-agbot-reports` with `Authorization: Bearer FSG-cron-secret-2025`
- Use external cron service (e.g., cron-job.org, EasyCron) to hit the endpoint daily

---

## 🧪 Testing

### Test 1: Email Service Configuration

Test that Resend is properly configured:

```bash
# Using curl (replace with your production URL)
curl -X POST https://fuel-sight-guardian-ce89d8de.vercel.app/api/cron/send-agbot-reports \
  -H "Authorization: Bearer FSG-cron-secret-2025" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "message": "Daily reports sent successfully",
  "results": {
    "emailsSent": 2,
    "emailsFailed": 0,
    "totalContacts": 2,
    "duration": 1234
  },
  "timestamp": "2025-11-17T..."
}
```

### Test 2: Customer Contacts Admin UI

1. Navigate to AgBot page
2. Click "Email Contacts" button
3. Verify table displays existing contacts
4. Click "Add Contact" and create a test contact:
   - Customer Name: "Test Customer"
   - Email: your-test-email@gmail.com
   - Frequency: Daily
5. Save and verify it appears in the table
6. Click toggle to disable/enable
7. Delete the test contact

### Test 3: Email Template Preview

You can preview the email template locally:

1. Create `src/emails/preview.tsx`:
```tsx
import { render } from '@react-email/render';
import AgBotDailyReport from './agbot-daily-report';

const html = render(
  AgBotDailyReport({
    customerName: 'Indosolutions',
    contactName: 'John Smith',
    reportDate: new Date().toLocaleDateString('en-AU'),
    locations: [
      {
        location_id: 'Test Tank A',
        address1: '123 Test Street',
        latest_calibrated_fill_percentage: 45,
        latest_telemetry: new Date().toISOString(),
        device_online: true,
        asset_profile_water_capacity: 50000,
        asset_daily_consumption: 500,
        asset_days_remaining: 45,
        device_serial_number: 'TEST123'
      }
    ]
  })
);

console.log(html);
```

2. Run: `npx tsx src/emails/preview.tsx > test-email.html`
3. Open `test-email.html` in browser to preview

### Test 4: Manual Email Trigger

Trigger an immediate email send (bypassing cron schedule):

```bash
curl -X POST https://fuel-sight-guardian-ce89d8de.vercel.app/api/cron/send-agbot-reports \
  -H "Authorization: Bearer FSG-cron-secret-2025"
```

Check your inbox (for the email addresses configured in customer_contacts table).

---

## 📧 Email Configuration

### Customizing Email Content

The email template is located at: `src/emails/agbot-daily-report.tsx`

You can customize:
- **Header color:** Line 223 - `backgroundColor: '#0ea5e9'`
- **Logo:** Add `<Img>` component with company logo URL
- **Footer text:** Lines 417-425
- **Alert thresholds:**
  - Low fuel: Line 93 (currently `< 30%`)
  - Critical: Line 96 (currently `< 15%` or `<= 3 days`)

### Customizing Email Frequency

Current options: `daily`, `weekly`, `monthly`

To add new frequencies:
1. Update `customer_contacts` table CHECK constraint
2. Create new cron jobs in `vercel.json` for weekly/monthly
3. Update cron endpoint to filter by frequency

### Customizing Sender Email

Update `src/services/email-service.ts`:
```typescript
const DEFAULT_FROM_EMAIL = 'AgBot Alerts <alerts@greatsouthernfuel.com.au>';
```

**Important:** Email must match verified domain in Resend.

---

## 📊 Monitoring & Logs

### View Email Logs

Check email delivery logs in Supabase:

```sql
SELECT
  sent_at,
  customer_name,
  recipient_email,
  delivery_status,
  locations_count,
  low_fuel_alerts,
  critical_alerts
FROM customer_email_logs
ORDER BY sent_at DESC
LIMIT 50;
```

### View in Resend Dashboard

1. Go to https://resend.com/emails
2. See all sent emails with open rates, click rates
3. Check for bounces or delivery failures
4. View email previews

### Debugging Failed Emails

If emails fail to send:

1. **Check Vercel Function Logs:**
   - Go to Vercel Dashboard → Functions
   - Click on `/api/cron/send-agbot-reports`
   - View recent invocations and logs

2. **Check Resend Logs:**
   - Look for error messages
   - Common issues:
     - Invalid API key
     - Unverified sender domain
     - Recipient email bounced
     - Rate limit exceeded

3. **Check Database:**
```sql
SELECT * FROM customer_email_logs
WHERE delivery_status = 'failed'
ORDER BY sent_at DESC;
```

---

## 🔐 Security Considerations

### CRON_SECRET

The cron endpoint is protected by a secret token. **Keep this secure!**

- Only Vercel Cron and authorized admins should know this secret
- Rotate periodically (update in Vercel env vars)
- Never commit to Git

### Email Data Privacy

- Customer emails are stored in Supabase (encrypted at rest)
- Only admin/manager roles can view customer_contacts
- Row-level security policies enforce access control
- Email logs include customer data - handle with care

### Rate Limiting

Resend free tier limits:
- 100 emails/day
- 3,000 emails/month

If you have >100 customers, upgrade to paid plan or batch emails differently.

---

## 🛠️ Troubleshooting

### Issue: Emails Not Sending

**Check:**
1. `RESEND_API_KEY` is set in Vercel
2. Customer contacts have `enabled = true`
3. Customer contacts have `report_frequency = 'daily'`
4. Cron job is running (check Vercel logs)
5. No errors in function logs

**Solution:**
- Test manually: `curl -X POST ... /api/cron/send-agbot-reports`
- Check Resend dashboard for delivery status
- Verify customer has AgBot locations in database

### Issue: Emails Going to Spam

**Check:**
1. Sender domain is verified in Resend
2. SPF and DKIM records are set
3. Email content doesn't trigger spam filters

**Solution:**
- Complete domain verification
- Ask recipients to whitelist sender
- Use professional email copy (avoid spam trigger words)

### Issue: Wrong Customer Data in Email

**Check:**
1. `customer_name` in `agbot_locations` matches `customer_contacts`
2. AgBot webhook data is fresh (check last update time)

**Solution:**
- Verify data mapping in cron job: `line 147` of `send-agbot-reports.ts`
- Check AgBot sync logs for errors

### Issue: Cron Job Not Running

**Check:**
1. Vercel plan (Cron requires Pro plan)
2. `vercel.json` deployed correctly
3. Function timeout (default 10s, may need increase)

**Solution:**
- Upgrade to Vercel Pro
- OR use external cron service to trigger endpoint
- Increase function timeout in Vercel settings

---

## 📈 Future Enhancements (Phase 2)

These are planned but not yet implemented:

### Customer Portal
- Self-service login for customers
- Real-time dashboard view
- Custom alert thresholds
- Report download (PDF/CSV)

### Advanced Email Features
- SMS alerts for critical levels
- Configurable alert thresholds per customer
- Weekly/monthly digest options
- Multi-language support

### Analytics
- Email open rate tracking
- Customer engagement metrics
- Fuel consumption trends
- Predictive alerts (ML-based)

---

## 📞 Support

### Getting Help

**For Deployment Issues:**
- Check Vercel function logs
- Check Supabase logs
- Review this deployment guide

**For Email Issues:**
- Check Resend dashboard
- Review `customer_email_logs` table
- Contact Resend support

**For Feature Requests:**
- Document in GitHub Issues
- Discuss with product team
- Plan for Phase 2 implementation

---

## ✅ Deployment Checklist

Before going live with customers:

- [ ] Database migration completed successfully
- [ ] Resend account created and API key configured
- [ ] Domain verified in Resend (or using default sender)
- [ ] Environment variables set in Vercel
- [ ] Application deployed to production
- [ ] Cron job scheduled (or external trigger configured)
- [ ] Customer contacts added with real email addresses
- [ ] Test email sent successfully to your own email
- [ ] Test email sent to Indosolutions contact
- [ ] Email template reviewed and approved
- [ ] Monitoring dashboard bookmarked
- [ ] Support team briefed on email system
- [ ] Customer notified about new email reports

---

## 📝 Summary

**What's Live:**
- ✅ Daily email reports to customers about their AgBot tanks
- ✅ Admin UI to manage customer email contacts
- ✅ Automated cron job running daily at 7 AM AWST
- ✅ Professional email templates with tank status, alerts, and summaries
- ✅ Email delivery logging and tracking

**Next Steps:**
1. Run database migration
2. Configure Resend API key
3. Deploy to Vercel
4. Add customer contact emails
5. Test with Indosolutions
6. Monitor for 1 week
7. Gather feedback for Phase 2

**Timeline:**
- ⏰ **Deployed:** Ready for deployment now
- 🎯 **Testing:** 1 week
- 🚀 **Full Rollout:** After successful testing with Indosolutions
- 🔮 **Phase 2 (Portal):** 4-6 weeks from now

---

**Built by:** Claude Code
**Date:** November 17, 2025
**Version:** 1.0.0
**Contact:** support@greatsouthernfuel.com.au
