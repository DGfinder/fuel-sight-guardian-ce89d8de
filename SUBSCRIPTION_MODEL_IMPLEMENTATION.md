# Subscription Model Implementation

## Overview

The email notification system has been upgraded from a **contact-based model** to a **subscription-based model**. This allows multiple email contacts to subscribe to the same tank with independent notification settings.

## Problem Solved

**Before**: When a contact was subscribed to multiple tanks, they received all tanks in one email with the same settings (frequency, send time, alert thresholds).

**After**: Each contact-tank pair is now an independent subscription with its own settings. One contact can subscribe to multiple tanks with different frequencies, send times, and alert thresholds for each tank.

## Database Schema Changes

### Migration: `add_subscription_level_settings`

Added the following columns to `customer_contact_tanks`:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `report_frequency` | TEXT | 'daily' | How often to send reports (daily/weekly/monthly) |
| `preferred_send_hour` | INTEGER | 7 | Hour of day to send (0-23, Perth time) |
| `enabled` | BOOLEAN | true | Active/inactive subscription |
| `alert_threshold_percent` | INTEGER | 30 | Custom low-fuel alert level (0-100%) |
| `cc_emails` | TEXT | NULL | Comma-separated CC addresses for this subscription |
| `last_email_sent_at` | TIMESTAMPTZ | NULL | Last time email was sent for this subscription |
| `updated_at` | TIMESTAMPTZ | NOW() | Last time subscription was modified |

### Data Migration

Existing data was automatically migrated from `customer_contacts` to `customer_contact_tanks`:
- All existing subscriptions inherited their contact's settings
- No data was lost
- No interruption to existing email reports

### Indexes Added

```sql
CREATE INDEX idx_contact_tanks_enabled_send_hour
  ON customer_contact_tanks(enabled, preferred_send_hour)
  WHERE enabled = true;

CREATE INDEX idx_contact_tanks_last_email_sent
  ON customer_contact_tanks(last_email_sent_at);
```

These optimize the cron job queries that run hourly.

## Code Architecture

### New Files Created

1. **`api/repositories/SubscriptionRepository.ts`** (337 lines)
   - Data access layer for subscriptions
   - Handles all queries involving `customer_contact_tanks`
   - Automatically filters out disabled tanks and offline assets
   - Key methods:
     - `findByPreferredHour(hour)` - Get all subscriptions for a specific hour
     - `findByContactId(contactId)` - Get all subscriptions for a contact
     - `findByTankId(tankId)` - Get all subscriptions for a tank
     - `updateLastEmailSent(subscriptionId, timestamp)` - Track when email was sent
     - `updateSettings(subscriptionId, settings)` - Update subscription settings

### Updated Files

2. **`api/services/EmailService.ts`**
   - Added `sendScheduledReportsV2()` - New subscription-based cron entry point
   - Added `sendSubscriptionEmail()` - Send email for one subscription
   - Added `batchSendSubscriptionEmails()` - Process subscriptions in batches
   - Added `filterSubscriptionsByFrequency()` - Filter by daily/weekly/monthly
   - Old methods preserved for backward compatibility

3. **`api/controllers/EmailController.ts`**
   - Initializes `SubscriptionRepository`
   - Passes it to `EmailService`
   - Updated `sendScheduledReports()` to call `sendScheduledReportsV2()`

## How It Works

### Before (Contact-Based)

```
Cron Job (7:00 AM)
  → Find contacts with preferred_send_hour = 7
  → For each contact:
      → Find ALL tanks for that contact
      → Send ONE email with ALL tanks
      → Use contact-level settings (frequency, CC, etc.)
```

**Issue**: Contact subscribed to 10 tanks → gets all 10 tanks in one email, same settings.

### After (Subscription-Based)

```
Cron Job (7:00 AM)
  → Find subscriptions with preferred_send_hour = 7
  → For each subscription (contact + tank pair):
      → Send ONE email with ONE tank
      → Use subscription-level settings
      → Each subscription can have different:
          - Frequency (daily/weekly/monthly)
          - Send hour (0-23)
          - Alert threshold (30% by default, customizable)
          - CC recipients
          - Enabled/disabled status
```

**Benefit**: Contact can subscribe to Tank A (daily at 7am, 30% threshold) and Tank B (weekly at 9am, 20% threshold).

## Benefits

### 1. **Independent Settings Per Tank**
```sql
-- Example: Different settings for same contact, different tanks

-- Subscription 1: Contact X → Tank A
report_frequency = 'daily'
preferred_send_hour = 7
alert_threshold_percent = 30

-- Subscription 2: Contact X → Tank B
report_frequency = 'weekly'
preferred_send_hour = 9
alert_threshold_percent = 20
```

### 2. **Eliminates Duplicate Tanks in UI**
**Before**: Indosolutions tank appeared twice because two contacts were subscribed to it

**After**: Each subscription is a separate row in the UI. Same tank can have multiple subscriptions with different settings.

### 3. **Fine-Grained Control**
- Different alert thresholds per tank
- Different CC recipients per tank
- Enable/disable specific subscriptions without affecting others
- Track last email sent per subscription (not per contact)

### 4. **Better Scalability**
- Subscriptions can be queried efficiently by hour
- Each subscription processes independently
- Failed subscription doesn't affect others
- Easy to add new settings (SMS, Slack, etc.) per subscription

## Example Use Cases

### Use Case 1: Fleet Manager
**Scenario**: Fleet manager wants daily updates on critical tanks but weekly updates on non-critical tanks.

**Solution**:
```
Contact: fleet@company.com

Subscriptions:
1. Tank: Wonder Main (117,000L) - Daily at 7am, 20% threshold
2. Tank: Wonder Genset (5,000L) - Weekly at 7am, 30% threshold
3. Tank: Workshop Diesel - Daily at 7am, 15% threshold
```

### Use Case 2: Multiple Managers
**Scenario**: Two managers need reports for the same tank but at different times.

**Solution**:
```
Tank: Indosolutions Main Tank

Subscriptions:
1. Contact: manager1@company.com - Daily at 7am
2. Contact: manager2@company.com - Daily at 9am
```

### Use Case 3: Critical vs Non-Critical
**Scenario**: Different alert thresholds for different tank types.

**Solution**:
```
Contact: ops@company.com

Subscriptions:
1. Tank: Generator (critical) - 40% threshold (alert early)
2. Tank: Heating Oil (non-critical) - 15% threshold (alert late)
```

## Migration Path

### Phase 1: ✅ COMPLETED - Database Schema
- ✅ Added columns to `customer_contact_tanks`
- ✅ Migrated existing data
- ✅ Added indexes

### Phase 2: ✅ COMPLETED - Backend Implementation
- ✅ Created `SubscriptionRepository`
- ✅ Updated `EmailService` with subscription methods
- ✅ Updated `EmailController` to use subscriptions
- ✅ Build passes with no errors

### Phase 3: 🔄 PENDING - Frontend UI Update
The admin UI (`CustomerContactsAdmin.tsx`) currently manages contact-level settings. It needs to be updated to:
- Show subscriptions instead of contacts
- Allow editing subscription-level settings
- Support creating/deleting subscriptions
- Show which tanks a contact is subscribed to

### Phase 4: 🔄 PENDING - Testing
- Test cron job with new subscription-based logic
- Verify emails are sent correctly
- Verify no duplicate emails
- Verify subscription settings are respected

## API Examples

### Get all subscriptions for a contact
```typescript
const subscriptions = await subscriptionRepo.findByContactId(contactId);
// Returns: [
//   { tank: "Wonder Main", frequency: "daily", send_hour: 7, ... },
//   { tank: "Wonder Genset", frequency: "weekly", send_hour: 7, ... }
// ]
```

### Update subscription settings
```typescript
await subscriptionRepo.updateSettings(subscriptionId, {
  report_frequency: 'weekly',
  preferred_send_hour: 9,
  alert_threshold_percent: 25
});
```

### Disable a subscription
```typescript
await subscriptionRepo.disable(subscriptionId);
```

## Backward Compatibility

The old contact-based methods are **still available**:
- `emailService.sendScheduledReports(hour)` - Contact-based (deprecated)
- `emailService.sendEmail(options)` - Single contact email (still used by test endpoint)

This allows gradual migration and rollback if needed.

## Next Steps

1. **Update Frontend UI** - Modify `CustomerContactsAdmin.tsx` to manage subscriptions
2. **Test in Production** - Monitor logs for the next scheduled run
3. **Verify Metrics** - Check that email counts match expected subscriptions
4. **Document for Users** - Create user guide for managing subscriptions

## Database Query Reference

### Find all subscriptions for hour 7
```sql
SELECT
  cct.id,
  cc.contact_email,
  tal.name as tank_name,
  cct.report_frequency,
  cct.alert_threshold_percent
FROM customer_contact_tanks cct
JOIN customer_contacts cc ON cct.customer_contact_id = cc.id
JOIN ta_agbot_locations tal ON cct.agbot_location_id = tal.id
WHERE cct.enabled = true
  AND cct.preferred_send_hour = 7
  AND cc.enabled = true
  AND tal.is_disabled = false;
```

### Count subscriptions by frequency
```sql
SELECT report_frequency, COUNT(*) as count
FROM customer_contact_tanks
WHERE enabled = true
GROUP BY report_frequency;
```

## Summary

The subscription model provides:
- **Flexibility**: Different settings per tank
- **Clarity**: No more duplicate tanks in UI
- **Control**: Enable/disable individual subscriptions
- **Scalability**: Easy to add new notification types

This solves the Indosolutions duplicate issue and provides a foundation for future enhancements like SMS notifications, Slack alerts, and custom report formats per subscription.
