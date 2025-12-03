# AgBot Integration Guide

⚠️ **READ THIS FIRST BEFORE ANY AGBOT WORK** ⚠️

Last Updated: December 3, 2025

---

## Integration Model: PUSH (Webhooks)

### 🚨 CRITICAL WARNING

**AgBot/Gasbot uses WEBHOOK/PUSH model, NOT REST API pull model.**

❌ **DO NOT:**
- Attempt to fetch/pull data from Gasbot
- Create `AtharaAgBotProvider` with `fetchLocations()` methods
- Build sync endpoints that call Gasbot API
- Assume there's a REST API to query

✅ **DO:**
- Receive webhook POST requests from Gasbot
- Process incoming data and store in database
- Query OUR database for analytics
- Use repositories for all database operations

---

## How AgBot Works

### Data Flow

```
Gasbot Dashboard (Their System)
  │
  │ Configured webhook URL + schedule (hourly/daily)
  │
  ├─► HTTP POST (when data changes)
  │
  ▼
api/gasbot-webhook.ts (OUR endpoint)
  │
  ├─► Validates auth (Bearer token)
  ├─► Validates payload
  │
  ▼
AgBotWebhookOrchestrator (Service)
  │
  ├─► GasbotDataTransformer
  ├─► WebhookPayloadValidator
  │
  ▼
Repositories (Data Access)
  │
  ├─► AgBotLocationRepository
  ├─► AgBotAssetRepository
  ├─► ReadingsHistoryRepository
  │
  ▼
PostgreSQL Database (Supabase)
  │
  ├─► ta_agbot_locations
  ├─► ta_agbot_assets
  ├─► ta_agbot_readings
  ├─► ta_agbot_alerts
  └─► ta_agbot_sync_log
```

### Integration Steps

1. **Gasbot Dashboard Configuration:**
   - Navigate to "API Integration" section
   - Enter webhook URL: `https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook`
   - Set authentication: `Bearer FSG-gasbot-webhook-2025`
   - Configure push schedule (hourly recommended)

2. **Data Push:**
   - Gasbot sends HTTP POST to OUR endpoint
   - Can send single object OR array of objects
   - Includes location, asset, device, and reading data

3. **Our Processing:**
   - Validate authentication
   - Transform payload to our data model
   - Upsert locations and assets
   - Insert time-series readings
   - Generate alerts if thresholds exceeded
   - Log sync execution

---

## Webhook Endpoint

### URL
```
Production: https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook
Local Dev: http://localhost:3000/api/gasbot-webhook
```

### Authentication
```http
POST /api/gasbot-webhook HTTP/1.1
Authorization: Bearer FSG-gasbot-webhook-2025
Content-Type: application/json
```

**Environment Variable:** `GASBOT_WEBHOOK_SECRET`
**Default Value:** `FSG-gasbot-webhook-2025` (⚠️ Change in production!)

### HTTP Methods
- **POST** - Receive webhook data (✅ Allowed)
- **GET, PUT, DELETE, PATCH** - (❌ 405 Method Not Allowed)

---

## Webhook Payload Structure

Gasbot sends objects with the following fields:

### Location Fields
```typescript
{
  LocationId: string;                           // Internal numeric ID
  LocationGuid: string;                         // UUID - use as external_guid
  TenancyName: string;                          // Customer name
  LocationAddress: string;                      // Full address
  LocationState: string;                        // State/province
  LocationPostcode: string;                     // Postal code
  LocationCountry: string;                      // Country
  LocationLat: number;                          // Latitude
  LocationLng: number;                          // Longitude
  LocationInstallationStatus: string;           // Installation status
  LocationDisabledStatus: boolean;              // Is location disabled?
  LocationDailyConsumption: number;             // Aggregated consumption (L/day)
  LocationDaysRemaining: number;                // Aggregated days remaining
  LocationCalibratedFillLevel: number;          // Aggregated fill level (%)
  LocationLastCalibratedTelemetryTimestamp: string; // Last telemetry ISO timestamp
  LocationLastCalibratedTelemetryEpoch: number; // Last telemetry epoch
}
```

### Asset (Tank) Fields
```typescript
{
  AssetGuid: string;                            // UUID - use as external_guid
  AssetSerialNumber: string;                    // Tank serial number
  AssetProfileName: string;                     // Commodity name (e.g., "Diesel")
  AssetProfileGuid: string;                     // Profile UUID
  AssetProfileWaterCapacity: number;            // Capacity in liters
  AssetProfileMaxDepth: number;                 // Max depth in meters
  AssetProfileMaxPressureBar: number;           // Max pressure in bar
  AssetReportedLitres: number;                  // Current level in liters
  AssetCalibratedFillLevel: number;             // Current level (%)
  AssetRawFillLevel: number;                    // Raw uncalibrated (%)
  AssetDepth: number;                           // Current depth (m)
  AssetPressureBar: number;                     // Current pressure (bar)
  AssetRefillCapacityLitres: number;            // Ullage (capacity - current)
  AssetDailyConsumption: number;                // Consumption rate (L/day)
  AssetDaysRemaining: number;                   // Days until empty
  AssetDisabledStatus: boolean;                 // Is asset disabled?
  AssetUpdatedTimestamp: string;                // Last update ISO timestamp
  AssetLastCalibratedTelemetryTimestamp: string; // Last telemetry ISO
  AssetLastCalibratedTelemetryEpoch: number;    // Last telemetry epoch
}
```

### Device Fields
```typescript
{
  DeviceGuid: string;                           // Device UUID
  DeviceSerialNumber: string;                   // Device serial number
  DeviceModel: string;                          // Model code
  DeviceModelLabel: string;                     // Human-readable model
  DeviceOnline: boolean;                        // Is device online?
  DeviceState: string;                          // Device state
  DeviceBatteryVoltage: number;                 // Battery voltage (V)
  DeviceTemperature: number;                    // Temperature (°C)
  DeviceActivationTimestamp: string;            // Activation ISO timestamp
  HelmetSerialNumber: string;                   // Helmet serial (if applicable)
}
```

### Example Payload (Single Object)
```json
{
  "LocationGuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "TenancyName": "Acme Fuel Co",
  "LocationAddress": "123 Tank St, Perth WA 6000",
  "LocationLat": -31.9505,
  "LocationLng": 115.8605,
  "LocationCalibratedFillLevel": 67.5,
  "LocationDaysRemaining": 14,
  "AssetGuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "AssetSerialNumber": "TANK-001",
  "AssetProfileName": "Diesel",
  "AssetProfileWaterCapacity": 10000,
  "AssetReportedLitres": 6750,
  "AssetCalibratedFillLevel": 67.5,
  "AssetDailyConsumption": 482,
  "AssetDaysRemaining": 14,
  "DeviceSerialNumber": "DEV-12345",
  "DeviceOnline": true,
  "DeviceBatteryVoltage": 3.7,
  "DeviceTemperature": 28.5
}
```

### Example Payload (Array)
```json
[
  { "LocationGuid": "...", "AssetGuid": "...", ... },
  { "LocationGuid": "...", "AssetGuid": "...", ... }
]
```

---

## Database Tables

### ta_agbot_locations (43 columns)
**Purpose:** Customer sites with aggregated metrics

**Key Columns:**
- `id` (UUID, PK) - Internal ID
- `external_guid` (UUID, UNIQUE) - LocationGuid from Gasbot
- `name` - Location address
- `customer_name` - TenancyName from Gasbot
- `address`, `latitude`, `longitude` - Location details
- `calibrated_fill_level` - Aggregated fill level (%)
- `last_telemetry_at` - Last data received timestamp
- `is_disabled` - Location disabled status

**Indexes:**
- Primary key on `id`
- Unique index on `external_guid`
- Index on `customer_name` for filtering

### ta_agbot_assets (61 columns)
**Purpose:** Tanks/devices with full telemetry

**Key Columns:**
- `id` (UUID, PK) - Internal ID
- `location_id` (UUID, FK) - References ta_agbot_locations
- `external_guid` (UUID, UNIQUE) - AssetGuid from Gasbot
- `serial_number` - Tank serial number
- `device_serial` - Device serial number
- `commodity` - Fuel type (Diesel, Petrol, etc.)
- `capacity_liters` - Tank capacity
- `current_level_liters` - Current fuel level (L)
- `current_level_percent` - Current fuel level (%)
- `daily_consumption_liters` - Consumption rate
- `days_remaining` - Days until empty
- `is_online` - Device online status
- `battery_voltage` - Battery level (V)
- `temperature_c` - Temperature (°C)
- `last_telemetry_at` - Last reading timestamp
- `raw_webhook_data` (JSONB) - Original payload for audit

**Indexes:**
- Primary key on `id`
- Foreign key on `location_id`
- Unique index on `external_guid`
- Index on `location_id, is_online` for queries

### ta_agbot_readings (15 columns)
**Purpose:** Time-series historical snapshots

**Key Columns:**
- `id` (UUID, PK) - Internal ID
- `asset_id` (UUID, FK) - References ta_agbot_assets
- `level_liters` - Level at snapshot (L)
- `level_percent` - Level at snapshot (%)
- `is_online` - Online status at snapshot
- `battery_voltage` - Battery at snapshot (V)
- `temperature_c` - Temperature at snapshot (°C)
- `device_state` - Device state at snapshot
- `daily_consumption` - Consumption at snapshot (L/day)
- `days_remaining` - Days remaining at snapshot
- `reading_at` (TIMESTAMP) - Reading timestamp
- `created_at` (TIMESTAMP) - Record creation timestamp

**Indexes:**
- Primary key on `id`
- Foreign key on `asset_id`
- Index on `asset_id, reading_at` for time-series queries

### ta_agbot_alerts (11 columns)
**Purpose:** Alert records for thresholds

**Key Columns:**
- `id` (UUID, PK) - Internal ID
- `asset_id` (UUID, FK) - References ta_agbot_assets
- `alert_type` - Type: 'low_battery' | 'low_fuel' | 'device_offline'
- `severity` - Severity: 'warning' | 'critical'
- `title` - Alert title
- `message` - Alert message
- `current_value` - Value that triggered alert
- `threshold_value` - Threshold that was exceeded
- `is_active` (BOOLEAN) - Is alert still active?
- `triggered_at` (TIMESTAMP) - When alert triggered
- `resolved_at` (TIMESTAMP) - When alert resolved (if any)

**Indexes:**
- Primary key on `id`
- Foreign key on `asset_id`
- Index on `asset_id, is_active` for active alerts

### ta_agbot_sync_log (10 columns)
**Purpose:** Webhook execution audit trail

**Key Columns:**
- `id` (UUID, PK) - Internal ID
- `sync_type` - Always 'gasbot_webhook'
- `status` - 'success' | 'partial' | 'error'
- `locations_processed` - Count of locations
- `assets_processed` - Count of assets
- `readings_processed` - Count of readings
- `alerts_triggered` - Count of alerts generated
- `error_message` - Error details (if any)
- `duration_ms` - Execution time (ms)
- `started_at`, `completed_at` - Timestamps

**Indexes:**
- Primary key on `id`
- Index on `started_at` for log queries

---

## Alert Types & Thresholds

### Low Battery Alert
**Trigger Conditions:**
- **Warning:** Battery voltage < 3.3V
- **Critical:** Battery voltage < 3.2V

**Alert Message:**
```
"Battery voltage low (3.1V) - threshold 3.3V"
```

### Low Fuel Alert
**Trigger Conditions:**
- **Warning:** Days remaining ≤ 7 days OR Fill level ≤ 15%
- **Critical:** Days remaining ≤ 3 days OR Fill level ≤ 10%

**Alert Message:**
```
"Fuel level low (8%) - refill needed within 4 days"
```

### Device Offline Alert
**Trigger Conditions:**
- Previous state: `is_online = true`
- Current state: `is_online = false`

**Alert Message:**
```
"Device went offline - last seen at 2025-12-03 14:30"
```

### Alert Deduplication
Alerts are deduplicated by checking for existing active alerts:
- Query: `SELECT * FROM ta_agbot_alerts WHERE asset_id = ? AND alert_type = ? AND is_active = true`
- If active alert exists, skip creation
- No cooldown period (immediate re-alerting if resolved then re-triggered)

---

## Timestamp Handling

### Perth Timezone (AWST/AWDT)
Gasbot operates in Perth, Western Australia:
- **AWST (Australian Western Standard Time):** UTC+8 (no daylight saving)
- **AWDT (Australian Western Daylight Time):** UTC+9 (historical, not used since 2009)

### Conversion Requirements
**Storage:** All timestamps MUST be stored as UTC in PostgreSQL
**Display:** Convert to user's local timezone in frontend

### Timestamp Formats

**ISO 8601 String:**
```
"2025-12-03T14:30:00.000Z"  // UTC
"2025-12-03T22:30:00.000+0800"  // Perth (AWST)
```

**Epoch (Unix Timestamp):**
```
1733238600  // Seconds since 1970-01-01 00:00:00 UTC
```

**BigInt (PostgreSQL):**
```sql
CREATE TABLE example (
  telemetry_epoch BIGINT
);
```

### Timestamp Utility
Use `TimestampNormalizer` utility for conversions:
```typescript
import { TimestampNormalizer } from './lib/timestamp-normalizer';

// Convert Perth time to UTC
const utcIso = TimestampNormalizer.perthToUTC("2025-12-03T22:30:00+0800");
// => "2025-12-03T14:30:00.000Z"

// Convert epoch to bigint for database
const bigintEpoch = TimestampNormalizer.epochToBigInt(1733238600);
// => 1733238600n

// Validate timestamp format
const isValid = TimestampNormalizer.validateTimestamp("2025-12-03T14:30:00.000Z");
// => true
```

---

## Architecture Layers

### Controller Layer
**File:** `api/controllers/AgBotWebhookController.ts`
**Purpose:** HTTP request/response handling

**Responsibilities:**
- Validate Bearer token authentication
- Check HTTP method (POST only)
- Delegate to orchestrator
- Format response

**Methods:**
- `handleWebhook(req, res)` - Main webhook handler
- `isAuthorized(req)` - Auth validation

### Service Layer (Orchestration)
**File:** `api/services/AgBotWebhookOrchestrator.ts`
**Purpose:** Coordinate webhook processing flow

**Responsibilities:**
- Validate payload structure
- Transform data
- Coordinate repositories
- Generate alerts
- Calculate consumption
- Log execution

**Methods:**
- `processWebhook(payload)` - Main orchestration
- `processRecord(record, result)` - Process single tank

### Service Layer (Transformation)
**File:** `api/services/GasbotDataTransformer.ts`
**Purpose:** Transform Gasbot payload to repository inputs

**Responsibilities:**
- Map Gasbot fields to our database fields
- Normalize timestamps
- Calculate derived fields (percentages, ullage)

**Methods:**
- `transformLocation(gasbotData)` - Location transformation
- `transformAsset(gasbotData, locationId)` - Asset transformation
- `transformReading(gasbotData, assetId)` - Reading transformation

### Service Layer (Validation)
**File:** `api/services/WebhookPayloadValidator.ts`
**Purpose:** Validate incoming payloads

**Responsibilities:**
- Check required fields present
- Validate field types
- Detect malformed data

**Methods:**
- `validatePayload(payload)` - Main validation
- `validateLocationFields(data)` - Location validation
- `validateAssetFields(data)` - Asset validation

### Service Layer (Alerts)
**File:** `api/services/AlertGenerationService.ts`
**Purpose:** Generate alerts based on thresholds

**Responsibilities:**
- Check low battery conditions
- Check low fuel conditions
- Detect device offline transitions
- Deduplicate alerts

**Methods:**
- `checkAndCreateAlerts(asset, previousAsset)` - Check all conditions
- `createBatteryAlert(asset)` - Battery alert
- `createFuelAlert(asset)` - Fuel alert
- `createOfflineAlert(asset)` - Offline alert
- `deduplicateAlert(alert)` - Check for existing active alert

**Configuration:**
```typescript
interface AlertThresholds {
  batteryWarning: 3.3,      // Volts
  batteryCritical: 3.2,     // Volts
  fuelDaysWarning: 7,       // Days
  fuelDaysCritical: 3,      // Days
  fuelPercentWarning: 15,   // Percent
  fuelPercentCritical: 10   // Percent
}
```

### Service Layer (Analytics)
**File:** `api/services/ConsumptionAnalysisService.ts`
**Purpose:** Statistical analysis of consumption

**Responsibilities:**
- Linear regression for trends
- Daily consumption rate calculation
- Days remaining forecasting
- Refill event detection

**Methods:**
- `calculateConsumption(assetId, currentLevel, tankCapacity)` - Main calculation
- `recalculateAll()` - Batch recalculation
- `detectRefillEvents(assetId, days)` - Refill detection

### Repository Layer
**Files:**
- `api/repositories/AgBotLocationRepository.ts` (13 methods)
- `api/repositories/AgBotAssetRepository.ts` (15 methods)
- `api/repositories/ReadingsHistoryRepository.ts` (14 methods)

**Purpose:** Data access abstraction (zero business logic)

**Pattern:** All database queries isolated in repositories
- Controllers/services never write SQL
- Easy to swap database implementations
- Testable with mocks

---

## Testing Strategy

### Unit Tests
**Test without database or external API calls**

**Mock Webhook Payload:**
```typescript
const mockPayload = {
  LocationGuid: 'test-loc-uuid',
  TenancyName: 'Test Customer',
  AssetGuid: 'test-asset-uuid',
  AssetReportedLitres: 5000,
  DeviceOnline: true,
  // ... all required fields
};
```

**Mock Repositories:**
```typescript
const mockLocationRepo = {
  upsert: jest.fn().mockResolvedValue({ id: 'mock-id' }),
  findByExternalGuid: jest.fn().mockResolvedValue(null),
};
```

**Example Test:**
```typescript
describe('GasbotDataTransformer', () => {
  it('transforms location data correctly', () => {
    const transformer = new GasbotDataTransformer();
    const result = transformer.transformLocation(mockPayload);

    expect(result.external_guid).toBe('test-loc-uuid');
    expect(result.name).toBe(mockPayload.LocationAddress);
    expect(result.customer_name).toBe('Test Customer');
  });
});
```

### Integration Tests
**Test webhook endpoint with mock payload**

```typescript
describe('gasbot-webhook endpoint', () => {
  it('processes valid webhook POST successfully', async () => {
    const response = await fetch('http://localhost:3000/api/gasbot-webhook', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer FSG-gasbot-webhook-2025',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockPayload),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.processed).toBe(1);
  });

  it('rejects unauthorized requests', async () => {
    const response = await fetch('http://localhost:3000/api/gasbot-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockPayload),
    });

    expect(response.status).toBe(401);
  });
});
```

---

## Common Mistakes to Avoid

### ❌ MISTAKE 1: Building a Pull/Sync Model
```typescript
// WRONG - No pull API exists!
class AtharaAgBotProvider {
  async fetchLocations() {
    const response = await fetch('https://api.athara.io/locations');
    // This API does not exist!
  }
}
```

**Why Wrong:** Gasbot doesn't have a REST API for querying data. They only push via webhooks.

### ❌ MISTAKE 2: Creating Sync Endpoints
```typescript
// WRONG - No sync needed with webhooks!
export default async function syncHandler(req, res) {
  const locations = await provider.fetchLocations();
  // This will fail - no API to fetch from
}
```

**Why Wrong:** With webhooks, THEY call US. We don't call them.

### ❌ MISTAKE 3: Direct Database Queries in Endpoints
```typescript
// WRONG - Business logic in endpoint!
export default async function handler(req, res) {
  const { data } = await supabase
    .from('ta_agbot_locations')
    .select('*');
  // Should use repository!
}
```

**Why Wrong:** Violates separation of concerns. Use repositories.

### ✅ CORRECT PATTERN: Webhook-Based Architecture
```typescript
// Gasbot webhook.ts endpoint
export default async function handler(req, res) {
  const controller = new AgBotWebhookController(orchestrator);
  return controller.handleWebhook(req, res);
}

// AgBot analytics endpoint
export default async function handler(req, res) {
  const analyticsService = new AgBotAnalyticsService(repos...);
  const summary = await analyticsService.getFleetSummary();
  return res.json(summary);
}
```

---

## FAQ

### Q: Can I query Gasbot's API for historical data?
**A:** No. Gasbot only provides webhook pushes. Historical data must be stored in OUR database from webhook receipts.

### Q: What if we miss a webhook?
**A:** Webhooks are fire-and-forget. If missed, data is lost unless Gasbot resends. Configure reliable webhook URL with monitoring.

### Q: Can I trigger a manual sync?
**A:** No. There's no pull API. You can only wait for next scheduled webhook from Gasbot.

### Q: How often does Gasbot send webhooks?
**A:** Configurable in Gasbot dashboard. Typical: hourly or daily. Check with Gasbot support for your plan.

### Q: What if the webhook endpoint is down?
**A:** Gasbot may retry a few times, but data will be lost if all retries fail. Ensure high availability.

### Q: Can I get real-time data?
**A:** Only as "real-time" as Gasbot's webhook schedule allows (typically hourly). Not sub-second updates.

---

## Support & Resources

### Internal Documentation
- **This file:** `docs/AgBot.md` (integration guide)
- **Database schema:** `database/migrations/create_ta_unified_schema.sql`
- **Webhook endpoint:** `api/gasbot-webhook.ts`

### External Resources
- **Gasbot Dashboard:** (Provide URL from customer)
- **Gasbot Support:** (Provide contact from customer)
- **Webhook Logs:** Query `ta_agbot_sync_log` table

### Monitoring
```sql
-- Check recent webhook executions
SELECT * FROM ta_agbot_sync_log
ORDER BY started_at DESC
LIMIT 10;

-- Check webhook success rate (last 24 hours)
SELECT
  status,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration_ms
FROM ta_agbot_sync_log
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

---

## Changelog

### 2025-12-03
- Initial documentation created
- Documented webhook-based architecture
- Added critical warnings about pull model
- Included payload structure and table mappings
- Added testing strategy and common mistakes

---

**Remember: ALWAYS read this document BEFORE working on AgBot features!**
