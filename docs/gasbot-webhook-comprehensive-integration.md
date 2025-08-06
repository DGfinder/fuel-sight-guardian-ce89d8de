# Gasbot Webhook Comprehensive Integration

## Overview

The enhanced Gasbot webhook integration captures comprehensive fuel monitoring data from the Gasbot API, including location details, asset information, device telemetry, and operational metrics.

## Webhook Configuration

### Endpoint Details
- **URL:** `https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook`
- **Method:** POST
- **Authentication:** Bearer token
- **Content-Type:** application/json

### Authentication
```bash
Authorization: Bearer FSG-gasbot-webhook-2025
```

## Data Structure

### Location Fields Captured
| Field | Database Column | Type | Description |
|-------|----------------|------|-------------|
| `LocationId` | `location_id` | TEXT | Location identifier |
| `LocationAddress` | `address1, address2, state, postcode` | TEXT | Parsed address components |
| `LocationCategory` | `location_category` | TEXT | Location type (Agricultural, Mining, etc.) |
| `LocationCalibratedFillLevel` | `location_calibrated_fill_level` | DECIMAL(5,2) | Overall location fill percentage |
| `LocationLastCalibratedTelemetryTimestamp` | `location_last_calibrated_telemetry_timestamp` | TIMESTAMPTZ | Last calibrated reading time |
| `LocationDisabledStatus` | `location_disabled_status` | BOOLEAN | Location operational status |
| `LocationDailyConsumption` | `location_daily_consumption` | DECIMAL(10,2) | Daily fuel consumption rate |
| `LocationDaysRemaining` | `location_days_remaining` | INT | Estimated days until empty |
| `LocationLat/LocationLng` | `lat/lng` | DECIMAL | GPS coordinates |
| `LocationGuid` | `location_guid_external` | TEXT | External GUID from API |
| `TenancyName` | `tenancy_name` | TEXT | Customer/tenancy name |

### Asset Fields Captured
| Field | Database Column | Type | Description |
|-------|----------------|------|-------------|
| `AssetSerialNumber` | `asset_serial_number` | TEXT | Tank serial number |
| `AssetRawFillLevel` | `asset_raw_fill_level` | DECIMAL(5,2) | Raw sensor reading |
| `AssetCalibratedFillLevel` | `latest_calibrated_fill_percentage` | DECIMAL(5,2) | Calibrated fill percentage |
| `AssetReportedLitres` | `asset_reported_litres` | DECIMAL(10,2) | Current volume in litres |
| `AssetDailyConsumption` | `asset_daily_consumption` | DECIMAL(10,2) | Asset-specific consumption |
| `AssetDaysRemaining` | `asset_days_remaining` | INT | Days until asset empty |
| `AssetDepth` | `asset_depth` | DECIMAL(8,2) | Current fuel depth |
| `AssetPressure` | `asset_pressure` | DECIMAL(8,2) | Tank pressure |
| `AssetPressureBar` | `asset_pressure_bar` | DECIMAL(8,2) | Pressure in bar |
| `AssetRefillCapacityLitres` | `asset_refill_capacity_litres` | DECIMAL(10,2) | Tank capacity |
| `AssetProfileName` | `asset_profile_name` | TEXT | Tank profile name |
| `AssetProfileWaterCapacity` | `asset_profile_water_capacity` | DECIMAL(10,2) | Water equivalent capacity |
| `AssetProfileCommodity` | `asset_profile_commodity` | TEXT | Fuel type (Diesel, Petrol, etc.) |

### Device Fields Captured
| Field | Database Column | Type | Description |
|-------|----------------|------|-------------|
| `DeviceSerialNumber` | `device_serial_number` | TEXT | Device serial number |
| `DeviceGuid` | `device_guid` | TEXT | Device GUID |
| `DeviceSKU` | `device_sku` | TEXT | Device model/SKU |
| `DeviceBatteryVoltage` | `device_battery_voltage` | DECIMAL(5,2) | Battery voltage for health monitoring |
| `DeviceTemperature` | `device_temperature` | DECIMAL(5,2) | Device temperature |
| `DeviceState` | `device_state` | TEXT | Device operational state |
| `DeviceOnline` | `device_online` | BOOLEAN | Online status |
| `DeviceModel` | `device_model` | INT | Device model number |
| `DeviceNetworkId` | `device_network_id` | TEXT | Network identifier |

### Other Fields
| Field | Database Column | Type | Description |
|-------|----------------|------|-------------|
| `HelmetSerialNumber` | `helmet_serial_number` | TEXT | Associated helmet device |

## Database Schema

### Tables Updated
1. **agbot_locations** - Enhanced with location-specific fields
2. **agbot_assets** - Comprehensive asset and device data
3. **agbot_readings_history** - Historical data with all metrics
4. **agbot_sync_logs** - Integration monitoring

### Key Enhancements
- **Battery Monitoring:** `device_battery_voltage` for device health alerts
- **Volume Tracking:** `asset_reported_litres` for precise fuel measurements
- **Consumption Analytics:** Daily consumption rates and remaining days
- **Pressure Monitoring:** Tank pressure for safety monitoring
- **Device Health:** Temperature and state tracking

## API Integration Features

### Data Processing
- **Address Parsing:** Automatic extraction of address components
- **Coordinate Mapping:** GPS coordinates for location services
- **Unit Conversion:** Handles both percentage and litre measurements
- **State Tracking:** Device operational states and health metrics

### Error Handling
- Individual record error isolation
- Comprehensive logging and monitoring
- Partial success handling for bulk updates
- Detailed error reporting in sync logs

### Performance Optimizations
- Bulk upsert operations for efficiency
- Indexed columns for fast queries
- Separate tables to avoid conflicts with manual readings

## Testing

### Test Script
```bash
./test/test-gasbot-webhook.sh
```

### Manual Testing
```bash
curl -X POST https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook \
  -H "Authorization: Bearer FSG-gasbot-webhook-2025" \
  -H "Content-Type: application/json" \
  -d @test/gasbot-webhook-comprehensive-test.json
```

## Monitoring

### Webhook Logs
- Real-time processing logs in Vercel dashboard
- Detailed field-by-field processing information
- Error tracking and performance metrics

### Database Monitoring
```sql
-- Check recent webhook activity
SELECT * FROM agbot_sync_logs 
WHERE sync_type = 'gasbot_webhook' 
ORDER BY started_at DESC LIMIT 10;

-- Monitor device health
SELECT 
  location_id,
  asset_serial_number,
  device_battery_voltage,
  device_state,
  device_online
FROM agbot_assets 
WHERE device_battery_voltage < 3.5 OR device_online = false;

-- Track consumption rates
SELECT 
  asset_serial_number,
  asset_daily_consumption,
  asset_days_remaining,
  asset_reported_litres
FROM agbot_assets 
WHERE asset_days_remaining < 5;
```

## Migration Steps

1. **Apply Database Schema:**
   ```sql
   \i database/migrations/enhance_agbot_comprehensive_data.sql
   ```

2. **Deploy Updated Webhook:**
   - Webhook code automatically handles new fields
   - Backward compatible with existing data

3. **Configure Gasbot Dashboard:**
   - Update webhook URL with comprehensive data payload
   - Ensure all new fields are included in API export

4. **Validate Integration:**
   - Run test script to verify functionality
   - Monitor initial webhook calls for data completeness

## Benefits

### Operational Insights
- **Device Health:** Battery voltage monitoring for proactive maintenance
- **Consumption Analytics:** Daily usage patterns and forecasting
- **Location Intelligence:** GPS tracking and address management
- **Safety Monitoring:** Pressure and temperature alerts

### Data Quality
- **Raw vs Calibrated:** Compare sensor accuracy
- **Volume Precision:** Litre measurements for exact calculations
- **State Tracking:** Detailed device operational status
- **Historical Trends:** Comprehensive time-series data

### Integration Capabilities
- **Multi-vendor Support:** Consistent data model across providers
- **Real-time Updates:** Hourly automated data synchronization
- **Scalable Architecture:** Handles growing fleet sizes
- **Monitoring & Alerting:** Built-in health checks and notifications