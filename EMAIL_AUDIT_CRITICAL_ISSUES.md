# Email System Audit - Critical Issues from Multi-Tenant Refactoring

**Date**: 2025-12-03
**Commit**: 7706e12 (Multi-tenant refactoring)
**Status**: 🔴 **PRODUCTION BREAKING ISSUES**

---

## Executive Summary

The recent multi-tenant refactoring commit introduced **4 critical bugs** that completely break the email system:

1. ⛔ **Data Migration Not Run** - All tank queries return empty (ROOT CAUSE)
2. ⛔ **Schema Mismatch** - Junction table references old schema, code queries new schema
3. ⛔ **HTTP Method Restriction** - Cron endpoint rejects GET requests (breaks Vercel Cron)
4. ⚠️ **Missing Error Handling** - Silent failures when tanks not found

**Impact**:
- **100% of scheduled emails fail** (no tanks found)
- **100% of test emails fail** (no tanks found)
- **Cron job may fail** if Vercel sends GET requests (405 error)

---

## Issue 1: Data Migration Not Executed ⛔ CRITICAL

### Problem
The refactoring changed all database queries from `agbot_locations` → `ta_agbot_locations`, but **the data migration was never run**.

### Evidence
```sql
-- Current state of tables:
SELECT COUNT(*) FROM agbot_locations;        -- 21 rows (has data)
SELECT COUNT(*) FROM ta_agbot_locations;     -- 0 rows (EMPTY!)
```

### Impact
- `TankRepository.findAssignedTanks()` queries `ta_agbot_locations` → returns empty
- `TankRepository.findByCustomerName()` queries `ta_agbot_locations` → returns empty
- **ALL email sends skip** with "No tanks found"

### Files Affected
- `api/repositories/TankRepository.ts` (lines 58, 96, 134, 174, 229, 245)
- `api/repositories/AgBotAssetRepository.ts` (queries `ta_agbot_assets`)
- `api/repositories/AgBotLocationRepository.ts` (queries `ta_agbot_locations`)

### Root Cause
Migration file exists at `database/migrations/migrate_agbot_data_to_ta.sql` but was never executed in production/development database.

### Fix Required
```sql
-- Run this migration immediately:
-- File: database/migrations/migrate_agbot_data_to_ta.sql (lines 11-66)
INSERT INTO ta_agbot_locations (
  id, external_guid, name, customer_name, customer_guid, tenancy_name,
  address, state, postcode, country, latitude, longitude,
  installation_status, installation_status_label, is_disabled,
  daily_consumption_liters, days_remaining, calibrated_fill_level,
  last_telemetry_at, last_telemetry_epoch, created_at, updated_at
)
SELECT
  id, location_guid, COALESCE(location_id, 'Unknown Location'),
  customer_name, customer_guid, tenancy_name, address1, state, postcode,
  COALESCE(country, 'Australia'), lat, lng,
  COALESCE(installation_status, 0), installation_status_label,
  COALESCE(disabled, false), location_daily_consumption,
  location_days_remaining, location_calibrated_fill_level,
  latest_telemetry, latest_telemetry_epoch, created_at, updated_at
FROM agbot_locations
ON CONFLICT (external_guid) DO UPDATE SET
  name = EXCLUDED.name,
  customer_name = EXCLUDED.customer_name,
  updated_at = NOW();
```

---

## Issue 2: Foreign Key Schema Mismatch ⛔ CRITICAL

### Problem
`customer_contact_tanks` table references **OLD schema**, but code queries **NEW schema**.

### Evidence
```typescript
// customer_contact_tanks foreign key (line 9 in create_customer_contact_tanks.sql):
agbot_location_id UUID REFERENCES agbot_locations(id)  // ← OLD TABLE

// TankRepository.findAssignedTanks() (line 58 in TankRepository.ts):
.from('ta_agbot_locations')  // ← NEW TABLE
.in('id', tankIds)           // ← IDs from old table won't match!
```

### Impact for "Wonder Mine Site" Customer
1. `customer_contact_tanks` has: `agbot_location_id = 'ed940866-8341-4a37-9dc9-ffbe077e881e'`
2. This ID exists in `agbot_locations` table ✅
3. This ID does NOT exist in `ta_agbot_locations` table ❌
4. Query returns empty → Email skipped

### Fix Options

**Option A: Update Foreign Key (BREAKING CHANGE)**
```sql
-- Warning: This will fail if ta_agbot_locations doesn't have matching IDs
ALTER TABLE customer_contact_tanks
  DROP CONSTRAINT customer_contact_tanks_agbot_location_id_fkey,
  ADD CONSTRAINT customer_contact_tanks_agbot_location_id_fkey
    FOREIGN KEY (agbot_location_id)
    REFERENCES ta_agbot_locations(id)
    ON DELETE CASCADE;
```

**Option B: Update Repository to Query Old Table (TEMPORARY FIX)**
```typescript
// In TankRepository.findAssignedTanks(), change:
.from('ta_agbot_locations')  // ← NEW
// to:
.from('agbot_locations')     // ← OLD (temporary fix until migration runs)
```

**Option C: Run Migration First** (RECOMMENDED)
- Run Issue #1 fix first (migrate data)
- UUIDs are preserved during migration (`id` column copied as-is)
- Foreign keys will automatically work once data exists

---

## Issue 3: HTTP Method Restriction ⛔ CRITICAL

### Problem
Old cron endpoint accepted **GET and POST**, new endpoint **ONLY accepts POST**.

### Evidence
```typescript
// OLD (send-agbot-reports.ts.backup, line 88-93):
if (req.method !== 'GET' && req.method !== 'POST') {
  return res.status(405).json({ error: 'Method not allowed' });
}

// NEW (EmailController.ts, line 69-76):
if (req.method !== 'POST') {  // ← ONLY POST!
  return res.status(405).json({ error: 'Method not allowed' });
}
```

### Impact
- **Vercel Cron** default behavior is **GET requests**
- Cron job will fail with **405 Method Not Allowed**
- Check `vercel.json` to see if method is specified

### Current Vercel Config
```json
// vercel.json (line 3-7):
{
  "crons": [
    {
      "path": "/api/cron/send-agbot-reports",
      "schedule": "15 * * * *"  // ← No method specified, defaults to GET
    }
  ]
}
```

### Fix Required
**Option A: Accept GET (match old behavior)**
```typescript
// EmailController.ts line 69-70, change:
if (req.method !== 'POST') {
// to:
if (req.method !== 'GET' && req.method !== 'POST') {
```

**Option B: Update vercel.json** (if Vercel supports it)
```json
{
  "crons": [
    {
      "path": "/api/cron/send-agbot-reports",
      "schedule": "15 * * * *",
      "method": "POST"  // ← Explicitly set method
    }
  ]
}
```

---

## Issue 4: Silent Failures - No Logging ⚠️ HIGH PRIORITY

### Problem
When no tanks are found, the system skips the email silently with minimal logging.

### Evidence
```typescript
// EmailService.ts line 224-228:
if (tanks.length === 0) {
  console.warn(`[EmailService] No tanks found for ${contact.customer_name}`);
  result.skipped++;
  continue;  // ← Silent skip, no detailed info
}
```

### Impact
- Admin cannot diagnose WHY emails fail
- No visibility into:
  - Which query failed (assigned vs fallback)
  - Tank assignment status
  - Database errors vs data not found

### Fix Required
Add comprehensive logging (similar to my stashed changes):

```typescript
// In TankRepository.findTanksForContact():
async findTanksForContact(contactId: string, customerName: string): Promise<Tank[]> {
  console.log(`[TankRepo] Finding tanks for contact ${contactId}, customer: ${customerName}`);

  // Try specific assignments first
  const assignedTanks = await this.findAssignedTanks(contactId);

  if (assignedTanks.length > 0) {
    console.log(`[TankRepo] Found ${assignedTanks.length} assigned tanks`);
    return assignedTanks;
  }

  console.log(`[TankRepo] No assigned tanks, falling back to customer_name query`);

  // Fallback to all customer tanks
  const customerTanks = await this.findByCustomerName(customerName);
  console.log(`[TankRepo] Fallback returned ${customerTanks.length} tanks`);

  if (customerTanks.length === 0) {
    console.warn(`⚠️  [TankRepo] NO TANKS FOUND - Check data migration status`);
    console.warn(`   - Contact ID: ${contactId}`);
    console.warn(`   - Customer Name: ${customerName}`);
    console.warn(`   - Suggestion: Run migrate_agbot_data_to_ta.sql`);
  }

  return customerTanks;
}
```

---

## Issue 5: Invalid FROM Email Format ⚠️ POTENTIAL

### Problem
Error message indicates: `Invalid 'from' field. The email address needs to follow the 'email@example.com' or 'Name <email@example.com>' format.`

### Evidence
The code LOOKS correct:
```typescript
// EmailService.ts line 124:
from: `${config.from_name} <${config.from_email}>`,  // ← Should produce: "Tank Alert <alert@...>"
```

### Possible Causes
1. **`config.from_name` or `config.from_email` is undefined**
   - Check if `getEmailConfig()` is failing
   - Check if `process.env.RESEND_VERIFIED_EMAIL` is set

2. **Whitespace issues**
   - Extra spaces in env var: `" Tank Alert "` would produce `" Tank Alert  <email>"`

3. **Error is from a different code path**
   - Check if there's old code still running
   - Check if MockEmailProvider is being used

### Fix Required
Add validation:
```typescript
private async getEmailConfig(): Promise<EmailConfig> {
  const fromEmail = process.env.RESEND_VERIFIED_EMAIL ||
                    'alert@tankalert.greatsouthernfuels.com.au';
  const fromName = 'Tank Alert';

  // Validate
  if (!fromEmail || !fromEmail.includes('@')) {
    throw new Error(`Invalid FROM email: ${fromEmail}`);
  }

  if (!fromName || fromName.trim() === '') {
    throw new Error(`Invalid FROM name: ${fromName}`);
  }

  return {
    from_email: fromEmail.trim(),
    from_name: fromName.trim(),
    // ... rest of config
  };
}
```

---

## Recommended Fix Order

### IMMEDIATE (Deploy Today)

1. **Run Data Migration** (Issue #1)
   ```bash
   # In Supabase SQL Editor:
   # Copy/paste: database/migrations/migrate_agbot_data_to_ta.sql (lines 11-66)
   ```

2. **Fix HTTP Method** (Issue #3)
   ```typescript
   // api/controllers/EmailController.ts line 70
   if (req.method !== 'GET' && req.method !== 'POST') {
   ```

3. **Add Logging** (Issue #4)
   - Apply logging improvements from stashed changes
   - Add debug logging to TankRepository

### NEAR-TERM (This Week)

4. **Validate Email Config** (Issue #5)
   - Add validation to `getEmailConfig()`
   - Log config values at startup

5. **Monitor & Test**
   - Manually trigger cron: `POST /api/cron/send-agbot-reports` with Bearer token
   - Check Vercel logs for detailed output
   - Send test email to verify end-to-end

### LONG-TERM (Next Sprint)

6. **Fix Foreign Key** (Issue #2)
   - After migration is stable
   - Update foreign key constraint to reference `ta_agbot_locations`

7. **Complete Multi-Tenant Migration**
   - Migrate assets table
   - Migrate readings table
   - Update all remaining references

---

## Testing Checklist

- [ ] Run data migration SQL
- [ ] Verify ta_agbot_locations has data: `SELECT COUNT(*) FROM ta_agbot_locations;`
- [ ] Deploy code fixes (HTTP method + logging)
- [ ] Manually trigger cron job:
  ```bash
  curl -X POST https://fuel-sight-guardian-ce89d8de.vercel.app/api/cron/send-agbot-reports \
    -H "Authorization: Bearer FSG-cron-secret-2025"
  ```
- [ ] Check Vercel logs for detailed output
- [ ] Send test email to "Wonder Mine Site" contact
- [ ] Verify email received with correct FROM field
- [ ] Wait for next scheduled cron (5:15am) and verify success

---

## Files Requiring Changes

### Immediate Fixes
- `api/controllers/EmailController.ts` (line 70: accept GET)
- `api/repositories/TankRepository.ts` (add logging to findTanksForContact)
- `api/services/EmailService.ts` (add validation to getEmailConfig)
- Database: Run `migrate_agbot_data_to_ta.sql`

### Future Fixes
- `database/migrations/create_customer_contact_tanks.sql` (update foreign key)
- All files querying `ta_agbot_assets` (complete migration)
- All files querying `ta_agbot_readings` (complete migration)

---

## Contact
For questions: Hayden Hamilton
Original issue: 5:15am cron job failing silently (0 emails sent)
