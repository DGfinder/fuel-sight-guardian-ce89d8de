// Gasbot Webhook Endpoint
// This endpoint receives hourly JSON data from Gasbot dashboard
// URL: https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook

import { createClient } from '@supabase/supabase-js';
import { calculateConsumption, updateAssetConsumption } from './lib/consumption-calculator.js';

// Perth timezone constants and utilities
const PERTH_TIMEZONE = 'Australia/Perth';

/**
 * Validate and normalize timestamp to Perth timezone
 * Handles common data quality issues with incoming timestamps
 */
function validateAndNormalizeTimestamp(timestamp, fieldName = 'timestamp') {
  if (!timestamp) {
    console.warn(`⚠️  Empty ${fieldName}, using current time`);
    return new Date().toISOString();
  }
  
  try {
    let date;
    
    // Handle different input formats
    if (typeof timestamp === 'number') {
      // Epoch timestamp - could be seconds or milliseconds
      date = timestamp > 1000000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      throw new Error('Invalid timestamp type');
    }
    
    // Validate the date is reasonable
    const now = new Date();
    const year = date.getFullYear();
    const minutesDiff = (now.getTime() - date.getTime()) / (1000 * 60);
    
    // Check for obvious data quality issues
    if (isNaN(date.getTime())) {
      console.error(`🚫 Invalid ${fieldName}: ${timestamp}`);
      return new Date().toISOString();
    }
    
    if (year < 2020 || year > now.getFullYear() + 1) {
      console.warn(`⚠️  Suspicious year in ${fieldName}: ${year} from ${timestamp}`);
    }
    
    if (minutesDiff < -60) { // More than 1 hour in the future
      console.warn(`⚠️  Future ${fieldName}: ${timestamp} (${Math.abs(minutesDiff).toFixed(0)} min ahead)`);
    }
    
    if (minutesDiff > 7 * 24 * 60) { // More than 1 week old
      console.warn(`⚠️  Very old ${fieldName}: ${timestamp} (${(minutesDiff / (24 * 60)).toFixed(0)} days old)`);
    }
    
    // Return normalized ISO string
    return date.toISOString();
    
  } catch (error) {
    console.error(`🚫 Failed to parse ${fieldName}: ${timestamp}`, error.message);
    return new Date().toISOString();
  }
}

/**
 * Log data quality issues for monitoring
 */
function logDataQuality(locationId, issues) {
  if (issues.length > 0) {
    console.warn(`⚠️  Data quality issues for ${locationId}:`, issues);
    // Could add to monitoring/alerting system here
  }
}

/**
 * Safely convert epoch timestamp to integer for bigint fields
 * Handles decimal values by flooring them
 */
function convertEpochToBigInt(value) {
  if (!value) return null;
  try {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return null;
    return Math.floor(parsed);
  } catch (error) {
    console.warn(`⚠️  Failed to convert epoch value: ${value}`);
    return null;
  }
}

// Initialize Supabase client for webhook operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // This is actually the service role key for backend operations
const supabase = createClient(supabaseUrl, supabaseKey);

// Webhook authentication secret
const WEBHOOK_SECRET = process.env.GASBOT_WEBHOOK_SECRET || 'FSG-gasbot-webhook-2025';

// Transform Gasbot webhook data to ta_agbot_locations format
function transformGasbotLocationData(gasbotData) {
  // Use external LocationGuid if available, otherwise generate from location name
  const externalGuid = gasbotData.LocationGuid ||
    `location-${(gasbotData.LocationId || 'unknown').replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;

  // Parse address into components if available
  const addressParts = (gasbotData.LocationAddress || '').split(',').map(part => part.trim());

  return {
    external_guid: externalGuid,
    name: gasbotData.LocationId || 'Unknown Location',
    customer_name: gasbotData.TenancyName || 'Unknown Customer',
    customer_guid: gasbotData.CustomerGuid || `customer-${gasbotData.TenancyName?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`,
    tenancy_name: gasbotData.TenancyName,

    // Address fields
    address: gasbotData.LocationAddress || addressParts[0] || '',
    state: addressParts.length >= 3 ? addressParts[2] : (gasbotData.LocationState || ''),
    postcode: addressParts.length >= 4 ? addressParts[3] : (gasbotData.LocationPostcode || ''),
    country: gasbotData.LocationCountry || 'Australia',
    latitude: parseFloat(gasbotData.LocationLat) || null,
    longitude: parseFloat(gasbotData.LocationLng) || null,

    // Status
    installation_status: gasbotData.LocationInstallationStatus || (gasbotData.DeviceOnline ? 1 : 0),
    installation_status_label: gasbotData.DeviceOnline ? 'Active' : 'Offline',
    is_disabled: gasbotData.LocationDisabledStatus || false,

    // Aggregated consumption (from webhook)
    daily_consumption_liters: parseFloat(gasbotData.LocationDailyConsumption) || null,
    days_remaining: parseInt(gasbotData.LocationDaysRemaining) || null,
    calibrated_fill_level: parseFloat(gasbotData.LocationCalibratedFillLevel) || null,

    // Timestamps
    last_telemetry_at: validateAndNormalizeTimestamp(
      gasbotData.LocationLastCalibratedTelemetryTimestamp || gasbotData.AssetLastCalibratedTelemetryTimestamp,
      'last_telemetry_at'
    ),
    last_telemetry_epoch: convertEpochToBigInt(gasbotData.LocationLastCalibratedTelemetryEpoch) ||
      (gasbotData.LocationLastCalibratedTelemetryTimestamp ?
        Math.floor(new Date(validateAndNormalizeTimestamp(gasbotData.LocationLastCalibratedTelemetryTimestamp, 'last_telemetry_epoch')).getTime()) : Date.now())
  };
}

// Transform Gasbot webhook data to ta_agbot_assets format
function transformGasbotAssetData(gasbotData, locationId) {
  // Use external AssetGuid if available, otherwise generate from serial
  const externalGuid = gasbotData.AssetGuid ||
    `asset-${(gasbotData.AssetSerialNumber || gasbotData.DeviceSerialNumber || 'unknown').replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;

  // Calculate percentage from liters if AssetCalibratedFillLevel is missing
  const reportedLiters = parseFloat(gasbotData.AssetReportedLitres) || null;
  const capacity = parseFloat(gasbotData.AssetProfileWaterCapacity) || null;
  const calibratedPercent = parseFloat(gasbotData.AssetCalibratedFillLevel);

  // Use calibrated percentage if available, otherwise calculate from liters/capacity
  let levelPercent = calibratedPercent;
  if (!levelPercent && levelPercent !== 0 && reportedLiters && capacity && capacity > 0) {
    levelPercent = (reportedLiters / capacity) * 100;
  }

  return {
    location_id: locationId,
    external_guid: externalGuid,

    // Tank Identity
    name: gasbotData.AssetSerialNumber || gasbotData.AssetProfileName || 'Unknown Asset',
    serial_number: gasbotData.AssetSerialNumber || gasbotData.DeviceSerialNumber,
    profile_name: gasbotData.AssetProfileName || 'Gasbot Tank',
    profile_guid: gasbotData.AssetProfileGuid || 'profile-gasbot-tank',
    commodity: gasbotData.AssetProfileCommodity,

    // Tank Dimensions
    capacity_liters: capacity,
    max_depth_m: parseFloat(gasbotData.AssetProfileMaxDepth) || null,
    max_pressure_bar: parseFloat(gasbotData.AssetProfileMaxPressureBar) || null,
    max_display_percent: parseFloat(gasbotData.AssetProfileMaxDisplayPercentageFill) || null,

    // Current Tank Level
    current_level_liters: reportedLiters,
    current_level_percent: levelPercent || 0,
    current_raw_percent: parseFloat(gasbotData.AssetRawFillLevel || gasbotData.AssetCalibratedFillLevel) || levelPercent || 0,
    current_depth_m: parseFloat(gasbotData.AssetDepth) || null,
    current_pressure_bar: parseFloat(gasbotData.AssetPressureBar) || null,
    ullage_liters: parseFloat(gasbotData.AssetRefillCapacityLitres) || null,

    // Consumption Analytics (from Gasbot)
    daily_consumption_liters: parseFloat(gasbotData.AssetDailyConsumption) || null,
    days_remaining: parseInt(gasbotData.AssetDaysRemaining) || null,

    // Device Hardware
    device_guid: gasbotData.DeviceGuid || `device-${gasbotData.DeviceSerialNumber}`,
    device_serial: gasbotData.DeviceSerialNumber,
    device_model: gasbotData.DeviceModel || 43111,
    device_model_name: gasbotData.DeviceModelLabel || 'Gasbot Cellular Tank Monitor',
    device_sku: gasbotData.DeviceSKU,
    device_network_id: gasbotData.DeviceNetworkId,
    helmet_serial: gasbotData.HelmetSerialNumber,

    // Device Health (Premium!)
    is_online: gasbotData.DeviceOnline || false,
    is_disabled: gasbotData.AssetDisabledStatus || false,
    device_state: gasbotData.DeviceState,
    battery_voltage: parseFloat(gasbotData.DeviceBatteryVoltage) || null,
    temperature_c: parseFloat(gasbotData.DeviceTemperature) || null,

    // Timestamps
    device_activated_at: gasbotData.DeviceActivationTimestamp ?
      validateAndNormalizeTimestamp(gasbotData.DeviceActivationTimestamp, 'device_activated_at') : null,
    device_activation_epoch: convertEpochToBigInt(gasbotData.DeviceActivationEpoch),
    last_telemetry_at: validateAndNormalizeTimestamp(
      gasbotData.AssetLastCalibratedTelemetryTimestamp, 'last_telemetry_at'
    ),
    last_telemetry_epoch: convertEpochToBigInt(gasbotData.AssetLastCalibratedTelemetryEpoch) ||
      (gasbotData.AssetLastCalibratedTelemetryTimestamp ?
        Math.floor(new Date(validateAndNormalizeTimestamp(gasbotData.AssetLastCalibratedTelemetryTimestamp, 'last_telemetry_epoch')).getTime()) : Date.now()),
    last_raw_telemetry_at: gasbotData.AssetLastRawTelemetryTimestamp ?
      validateAndNormalizeTimestamp(gasbotData.AssetLastRawTelemetryTimestamp, 'last_raw_telemetry_at') : null,
    last_calibrated_telemetry_at: gasbotData.AssetLastCalibratedTelemetryTimestamp ?
      validateAndNormalizeTimestamp(gasbotData.AssetLastCalibratedTelemetryTimestamp, 'last_calibrated_telemetry_at') : null,
    asset_updated_at: gasbotData.AssetUpdatedTimestamp ?
      validateAndNormalizeTimestamp(gasbotData.AssetUpdatedTimestamp, 'asset_updated_at') : null,
    asset_updated_epoch: convertEpochToBigInt(gasbotData.AssetUpdatedEpoch),

    raw_data: gasbotData
  };
}

// Transform reading data for ta_agbot_readings
function transformReadingData(gasbotData, assetId) {
  // Calculate percentage from liters if AssetCalibratedFillLevel is missing
  const reportedLiters = parseFloat(gasbotData.AssetReportedLitres) || null;
  const capacity = parseFloat(gasbotData.AssetProfileWaterCapacity) || null;
  const calibratedPercent = parseFloat(gasbotData.AssetCalibratedFillLevel);

  // Use calibrated percentage if available, otherwise calculate from liters/capacity
  let levelPercent = calibratedPercent;
  if (!levelPercent && levelPercent !== 0 && reportedLiters && capacity && capacity > 0) {
    levelPercent = (reportedLiters / capacity) * 100;
    console.log(`   📊 Calculated level_percent from liters: ${levelPercent.toFixed(2)}% (${reportedLiters}L / ${capacity}L)`);
  }

  return {
    asset_id: assetId,

    // Tank level readings
    level_liters: reportedLiters,
    level_percent: levelPercent || 0,
    raw_percent: parseFloat(gasbotData.AssetRawFillLevel || gasbotData.AssetCalibratedFillLevel) || levelPercent || 0,
    depth_m: parseFloat(gasbotData.AssetDepth) || null,
    pressure_bar: parseFloat(gasbotData.AssetPressureBar) || null,

    // Device state snapshot
    is_online: gasbotData.DeviceOnline || false,
    battery_voltage: parseFloat(gasbotData.DeviceBatteryVoltage) || null,
    temperature_c: parseFloat(gasbotData.DeviceTemperature) || null,
    device_state: gasbotData.DeviceState,

    // Pre-calculated analytics
    daily_consumption: parseFloat(gasbotData.AssetDailyConsumption || gasbotData.LocationDailyConsumption) || null,
    days_remaining: parseInt(gasbotData.AssetDaysRemaining || gasbotData.LocationDaysRemaining) || null,

    // Timestamps
    reading_at: validateAndNormalizeTimestamp(
      gasbotData.AssetLastCalibratedTelemetryTimestamp || new Date().toISOString(),
      'reading_at'
    ),
    telemetry_epoch: convertEpochToBigInt(gasbotData.AssetLastCalibratedTelemetryEpoch) ||
      (gasbotData.AssetLastCalibratedTelemetryTimestamp ?
        Math.floor(new Date(gasbotData.AssetLastCalibratedTelemetryTimestamp).getTime()) : Date.now())
  };
}

// Check for alert conditions and create alerts
async function checkAndCreateAlerts(supabase, asset, gasbotData, previousAsset) {
  const alerts = [];
  const batteryVoltage = parseFloat(gasbotData.DeviceBatteryVoltage);
  const daysRemaining = parseInt(gasbotData.AssetDaysRemaining);
  const fillPercent = parseFloat(gasbotData.AssetCalibratedFillLevel);

  // Low battery alert (< 3.3V is warning, < 3.2V is critical)
  if (batteryVoltage && batteryVoltage < 3.3) {
    alerts.push({
      asset_id: asset.id,
      alert_type: 'low_battery',
      severity: batteryVoltage < 3.2 ? 'critical' : 'warning',
      title: `Low Battery: ${batteryVoltage.toFixed(2)}V`,
      message: `Device battery is ${batteryVoltage < 3.2 ? 'critically' : ''} low at ${batteryVoltage.toFixed(2)}V`,
      current_value: batteryVoltage,
      threshold_value: 3.3,
      previous_value: previousAsset?.battery_voltage || null
    });
  }

  // Low fuel alert (< 7 days remaining or < 15% fill)
  if (daysRemaining && daysRemaining <= 7) {
    alerts.push({
      asset_id: asset.id,
      alert_type: 'low_fuel',
      severity: daysRemaining <= 3 ? 'critical' : 'warning',
      title: `Low Fuel: ${daysRemaining} days remaining`,
      message: `Tank has approximately ${daysRemaining} days of fuel remaining`,
      current_value: daysRemaining,
      threshold_value: 7,
      previous_value: previousAsset?.days_remaining || null
    });
  } else if (fillPercent && fillPercent <= 15) {
    alerts.push({
      asset_id: asset.id,
      alert_type: 'low_fuel',
      severity: fillPercent <= 10 ? 'critical' : 'warning',
      title: `Low Fill Level: ${fillPercent.toFixed(1)}%`,
      message: `Tank is at ${fillPercent.toFixed(1)}% fill level`,
      current_value: fillPercent,
      threshold_value: 15,
      previous_value: previousAsset?.current_level_percent || null
    });
  }

  // Device offline alert
  if (previousAsset?.is_online === true && gasbotData.DeviceOnline === false) {
    alerts.push({
      asset_id: asset.id,
      alert_type: 'device_offline',
      severity: 'warning',
      title: 'Device Offline',
      message: `Device ${gasbotData.DeviceSerialNumber} has gone offline`,
      current_value: 0,
      threshold_value: 1,
      previous_value: 1
    });
  }

  // Insert alerts (deduplicating by checking for recent active alerts of same type)
  for (const alert of alerts) {
    // Check if there's already an active alert of this type for this asset
    const { data: existingAlert } = await supabase
      .from('ta_agbot_alerts')
      .select('id')
      .eq('asset_id', alert.asset_id)
      .eq('alert_type', alert.alert_type)
      .eq('is_active', true)
      .single();

    if (!existingAlert) {
      await supabase.from('ta_agbot_alerts').insert(alert);
    }
  }

  return alerts.length;
}

export default async function handler(req, res) {
  const startTime = Date.now();
  
  console.log('\n🔗 GASBOT WEBHOOK RECEIVED');
  console.log('='.repeat(50));
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 Method: ${req.method}`);
  console.log(`📍 URL: ${req.url}`);
  console.log(`🔑 Headers:`, Object.keys(req.headers));
  
  // Check environment variables
  console.log(`🔧 Environment check:`);
  console.log(`   SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_ANON_KEY (service role): ${supabaseKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   GASBOT_WEBHOOK_SECRET: ${WEBHOOK_SECRET ? '✅ Set' : '❌ Missing'}`);
  
  // Fail fast if environment is not properly configured
  if (!supabaseUrl || !supabaseKey) {
    console.error('💥 CONFIGURATION ERROR: Missing required environment variables');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Missing required environment variables for database connection'
    });
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed', 
      expected: 'POST',
      received: req.method 
    });
  }
  
  // Verify authentication
  const authHeader = req.headers.authorization;
  console.log(`🔐 Auth header: ${authHeader?.substring(0, 20)}...`);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ Missing Authorization header');
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Bearer token required in Authorization header' 
    });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  if (token !== WEBHOOK_SECRET) {
    console.log('❌ Invalid webhook secret');
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid webhook secret' 
    });
  }
  
  console.log('✅ Authentication verified');
  
  try {
    // Parse the webhook data
    const webhookData = req.body;
    console.log(`📊 Received data type: ${typeof webhookData}`);
    console.log(`📋 Data keys: ${Object.keys(webhookData || {})}`);
    
    // Handle different data formats (array vs single object)
    let tankRecords = [];
    if (Array.isArray(webhookData)) {
      tankRecords = webhookData;
    } else if (webhookData && typeof webhookData === 'object') {
      tankRecords = [webhookData];
    } else {
      throw new Error('Invalid webhook data format - expected JSON object or array');
    }
    
    console.log(`🔢 Processing ${tankRecords.length} tank records`);
    
    let processedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process each tank record
    for (let i = 0; i < tankRecords.length; i++) {
      const tankData = tankRecords[i];
      
      try {
        console.log(`\n📍 Processing record ${i + 1}: ${tankData.LocationId}`);
        console.log(`   🔧 Asset: ${tankData.AssetSerialNumber}`);
        console.log(`   ⛽ Fill Level: ${tankData.AssetCalibratedFillLevel}% (Raw: ${tankData.AssetRawFillLevel}%)`);
        console.log(`   📊 Volume: ${tankData.AssetReportedLitres}L`);
        console.log(`   🔋 Battery: ${tankData.DeviceBatteryVoltage}V`);
        console.log(`   📡 Device: ${tankData.DeviceState} (Online: ${tankData.DeviceOnline})`);
        console.log(`   📈 Consumption: ${tankData.AssetDailyConsumption || tankData.LocationDailyConsumption}L/day`);
        
        // 1. Upsert location to ta_agbot_locations
        const locationData = transformGasbotLocationData(tankData);
        const { data: location, error: locationError } = await supabase
          .from('ta_agbot_locations')
          .upsert(locationData, {
            onConflict: 'external_guid',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (locationError) {
          throw new Error(`Location upsert failed: ${locationError.message}`);
        }

        console.log(`   ✅ Location updated: ${location.id}`);

        // 2. Get previous asset state for alert comparison
        const assetExternalGuid = tankData.AssetGuid ||
          `asset-${(tankData.AssetSerialNumber || tankData.DeviceSerialNumber || 'unknown').replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;

        const { data: previousAsset } = await supabase
          .from('ta_agbot_assets')
          .select('id, is_online, battery_voltage, days_remaining, current_level_percent')
          .eq('external_guid', assetExternalGuid)
          .single();

        // 3. Upsert asset to ta_agbot_assets
        const assetData = transformGasbotAssetData(tankData, location.id);
        const { data: asset, error: assetError } = await supabase
          .from('ta_agbot_assets')
          .upsert(assetData, {
            onConflict: 'external_guid',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (assetError) {
          throw new Error(`Asset upsert failed: ${assetError.message}`);
        }

        console.log(`   ✅ Asset updated: ${asset.id}`);

        // 4. Check for alerts (premium feature)
        let alertsTriggered = 0;
        try {
          alertsTriggered = await checkAndCreateAlerts(supabase, asset, tankData, previousAsset);
          if (alertsTriggered > 0) {
            console.log(`   🚨 ${alertsTriggered} alert(s) triggered`);
          }
        } catch (alertError) {
          console.log(`   ⚠️  Alert check failed: ${alertError.message}`);
        }

        // 5. Calculate consumption from historical data
        try {
          const consumption = await calculateConsumption(
            asset.id,
            parseFloat(tankData.AssetCalibratedFillLevel) || 0,
            parseFloat(tankData.AssetProfileWaterCapacity) || null
          );

          if (consumption.data_points >= 3) {
            const updated = await updateAssetConsumption(asset.id, consumption);
            if (updated) {
              console.log(`   📊 Consumption calculated: ${consumption.daily_consumption_litres?.toFixed(1) || 'N/A'} L/day, ${consumption.days_remaining?.toFixed(0) || 'N/A'} days remaining (${consumption.confidence} confidence)`);
            }
          } else {
            console.log(`   ℹ️  Insufficient data for consumption calculation (${consumption.data_points} readings)`);
          }
        } catch (consumptionError) {
          // Don't fail the webhook if consumption calculation fails
          console.log(`   ⚠️  Consumption calculation failed: ${consumptionError.message}`);
        }

        // 6. Create historical reading in ta_agbot_readings
        const readingData = transformReadingData(tankData, asset.id);

        const { error: readingError } = await supabase
          .from('ta_agbot_readings')
          .insert(readingData);

        if (readingError) {
          console.log(`   ⚠️  Reading insert failed: ${readingError.message}`);
        } else {
          console.log(`   ✅ Reading recorded`);
        }

        processedCount++;
        
      } catch (recordError) {
        console.error(`   ❌ Record ${i + 1} failed: ${recordError.message}`);
        errors.push(`Record ${i + 1} (${tankData.LocationId}): ${recordError.message}`);
        errorCount++;
      }
    }
    
    const duration = Date.now() - startTime;

    // Log webhook success to ta_agbot_sync_log
    await supabase
      .from('ta_agbot_sync_log')
      .insert({
        sync_type: 'gasbot_webhook',
        status: errorCount === 0 ? 'success' : 'partial',
        locations_processed: processedCount,
        assets_processed: processedCount,
        readings_processed: processedCount,
        alerts_triggered: 0, // Could aggregate from loop if needed
        error_message: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
        duration_ms: duration,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString()
      });
    
    console.log('\n🎉 WEBHOOK PROCESSING COMPLETE');
    console.log(`   ✅ Processed: ${processedCount}/${tankRecords.length} records`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log('='.repeat(50));
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      stats: {
        totalRecords: tankRecords.length,
        processedRecords: processedCount,
        errorCount: errorCount,
        duration: duration
      },
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined // Return first 5 errors
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('\n💥 WEBHOOK PROCESSING FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    // Log webhook failure to ta_agbot_sync_log
    await supabase
      .from('ta_agbot_sync_log')
      .insert({
        sync_type: 'gasbot_webhook',
        status: 'error',
        locations_processed: 0,
        assets_processed: 0,
        readings_processed: 0,
        alerts_triggered: 0,
        error_message: error.message,
        duration_ms: duration,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString()
      });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      duration: duration
    });
  }
}