# Vercel Environment Variables Configuration

This document outlines the required environment variables for the AgBot email notification system and other API endpoints to function correctly on Vercel.

## Required Environment Variables

### 1. Supabase Configuration (for API Endpoints)

These variables are needed for API routes (`/api/*`) to connect to Supabase. Note that these are **different** from the frontend variables which use the `VITE_` prefix.

```bash
SUPABASE_URL=https://wjzsdsvbtapriiuxzmih.supabase.co
SUPABASE_ANON_KEY=your_supabase_service_role_key_here
```

**Important**:
- The API endpoints use the **service role key** (not the anon key) for administrative operations
- Frontend uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (these are already configured)
- API needs non-prefixed versions: `SUPABASE_URL` and `SUPABASE_ANON_KEY`

### 2. Resend Email Service

Required for sending AgBot daily reports and test emails.

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_VERIFIED_EMAIL=Tank Alert <alert@tankalert.greatsouthernfuels.com.au>
```

**How to get your Resend API key**:
1. Sign up at [resend.com](https://resend.com)
2. Verify your domain: `tankalert.greatsouthernfuels.com.au`
3. Create an API key in the [Resend Dashboard](https://resend.com/api-keys)
4. Add the key to Vercel environment variables

### 3. Cron Job Authentication

Required for scheduled daily email reports.

```bash
CRON_SECRET=FSG-cron-secret-2025
```

This secret is used to authenticate the cron job endpoint at `/api/cron/send-agbot-reports`.

---

## How to Add Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - **Key**: Variable name (e.g., `RESEND_API_KEY`)
   - **Value**: The actual value
   - **Environments**: Select all (Production, Preview, Development)
4. Click **Save**
5. **Redeploy** your application for changes to take effect

---

## Local Development

For local development, these variables should be added to `.env.local` (which is already configured):

```bash
# .env.local
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_VERIFIED_EMAIL=Tank Alert <alert@tankalert.greatsouthernfuels.com.au>
CRON_SECRET=FSG-cron-secret-2025
```

Note: `SUPABASE_URL` and `SUPABASE_ANON_KEY` are already defined in `.env` and will be used automatically.

---

## Verification

After setting up the environment variables, you can verify they're working by:

1. **Check the API logs**: Deploy and check Vercel function logs for environment variable status
2. **Test email endpoint**: Use the "Send Test" button in the Customer Contacts admin UI
3. **Check detailed logging**: The test email endpoint includes comprehensive debug logging that will show which environment variables are set/missing

---

## Troubleshooting

### "Email service not configured" error
- Missing `RESEND_API_KEY`
- Solution: Add the key from your Resend dashboard to Vercel environment variables

### "Server configuration error"
- Missing `SUPABASE_URL` or `SUPABASE_ANON_KEY`
- Solution: Add both variables to Vercel (without `VITE_` prefix)

### Emails send but from wrong address
- Missing or incorrect `RESEND_VERIFIED_EMAIL`
- Solution: Ensure the email domain matches your verified domain in Resend
- Current verified domain: `tankalert.greatsouthernfuels.com.au`
- Correct format: `Tank Alert <alert@tankalert.greatsouthernfuels.com.au>`

### Cron job unauthorized
- Missing or incorrect `CRON_SECRET`
- Solution: Ensure the secret matches in both Vercel and your cron configuration

---

## Related Files

- **API Endpoints**:
  - `/api/test-send-email.ts` - Test email functionality
  - `/api/cron/send-agbot-reports.ts` - Scheduled daily reports
- **Email Template**: `/src/emails/agbot-daily-report.tsx`
- **Admin UI**: `/src/components/agbot/CustomerContactsAdmin.tsx`
