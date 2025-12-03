# Email System Deployment Checklist

## ✅ Cron Configuration Verified

**File:** `vercel.json`

```json
{
  "crons": [{
    "path": "/api/cron/send-agbot-reports",
    "schedule": "15 * * * *"  // Runs at :15 past every hour
  }]
}
```

✅ **Status:** Correctly configured

---

## 🔧 Required Vercel Environment Variables

Before the cron job will work, you **MUST** set these environment variables in your Vercel project:

### Step 1: Go to Vercel Dashboard

1. Navigate to: https://vercel.com/dashboard
2. Select your project: `fuel-sight-guardian`
3. Go to: **Settings** → **Environment Variables**

### Step 2: Add Backend Variables

Add these variables for **Production** environment:

| Variable Name | Required | Example Value | Where to Find |
|---------------|----------|---------------|---------------|
| `SUPABASE_URL` | ✅ YES | `https://wjzsdsvbtapriiuxzmih.supabase.co` | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | ✅ YES | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase Dashboard → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ YES | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase Dashboard → Settings → API → service_role key (secret!) |
| `RESEND_API_KEY` | ✅ YES | `re_123456789...` | Resend Dashboard → API Keys |
| `CRON_SECRET` | ⚠️ OPTIONAL | Any random string | Generate: `openssl rand -base64 32` |

### Step 3: Verify Deployment

After setting environment variables:

**A. Check Health Endpoint:**
```bash
curl https://tankalert.greatsouthernfuels.com.au/api/health
```

Expected response:
```json
{
  "ok": true,
  "status": "healthy",
  "environment": {
    "hasSupabaseUrl": true,    // ✅ Must be true
    "hasSupabaseKey": true,    // ✅ Must be true
    "hasLytxKey": true
  }
}
```

**B. Check Environment Variables Endpoint:**
```bash
curl https://tankalert.greatsouthernfuels.com.au/api/env-check
```

Expected response:
```json
{
  "services": {
    "database": true,    // ✅ Must be true
    "configured": true   // ✅ Must be true
  },
  "status": "ok"
}
```

---

## 🧪 Test Cron Endpoint Manually

### Option 1: Trigger from Vercel Dashboard

1. Go to Vercel Dashboard → Your Project
2. Click **Deployments** → Latest deployment
3. Click **Functions** tab
4. Find `/api/cron/send-agbot-reports`
5. Click **Invoke** button

### Option 2: Test with curl (will fail without Vercel signature)

```bash
curl -X GET https://tankalert.greatsouthernfuels.com.au/api/cron/send-agbot-reports
```

Expected: Will show detailed auth logging in Vercel function logs

---

## 📊 Verify Cron Job Execution

### Check Vercel Function Logs

1. Go to Vercel Dashboard → Your Project
2. Click **Deployments** → Latest deployment
3. Click **Functions** tab
4. Find `/api/cron/send-agbot-reports`
5. Click **View Logs**

### Look for These Log Messages:

**✅ Success:**
```
[EmailController AUTH] Starting authentication check
[EmailController AUTH] Headers: { hasVercelSignature: true, ... }
[EmailController AUTH] ✅ Vercel Cron signature detected - authorized
[EmailController] Current Perth time: 15:00
[EmailController] Successfully sent X reports
```

**❌ Auth Failure:**
```
[EmailController AUTH] Starting authentication check
[EmailController AUTH] Headers: { hasVercelSignature: false, ... }
[EmailController AUTH] ❌ Unauthorized - all authentication methods failed
```

**❌ Missing Environment Variables:**
```
[EmailController AUTH] Supabase env vars missing
```

---

## 🐛 Troubleshooting

### Issue: "Supabase env vars missing"

**Problem:** Backend environment variables not set in Vercel

**Solution:**
1. Go to Vercel → Settings → Environment Variables
2. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY`
3. Redeploy the project

### Issue: "Unauthorized - all authentication methods failed"

**Problem:** Vercel Cron signature not present

**Check:**
1. Verify cron job is configured in `vercel.json`
2. Make sure you're triggering from Vercel Cron (not manually)
3. Check Vercel logs for `hasVercelSignature: true`

### Issue: "Failed to create email log: Could not find the 'cc_recipients' column"

**Problem:** Database migration not applied

**Solution:**
Already fixed! The `cc_recipients` column was added in migration `20251203075419`.

Verify with:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'customer_email_logs'
  AND column_name = 'cc_recipients';
```

---

## 📧 Test Email Sending

### From Customer Contacts Admin UI:

1. Log in to: https://tankalert.greatsouthernfuels.com.au
2. Navigate to: **AgBot** → **Customer Contacts**
3. Select a contact
4. Click **Send Test Email**
5. Verify email is sent and logged

### Expected Behavior:

- ✅ Email sends successfully
- ✅ Email log created with `cc_recipients` populated (if CC emails set)
- ✅ No "401 Unauthorized" errors
- ✅ No "cc_recipients column missing" errors

---

## 🔒 Security Notes

### Frontend vs Backend Environment Variables

**CRITICAL:** Never use `VITE_` prefixed variables in backend code!

| Environment | Variable Prefix | Visibility |
|-------------|----------------|------------|
| Frontend (React) | `VITE_*` | ⚠️ Exposed in browser bundle |
| Backend (API) | No prefix | ✅ Server-side only |

**Example:**
```typescript
// ❌ WRONG - Backend using VITE_ variables
const url = process.env.VITE_SUPABASE_URL;  // Exposed to browser!

// ✅ CORRECT - Backend using server-only variables
const url = process.env.SUPABASE_URL;  // Server-side only
```

### Credentials That Should NEVER Be in Frontend:

- ❌ `SUPABASE_SERVICE_ROLE_KEY`
- ❌ `RESEND_API_KEY`
- ❌ `CRON_SECRET`
- ❌ Any API keys with admin privileges

---

## 📅 Cron Schedule

**Current Schedule:** `15 * * * *`

This means:
- Runs at 15 minutes past every hour
- 24 times per day
- At: 00:15, 01:15, 02:15, ..., 23:15 UTC

**To change schedule**, edit `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/send-agbot-reports",
    "schedule": "0 7 * * *"  // Daily at 7:00 AM UTC
  }]
}
```

Common cron expressions:
- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour
- `0 9 * * *` - Daily at 9:00 AM UTC
- `0 9 * * 1-5` - Weekdays at 9:00 AM UTC

---

## ✅ Final Verification Checklist

- [ ] All environment variables set in Vercel Production
- [ ] `/api/health` shows `hasSupabaseUrl: true` and `hasSupabaseKey: true`
- [ ] `/api/env-check` shows `database: true` and `configured: true`
- [ ] Cron job configured in `vercel.json`
- [ ] Latest code deployed to production
- [ ] Database migration `add_cc_recipients_to_email_logs` applied
- [ ] Test email sends successfully from admin UI
- [ ] Cron job executes without 401 errors
- [ ] Email logs contain `cc_recipients` data
- [ ] Vercel function logs show detailed auth debugging

---

## 🆘 Still Having Issues?

Check the Vercel function logs for detailed authentication debugging:

```
[EmailController AUTH] Starting authentication check
[EmailController AUTH] Headers: {
  hasVercelSignature: <boolean>,
  hasAuthorization: <boolean>,
  authType: <string>
}
[EmailController AUTH] Static token check: {
  hasToken: <boolean>,
  hasAdminSecret: <boolean>,
  tokenMatches: <boolean>
}
```

This will tell you exactly which authentication method is being attempted and what's available.

---

**Last Updated:** December 4, 2025
**Database Migration:** `20251203075419` (cc_recipients column added)
**Security Fix:** Commit `8bbbb328` (VITE_ variables removed from backend)
