# Email System Refactoring: Customer-Centric to Asset-Subscription Model

## Executive Summary

Transform the email system from **customer-centric** (contacts own preferences, assigned to tanks) to **asset-subscription** model (tanks own subscribers with independent preferences). This enables newsletter-style subscriptions where one asset can have 100+ independent email recipients, each with their own frequency, send hour, and format preferences.

## Current Problems

1. **Architectural Constraint**: One primary email per contact record prevents multiple independent recipients per asset
2. **CC Field Workaround**: Comma-separated CC field forces all recipients to share preferences
3. **Missing Column**: `preferred_send_hour` used in code but missing from `customer_contacts` schema
4. **Mock Data Duplication**: Indosolutions mock seed data creates UI confusion
5. **Confusing Fallback Logic**: Hybrid customer_name matching creates unexpected tank assignments

## User Requirements

- ✅ One asset → Many independent email recipients (100+ supported)
- ✅ Individual recipient preferences (frequency, send hour, format)
- ✅ Customer-based organization for grouping/management
- ✅ Clean up duplicate Indosolutions mock data
- ✅ Maintain existing email functionality during transition

---

## Implementation Plan

### PHASE 1: Database Schema & Migration (Week 1)

#### 1.1 Create New `asset_subscriptions` Table

**File**: `database/migrations/migrate_to_asset_subscriptions.sql`

**Core Schema**:
```sql
CREATE TABLE asset_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agbot_location_id UUID NOT NULL REFERENCES ta_agbot_locations(id) ON DELETE CASCADE,

  -- Subscriber identity
  subscriber_email TEXT NOT NULL,
  subscriber_name TEXT,
  customer_name TEXT NOT NULL,  -- For organizational grouping

  -- Individual preferences
  report_frequency TEXT DEFAULT 'daily' CHECK (report_frequency IN ('daily', 'weekly', 'monthly')),
  report_format TEXT DEFAULT 'summary',
  preferred_send_hour INT DEFAULT 7 CHECK (preferred_send_hour BETWEEN 5 AND 8),
  timezone TEXT DEFAULT 'Australia/Perth',

  -- Subscription management
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'paused', 'unsubscribed', 'bounced')),
  unsubscribe_token TEXT UNIQUE NOT NULL,
  last_email_sent_at TIMESTAMPTZ,
  bounce_count INT DEFAULT 0,
  subscription_source TEXT,  -- 'manual', 'migrated', etc.

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(agbot_location_id, subscriber_email)  -- Prevent duplicates
);
```

**Key Indexes**:
```sql
CREATE INDEX idx_asset_subscriptions_scheduled
  ON asset_subscriptions(subscription_status, preferred_send_hour, report_frequency)
  WHERE subscription_status = 'active';
```

#### 1.2 Create Audit Trail Table

**Purpose**: Track all subscription changes for compliance and debugging

```sql
CREATE TABLE asset_subscription_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES asset_subscriptions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- 'created', 'updated', 'unsubscribed', etc.
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  old_values JSONB,
  new_values JSONB
);
```

#### 1.3 Data Migration Strategy

**Step 1**: Migrate contacts with specific tank assignments
```sql
INSERT INTO asset_subscriptions (...)
SELECT
  cct.agbot_location_id,
  cc.contact_email,
  cc.report_frequency,
  COALESCE(cc.preferred_send_hour, 7),  -- Fix missing column
  ...
FROM customer_contacts cc
JOIN customer_contact_tanks cct ON cc.id = cct.customer_contact_id
WHERE cc.customer_name != 'Indosolutions'  -- Skip mock data
ON CONFLICT DO NOTHING;
```

**Step 2**: Migrate contacts without assignments (customer_name fallback)
```sql
INSERT INTO asset_subscriptions (...)
SELECT
  loc.id,
  cc.contact_email,
  ...
FROM customer_contacts cc
CROSS JOIN ta_agbot_locations loc
WHERE cc.customer_name = loc.customer_name
  AND NOT EXISTS (SELECT 1 FROM customer_contact_tanks WHERE customer_contact_id = cc.id);
```

**Step 3**: Parse CC emails and create individual subscriptions
```sql
INSERT INTO asset_subscriptions (...)
SELECT
  cct.agbot_location_id,
  TRIM(cc_email),
  ...
FROM customer_contacts cc
CROSS JOIN LATERAL unnest(string_to_array(cc.cc_emails, ',')) AS cc_email
WHERE cc.cc_emails IS NOT NULL;
```

**Step 4**: Delete mock data
```sql
DELETE FROM customer_contacts WHERE customer_name = 'Indosolutions';
```

#### 1.4 Rollback Strategy

**Backup before migration**:
```bash
COPY customer_contacts TO '/backup/customer_contacts.csv' CSV HEADER;
COPY customer_contact_tanks TO '/backup/customer_contact_tanks.csv' CSV HEADER;
```

**Emergency rollback script**: `rollback_asset_subscriptions.sql`

---

### PHASE 2: Backend Code Refactoring (Week 2)

#### 2.1 Create New `SubscriptionRepository.ts`

**File**: `api/repositories/SubscriptionRepository.ts`

**Key Methods**:
```typescript
export class SubscriptionRepository {
  // Find active subscriptions for scheduled sending
  async findByPreferredHour(hour: number): Promise<Subscription[]>

  // Find all subscribers for one asset
  async findByAsset(locationId: string): Promise<Subscription[]>

  // Create subscription
  async create(data: CreateSubscriptionInput): Promise<Subscription>

  // Bulk create (one email → multiple assets)
  async bulkCreate(subscriptions: CreateSubscriptionInput[]): Promise<Subscription[]>

  // Update preferences
  async updatePreferences(id: string, prefs: Partial<Subscription>): Promise<void>

  // Update last sent timestamp
  async updateLastEmailSent(id: string, timestamp: Date): Promise<void>

  // Unsubscribe
  async unsubscribe(id: string): Promise<void>

  // Increment bounce count
  async incrementBounceCount(id: string): Promise<void>
}
```

#### 2.2 Refactor `EmailService.ts`

**File**: `api/services/EmailService.ts`

**Changes**:

1. **Constructor**: Add `SubscriptionRepository` dependency
2. **sendScheduledReports()** (Lines 52-72):
   ```typescript
   // OLD: Get contacts, then find tanks for each
   const contacts = await contactRepo.findByPreferredHour(perthHour);
   for (const contact of contacts) {
     const tanks = await tankRepo.findTanksForContact(contact.id, contact.customer_name);
   }

   // NEW: Get subscriptions (each already points to ONE asset)
   const subscriptions = await subscriptionRepo.findByPreferredHour(perthHour);
   for (const subscription of subscriptions) {
     const asset = await tankRepo.findAssetById(subscription.agbot_location_id);
   }
   ```

3. **sendEmail()** signature:
   ```typescript
   // OLD
   async sendEmail({ contact, tanks, frequency, config })

   // NEW
   async sendEmail({ subscription, asset, config })
   ```

4. **Email logging**: Use `asset_subscription_id` instead of `customer_contact_id`

#### 2.3 Update `EmailLogRepository.ts`

**File**: `api/repositories/EmailLogRepository.ts`

**Changes**:
- Add `asset_subscription_id` field to EmailLog interface
- Keep `customer_contact_id` optional for backward compatibility
- Update `create()` to insert new field

#### 2.4 Update `TankRepository.ts`

**File**: `api/repositories/TankRepository.ts`

**Changes**:
- Remove `findTanksForContact()` (hybrid logic no longer needed)
- Add `findAssetById(locationId: string)` for subscription-based queries

#### 2.5 Update `ReportGeneratorService.ts`

**File**: `api/services/ReportGeneratorService.ts`

**Changes**:
- Change from `tanks: Tank[]` to `asset: Tank` (single asset per report now)
- Update template generation for single asset

#### 2.6 Update `EmailController.ts`

**File**: `api/controllers/EmailController.ts`

**Changes**:
- Initialize `SubscriptionRepository` in constructor
- Update `sendTestEmail()` to use `subscription_id` parameter instead of `contact_id`

---

### PHASE 3: Frontend Refactoring (Week 2-3)

#### 3.1 Refactor `CustomerContactsAdmin.tsx`

**File**: `src/components/agbot/CustomerContactsAdmin.tsx`

**Major Changes**:

1. **Component rename**: `CustomerContactsAdmin` → `AssetSubscriptionsAdmin`

2. **State management**:
   ```typescript
   // OLD
   const [contacts, setContacts] = useState<CustomerContact[]>([]);

   // NEW
   const [viewMode, setViewMode] = useState<'by-asset' | 'by-subscriber'>('by-asset');
   const [assets, setAssets] = useState<AssetWithSubscriptions[]>([]);
   const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
   ```

3. **Data fetching**:
   ```typescript
   // OLD: Fetch contacts with tank assignments
   const fetchContacts = async () => {
     const { data } = await supabase.from('customer_contacts').select('*');
   }

   // NEW: Fetch assets with subscription counts
   const fetchAssetsWithSubscriptions = async () => {
     const { data } = await supabase
       .from('asset_subscriptions_enriched')
       .select('*')
       .order('location_name');
   }
   ```

4. **UI Layout - Asset-Centric View** (Default):
   ```
   +----------------------------------------------------+
   | Asset Subscriptions Management                     |
   +----------------------------------------------------+
   | [View: By Asset ▼] [+ Add Subscriber to Asset]    |
   +----------------------------------------------------+
   | Asset Name          | Location    | Subscribers    |
   |----------------------------------------------------|
   | ▼ Tank A (Perth)    | 123 Main St | 15 active     |
   |   → john@ex.com (daily, 7am)      [Edit] [✕]     |
   |   → mary@ex.com (weekly, 6am)     [Edit] [✕]     |
   |   [+ Add Subscriber]                               |
   +----------------------------------------------------+
   ```

5. **Remove features**:
   - Customer_name fallback logic (Lines 614-620)
   - CC emails field (now separate subscriptions)
   - Hybrid tank assignment UI

6. **Add bulk operations**:
   - Add subscriber to multiple assets at once
   - Remove subscriber from all assets
   - Import subscribers from CSV

#### 3.2 Create New Component: `SubscriptionDetailsPanel.tsx`

**File**: `src/components/agbot/SubscriptionDetailsPanel.tsx`

**Purpose**: Show detailed subscription info for selected asset

**Features**:
- List all subscribers for one asset
- Individual preference editing per subscriber
- Email delivery stats
- Subscription audit history

---

### PHASE 4: Migration Execution (Week 3)

#### Day 1-2: Preparation
1. Backup production data
2. Run migration SQL in staging environment
3. Verify data integrity in staging
4. Deploy new backend code with dual-write (write to both old and new tables)

#### Day 3-4: Parallel Operation
1. Deploy to production (still reading from old tables)
2. Monitor dual-write for data consistency
3. Run verification queries

#### Day 5-7: Cutover
1. Deploy EmailService that reads from `asset_subscriptions`
2. Monitor cron jobs for 48 hours
3. Check error logs
4. Verify email delivery rates

#### Week 4: Cleanup
1. Remove dual-write code
2. Rename old tables to `_deprecated`
3. Deploy new UI
4. Update documentation

#### Week 5: Archive
After 2 weeks of successful operation:
```sql
DROP TABLE customer_contacts_deprecated CASCADE;
DROP TABLE customer_contact_tanks_deprecated CASCADE;
```

---

### PHASE 5: Testing & Validation

#### Unit Tests
```typescript
// SubscriptionRepository.test.ts
test('findByPreferredHour returns only active subscriptions')
test('bulkCreate prevents duplicate subscriptions')

// EmailService.test.ts
test('sendScheduledReports sends to all subscribers for asset')
test('respects individual preferences per subscription')
```

#### Integration Tests
1. Migration test on production copy
2. Email sending with various preferences
3. UI operations (add, edit, unsubscribe)

#### Load Tests
- 100+ subscriptions per asset
- Query performance verification
- Batch sending capacity

---

## Success Criteria

Migration is successful when:

✅ All existing email recipients continue receiving emails
✅ Zero data loss (all contacts migrated)
✅ Email delivery rate remains stable (>95%)
✅ Admins can add 100+ subscribers to one asset
✅ Individual preferences work correctly
✅ Unsubscribe functionality works
✅ No increase in error logs
✅ Old tables can be safely archived

---

## Critical Files to Modify

### Database
- `database/migrations/migrate_to_asset_subscriptions.sql` - Schema + data migration
- `database/migrations/rollback_asset_subscriptions.sql` - Emergency rollback

### Backend Repositories
- `api/repositories/SubscriptionRepository.ts` - **NEW** - Core subscription data access
- `api/repositories/ContactRepository.ts` - Deprecate after migration
- `api/repositories/EmailLogRepository.ts` - Add `asset_subscription_id` field
- `api/repositories/TankRepository.ts` - Remove hybrid query logic

### Backend Services
- `api/services/EmailService.ts` - Refactor `sendScheduledReports()` to use subscriptions
- `api/services/ReportGeneratorService.ts` - Update to handle single asset per report
- `api/controllers/EmailController.ts` - Use SubscriptionRepository

### Frontend
- `src/components/agbot/CustomerContactsAdmin.tsx` - Complete refactor to asset-centric view
- `src/components/agbot/SubscriptionDetailsPanel.tsx` - **NEW** - Subscription details UI

### API Endpoints
- `api/admin/manage-subscriptions.ts` - **NEW** - Bulk subscription management endpoint
- `api/cron/send-agbot-reports.ts` - No changes (delegates to EmailService)
- `api/test-send-email.ts` - Update to use `subscription_id` parameter

---

## Timeline

| Week | Phase | Risk |
|------|-------|------|
| 1 | Database schema + migration prep | Low |
| 2 | Backend refactoring + parallel operation | Medium |
| 3 | Cutover + monitoring | High |
| 4 | UI deployment + cleanup | Medium |
| 5 | Archive old tables | Low |

**Total Duration**: 5 weeks
**Critical Path**: Week 3 cutover

---

## Rollback Plan

If issues during cutover:
1. Redeploy old EmailService (reads from customer_contacts)
2. Restore from backup if data corruption
3. Debug in staging environment
4. Retry next week after fixes

---

## Key Architecture Benefits

**Before** (Customer-Centric):
```
Customer Contact (1 email) → Tank Assignments → Multiple Tanks
└─ CC field (shared preferences)
```

**After** (Asset-Subscription):
```
Tank/Asset (1) → Subscriptions (100+) → Individual Recipients
└─ Each subscription has independent preferences
```

**Result**: True newsletter-style subscriptions with unlimited scale and individual preference control.
